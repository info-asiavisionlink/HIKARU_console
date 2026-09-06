// ============================================================
// HIKARU Universal Import — Review Edit Logic (Phase U3)
//
// 目的:
//   Review 画面から送られてきた「1 row の canonical field patch」を、
//   safely / deterministically に mapped_data へ merge するための server-side
//   コア logic。UI と API endpoint の両方から呼ばれる pure function を提供。
//
// 責務:
//   1. Field allowlist enforcement (editable-fields.ts と PATCH_FORBIDDEN_KEYS)
//   2. U1 value normalizer 再適用 (Review 経由でも canonical contract 崩さない)
//   3. FK field patch:
//        - user が候補 UUID を選択した場合、この段階では UUID 形式チェックのみ。
//          cross-company 所有権チェックは API 側 (DB クエリが必要) が実施する。
//        - このモジュールは pure function (DB 触らず)。
//   4. validateMappedRow 再実行 → validation_status + validation_errors 更新
//
// 非目的:
//   - DB 触らない (API route が担当)
//   - Duplicate 判定再実行はしない (U3 では duplicate stale と mark するだけ、
//     再検出は user 明示操作 or 次 phase)
//   - Cross-company candidate 所有権チェックはしない (API route の DB クエリで実施)
// ============================================================

import type { ImportEntityType }         from '@/types/import'
import { normalizeValueForField, validateMappedRow, type MappedData, type RowValidationResult } from './mapper'
import { getFieldMeta, PATCH_FORBIDDEN_KEYS }    from './editable-fields'

// ---- Types ----

export type FieldPatch = Record<string, string | null>

export interface ApplyPatchResult {
  /** allowlist + normalize 済みの patch (mapped_data merge 対象) */
  acceptedPatch:  FieldPatch
  /** allowlist 違反等で拒否された patch 一覧 */
  rejected:       Array<{ field: string; reason: 'not_editable' | 'forbidden_internal' | 'invalid_uuid' | 'invalid_fk_status' }>
  /** merge 後の mapped_data (validation 済み) */
  mergedMapped:   MappedData
  /** 更新後の validation 結果 */
  validation:     RowValidationResult
  /** duplicate 判定は stale (FK/名前系 field を変更した場合 true) */
  duplicateStale: boolean
}

// ---- UUID format check ----
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/** 純粋な UUID 形式判定 (server 側は別途 company_id 所有権チェックを実施) */
export function isUuidLike(v: string | null): boolean {
  if (v === null) return false
  return UUID_RE.test(v)
}

// ---- Fields whose change invalidates duplicate_candidates ----
//
// email / phone / name / employee_number / address 等 — duplicate-engine の
// signal に含まれる field。これらが変わったら duplicate stale.

const DUPLICATE_SIGNAL_FIELDS: ReadonlySet<string> = new Set([
  'name', 'email', 'phone', 'address',
  'employee_number', 'code',
])

// ---- Main API ----

/**
 * 1 row 分の patch を allowlist 経由で safely merge し、re-validate する。
 *
 * @param currentMapped 現在の mapped_data (staging_row から取得したもの)
 * @param patch        Review UI から送られてきた field patch (canonical field → 生 value)
 * @param entityType   session の entity_type
 * @param unmappedHeaders 現在の staging_row の unmapped headers (validation 用)
 */
export function applyReviewPatch(
  currentMapped:   MappedData,
  patch:           FieldPatch,
  entityType:      ImportEntityType,
  unmappedHeaders: string[] = [],
): ApplyPatchResult {
  const acceptedPatch: FieldPatch = {}
  const rejected:      ApplyPatchResult['rejected'] = []
  let   duplicateStale = false

  for (const [rawField, rawValue] of Object.entries(patch)) {
    // (1) 内部 UUID / ownership field は無条件 reject
    if (PATCH_FORBIDDEN_KEYS.has(rawField)) {
      rejected.push({ field: rawField, reason: 'forbidden_internal' })
      continue
    }

    // (2) allowlist に無い field は reject
    const meta = getFieldMeta(entityType, rawField)
    if (!meta) {
      rejected.push({ field: rawField, reason: 'not_editable' })
      continue
    }

    // (3) reference field は UUID 形式チェック (allow null で「未指定に戻す」)
    if (meta.type === 'reference') {
      if (rawValue === null || rawValue === '') {
        // 未指定に戻す: id を null 化 + fk_status を not_found にリセット
        acceptedPatch[rawField] = null
        acceptedPatch[fkStatusKey(rawField)] = 'not_found'
        duplicateStale = true
        continue
      }
      if (typeof rawValue !== 'string' || !isUuidLike(rawValue)) {
        rejected.push({ field: rawField, reason: 'invalid_uuid' })
        continue
      }
      // UUID 形式は OK、cross-company 所有権チェックは API route の責務
      acceptedPatch[rawField] = rawValue
      acceptedPatch[fkStatusKey(rawField)] = 'resolved'
      duplicateStale = true
      continue
    }

    // (4) enum / date / time / money / integer / boolean / text → U1 normalizer
    const norm = normalizeValueForField(rawField, rawValue, entityType)
    acceptedPatch[rawField] = norm

    if (DUPLICATE_SIGNAL_FIELDS.has(rawField)) duplicateStale = true
  }

  // Merge: patch を current に上書き適用
  const mergedMapped: MappedData = { ...currentMapped, ...acceptedPatch }

  // Re-validate
  const validation = validateMappedRow(mergedMapped, entityType, unmappedHeaders)

  return {
    acceptedPatch,
    rejected,
    mergedMapped,
    validation,
    duplicateStale,
  }
}

// ---- Helpers ----

/**
 * reference field (e.g. `client_id`) の隣に存在する fk_status field 名を返す。
 * mapper.ts (Map route) が使う命名規約に合わせる: `<xxx>_id` → `<xxx>_fk_status`。
 * ただし worker_id は import 側の内部 alias なので、mapping はしない
 * (worker_id は PATCH_FORBIDDEN_KEYS に含まれている)。
 */
function fkStatusKey(field: string): string {
  if (field.endsWith('_id')) {
    return field.slice(0, -3) + '_fk_status'
  }
  return field + '_fk_status'
}

// ---- Column default apply ----
//
// Session 内の全 row のうち mapped_data[field] が空の row にのみ、指定 value を
// 適用する (empty-only)。既存値は上書きしない。allowlist / normalizer は
// applyReviewPatch と同じ contract。

/** 単一 row に column default を「空欄のみ」適用する pure 判定 */
export function shouldApplyDefault(
  currentValue: string | null | undefined,
): boolean {
  if (currentValue === null || currentValue === undefined) return true
  if (typeof currentValue !== 'string')                    return false
  return currentValue.trim().length === 0
}
