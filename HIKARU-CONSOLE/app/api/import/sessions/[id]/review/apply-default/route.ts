import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { requireAdmin, getOwnedSession, writeAuditLog } from '@/lib/import/helpers'
import { applyReviewPatch, shouldApplyDefault } from '@/lib/import/review-edit'
import { getFieldMeta } from '@/lib/import/editable-fields'
import type { ImportEntityType } from '@/types/import'

// POST /api/import/sessions/[id]/review/apply-default
//
// 「Session 内の全 row のうち、指定 field が空欄の row にのみ、
//  指定 value を default として適用する」列単位 UX。
//
// Phase U3 の scope:
//   - empty-only (既存値は上書きしない)。overwrite-all は本 phase では未実装。
//   - allowlist は field-level PATCH と同じ (EDITABLE_FIELDS + PATCH_FORBIDDEN_KEYS)
//   - 内部 UUID / reference 系 field はここでは default 適用禁止 (spec):
//       column default は「単一の value を全 row に適用」ため、reference の
//       resolve が偶然に collision する事故を防ぐ。
//
// Body:
//   { field: 'category', value: 'supplies' }
//   value は string | null。string は U1 normalizer で canonical 化される。
//
// Response:
//   { updated_count, skipped_count, revalidated_count }
//
// Security:
//   - Admin only, session ownership 必須
//   - RLS + explicit .eq('company_id') で cross-company row 除外
//   - Business tables への write なし
//   - AI/OpenAI/external API: 0
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params

  const auth = await getAuthContext()
  if (!auth) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: '認証が必要です' }, { status: 401 })
  }
  if (!(await requireAdmin(auth))) {
    return NextResponse.json({ code: 'FORBIDDEN', message: '管理者権限が必要です' }, { status: 403 })
  }

  const session = await getOwnedSession(auth, sessionId)
  if (!session) {
    return NextResponse.json({ code: 'IMPORT_SESSION_NOT_FOUND', message: 'インポートセッションが見つかりません' }, { status: 404 })
  }
  if (session.status !== 'review_required') {
    return NextResponse.json(
      { code: 'INVALID_SESSION_STATE', message: `適用は review_required 状態のセッションのみ可能です (現在: ${session.status})` },
      { status: 409 },
    )
  }

  const entityType = session.entity_type as ImportEntityType

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ code: 'INVALID_REQUEST', message: 'リクエストボディが不正です' }, { status: 400 })
  }

  const field    = body.field
  const rawValue = body.value

  if (typeof field !== 'string' || field.length === 0) {
    return NextResponse.json({ code: 'INVALID_REQUEST', message: 'field は文字列で指定してください' }, { status: 400 })
  }

  // Reference / internal fields は column default に禁止 (spec)
  const meta = getFieldMeta(entityType, field)
  if (!meta) {
    return NextResponse.json({ code: 'FIELD_NOT_EDITABLE', message: `field '${field}' は編集対象ではありません` }, { status: 400 })
  }
  if (meta.type === 'reference') {
    return NextResponse.json(
      { code: 'REFERENCE_DEFAULT_FORBIDDEN', message: '参照フィールドの一括適用は対応していません (行単位で選択してください)' },
      { status: 400 },
    )
  }

  const value: string | null =
    rawValue === null ? null :
    typeof rawValue === 'string'  ? rawValue :
    typeof rawValue === 'number' || typeof rawValue === 'boolean' ? String(rawValue) :
    'INVALID_TYPE_SENTINEL'
  if (value === 'INVALID_TYPE_SENTINEL') {
    return NextResponse.json({ code: 'INVALID_REQUEST', message: 'value は string / number / boolean / null のみ許可されます' }, { status: 400 })
  }

  // Fetch all rows in session that have empty value for this field
  //   Note: Postgres JSONB `->>` returns text; empty and null both count as "empty".
  //   We fetch all rows then filter in JS for safety across nulls / whitespace.
  const { data: rows, error: fetchErr } = await auth.adminClient
    .from('import_staging_rows')
    .select('id, mapped_data, validation_errors, review_status')
    .eq('session_id', sessionId)
    .eq('company_id', auth.companyId)
    .order('row_index', { ascending: true })

  if (fetchErr) {
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Staging行の取得に失敗しました' }, { status: 500 })
  }

  const allRows = (rows ?? []) as Array<Record<string, unknown>>

  let eligibleCount = 0
  let skippedCount  = 0

  // (Fix 2) 各 row の最終 payload を計算 → 同じ payload のものを 1 UPDATE にまとめる。
  // 「同じ default 値だから group する」ではなく、「validation_status / validation_errors /
  //  mapped_data が全て同一だから安全に group できる」場合のみ group 化する。
  // 異なる mapped_data を単一 SET でまとめると silent data overwrite の危険があるため。
  interface UpdatePayload {
    mapped_data:        Record<string, string | null>
    validation_status:  string
    validation_errors:  Record<string, unknown> | null
  }
  const rowPayloads: Array<{ id: string; payload: UpdatePayload; groupKey: string }> = []

  for (const row of allRows) {
    const currentMapped = (row.mapped_data as Record<string, string | null> | null) ?? {}
    const currentErrors = (row.validation_errors as Record<string, unknown> | null) ?? null
    const unmappedHeaders: string[] = Array.isArray(currentErrors?.['unmapped_headers'])
      ? (currentErrors!['unmapped_headers'] as string[])
      : []

    if (!shouldApplyDefault(currentMapped[field])) {
      skippedCount++
      continue
    }

    const result = applyReviewPatch(currentMapped, { [field]: value }, entityType, unmappedHeaders)

    if (result.rejected.length > 0) {
      // 到達不能 (上流で field validity check 済み) — 万一の場合 skip して継続
      skippedCount++
      continue
    }

    const payload: UpdatePayload = {
      mapped_data:       result.mergedMapped,
      validation_status: result.validation.status,
      validation_errors: buildValidationErrors(result.validation, unmappedHeaders),
    }
    // group key: JSON stringify で deterministic key を作る (Node.js の Object.keys 順は
    // insertion order を保つため、mapper 経由で作られた object は再現性のある stringify に
    // なる。念のため keys を sort して余計な group split を防ぐ)
    rowPayloads.push({ id: row.id as string, payload, groupKey: stableStringify(payload) })
    eligibleCount++
  }

  // Group by exact payload equality
  const groups = new Map<string, { payload: UpdatePayload; ids: string[] }>()
  for (const rp of rowPayloads) {
    const g = groups.get(rp.groupKey)
    if (g) g.ids.push(rp.id)
    else   groups.set(rp.groupKey, { payload: rp.payload, ids: [rp.id] })
  }

  // (Fix 2) 実 DB update:
  //   - 各 group について、ids を IN_CHUNK 単位に切って `.in('id', chunkIds)` で 1 UPDATE
  //     (PostgREST の URL / body 長を考慮して 200 まで)
  //   - group 間は bounded concurrency (MAX_PARALLEL) で並列実行
  //   - どの UPDATE も `.eq('company_id')` + `.eq('session_id')` の 3 条件で cross-company / cross-session
  //     write を防止
  const IN_CHUNK      = 200
  const MAX_PARALLEL  = 6
  const nowIso        = new Date().toISOString()

  // group → 一連の update task に展開
  const tasks: Array<{ payload: UpdatePayload; ids: string[] }> = []
  for (const g of groups.values()) {
    for (let i = 0; i < g.ids.length; i += IN_CHUNK) {
      tasks.push({ payload: g.payload, ids: g.ids.slice(i, i + IN_CHUNK) })
    }
  }

  let appliedCount = 0
  let failedCount  = 0
  const failures: Array<{ ids_sample: string[]; error: string }> = []

  // Bounded concurrent execution
  async function runTask(t: { payload: UpdatePayload; ids: string[] }): Promise<void> {
    const { error: updateErr } = await auth!.adminClient
      .from('import_staging_rows')
      .update({
        mapped_data:       t.payload.mapped_data,
        validation_status: t.payload.validation_status,
        validation_errors: t.payload.validation_errors,
        updated_at:        nowIso,
      } as never)
      .eq('session_id', sessionId)
      .eq('company_id', auth!.companyId)
      .in('id', t.ids)
    if (updateErr) {
      failedCount += t.ids.length
      // 失敗 sample: 先頭 3 件だけ記録 (bulk 失敗診断のため / PII なし)
      failures.push({ ids_sample: t.ids.slice(0, 3), error: updateErr.code ?? 'unknown_db_error' })
    } else {
      appliedCount += t.ids.length
    }
  }

  for (let i = 0; i < tasks.length; i += MAX_PARALLEL) {
    const batch = tasks.slice(i, i + MAX_PARALLEL)
    await Promise.all(batch.map(runTask))
  }

  writeAuditLog(auth, sessionId, 'review.column_default_applied', {
    field,
    value_provided:   value !== null,
    eligible_count:   eligibleCount,
    applied_count:    appliedCount,
    failed_count:     failedCount,
    skipped_count:    skippedCount,
    group_count:      groups.size,
    task_count:       tasks.length,
    mode:             'empty_only',
    // failure sample IDs (structural only, no PII)
    ...(failures.length > 0 ? { failures: failures.slice(0, 5) } : {}),
  })

  // 全 failure = 500 (通常 apply-default operation は成功前提。全滅は internal error 級)
  if (failedCount > 0 && appliedCount === 0) {
    return NextResponse.json({
      code:    'INTERNAL_ERROR',
      message: 'Staging行の更新に失敗しました',
      data: {
        field,
        requested:     eligibleCount + skippedCount,
        eligible:      eligibleCount,
        updated_count: appliedCount,
        failed_count:  failedCount,
        skipped_count: skippedCount,
        mode:          'empty_only',
      },
    }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    data: {
      field,
      requested:          eligibleCount + skippedCount,
      eligible:           eligibleCount,
      updated_count:      appliedCount,
      failed_count:       failedCount,
      skipped_count:      skippedCount,
      mode:               'empty_only',
    },
  })
}

/**
 * (Fix 2) deterministic JSON stringify for payload grouping.
 * Object のキー順を昇順 sort することで、同じ内容の payload が同じ string key になる。
 * mapper が返す object は insertion-order preserving なので、ここで sort を挟まないと
 * 意味が同じでも順序違いで group が split される可能性がある。
 */
function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']'
  const keys = Object.keys(v as Record<string, unknown>).sort()
  const parts = keys.map(k => JSON.stringify(k) + ':' + stableStringify((v as Record<string, unknown>)[k]))
  return '{' + parts.join(',') + '}'
}

function buildValidationErrors(
  validation: { missingRequired: string[]; invalidFields: Array<{ field: string; reason: string }> },
  unmappedHeaders: string[],
): Record<string, unknown> | null {
  if (
    validation.missingRequired.length === 0 &&
    validation.invalidFields.length === 0 &&
    unmappedHeaders.length === 0
  ) {
    return null
  }
  const obj: Record<string, unknown> = {}
  if (validation.missingRequired.length > 0) obj['missing_required'] = validation.missingRequired
  if (validation.invalidFields.length > 0)   obj['invalid_fields']   = validation.invalidFields
  if (unmappedHeaders.length > 0)            obj['unmapped_headers'] = unmappedHeaders
  return obj
}
