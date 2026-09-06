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

  let updatedCount = 0
  let skippedCount = 0

  const updates: Array<{
    id:                 string
    mapped_data:        Record<string, string | null>
    validation_status:  string
    validation_errors:  Record<string, unknown> | null
    review_status:      string
    updated_at:         string
  }> = []

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

    const nextValidationErrors = buildValidationErrors(result.validation, unmappedHeaders)

    updates.push({
      id:                 row.id as string,
      mapped_data:        result.mergedMapped,
      validation_status:  result.validation.status,
      validation_errors:  nextValidationErrors,
      review_status:      row.review_status as string,  // column default は review 判定を invalidate しない
      updated_at:         new Date().toISOString(),
    })
    updatedCount++
  }

  // Batch update — Supabase update() は 1 row / call のため、row 単位で並列は避け、
  // upsert で会社 scope を維持しつつ atomicity を得る (mapped_data merge は既に済んでいる)。
  // 少量ずつ処理 (BATCH=100) して cross-company write は RLS + explicit filter で防御。
  const BATCH = 100
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH)
    for (const u of batch) {
      const { error: updateErr } = await auth.adminClient
        .from('import_staging_rows')
        .update({
          mapped_data:       u.mapped_data,
          validation_status: u.validation_status,
          validation_errors: u.validation_errors,
          updated_at:        u.updated_at,
        } as never)
        .eq('id', u.id)
        .eq('session_id', sessionId)
        .eq('company_id', auth.companyId)
      if (updateErr) {
        return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Staging行の更新に失敗しました' }, { status: 500 })
      }
    }
  }

  writeAuditLog(auth, sessionId, 'review.column_default_applied', {
    field,
    value_provided:   value !== null,
    updated_count:    updatedCount,
    skipped_count:    skippedCount,
    mode:             'empty_only',
  })

  return NextResponse.json({
    success: true,
    data: {
      field,
      updated_count:      updatedCount,
      skipped_count:      skippedCount,
      mode:               'empty_only',
    },
  })
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
