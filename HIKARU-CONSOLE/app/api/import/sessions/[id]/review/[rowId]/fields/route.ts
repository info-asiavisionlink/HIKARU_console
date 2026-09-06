import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { requireAdmin, getOwnedSession, writeAuditLog } from '@/lib/import/helpers'
import { applyReviewPatch, isUuidLike, type FieldPatch } from '@/lib/import/review-edit'
import { getFieldMeta } from '@/lib/import/editable-fields'
import type { ImportEntityType } from '@/types/import'

// PATCH /api/import/sessions/[id]/review/[rowId]/fields
//
// Review UI から 1 row の canonical field patch を受け取り、
// server-side allowlist + U1 normalizer + validation を通した上で
// mapped_data を更新する。business tables への直接 write は絶対に行わない。
//
// Request body:
//   { fields: Record<canonical_field_name, string | null> }
//
// Server-side guards:
//   1. Session must be review_required (409 if not)
//   2. Row must belong to session + company (404 if not)
//   3. Each field must be in EDITABLE_FIELDS[entity_type] (per-entity allowlist)
//   4. Internal / ownership fields (PATCH_FORBIDDEN_KEYS) rejected unconditionally
//   5. Reference fields (client_id / store_id / employee_id / project_id / partner_id)
//      must be UUID format + must exist within the same company_id
//   6. Value is normalized via U1 pipeline (date/time/money/boolean/enum)
//   7. validateMappedRow is re-run after merge → validation_status / errors updated
//   8. If duplicate-signal field (name/email/phone/address/employee_number/code)
//      changed, review_status is reset to 'pending' (user must re-review)
//
// OpenAI calls: 0. External API: 0. Business table writes: 0.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; rowId: string }> },
) {
  const { id: sessionId, rowId } = await params

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
      { code: 'INVALID_SESSION_STATE', message: `編集は review_required 状態のセッションのみ可能です (現在: ${session.status})` },
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

  const rawPatch = body.fields
  if (!rawPatch || typeof rawPatch !== 'object' || Array.isArray(rawPatch)) {
    return NextResponse.json({ code: 'INVALID_REQUEST', message: 'fields は object 形式で指定してください' }, { status: 400 })
  }

  const patch: FieldPatch = {}
  for (const [k, v] of Object.entries(rawPatch as Record<string, unknown>)) {
    if (v === null) { patch[k] = null; continue }
    if (typeof v === 'string') { patch[k] = v; continue }
    if (typeof v === 'number' || typeof v === 'boolean') { patch[k] = String(v); continue }
    return NextResponse.json({ code: 'INVALID_FIELD_VALUE', message: `field '${k}' の値は string / number / boolean / null のみ許可されます` }, { status: 400 })
  }

  // Verify row ownership
  const { data: row, error: rowErr } = await auth.adminClient
    .from('import_staging_rows')
    .select('id, mapped_data, normalized_data, validation_errors, review_status')
    .eq('id', rowId)
    .eq('session_id', sessionId)
    .eq('company_id', auth.companyId)
    .single()

  if (rowErr || !row) {
    return NextResponse.json({ code: 'ROW_NOT_FOUND', message: 'Staging行が見つかりません' }, { status: 404 })
  }

  const r = row as Record<string, unknown>
  const currentMapped = (r.mapped_data as Record<string, string | null> | null) ?? {}
  const currentErrors = (r.validation_errors as Record<string, unknown> | null) ?? null
  const unmappedHeaders: string[] = Array.isArray(currentErrors?.['unmapped_headers'])
    ? (currentErrors!['unmapped_headers'] as string[])
    : []

  // Cross-company FK candidate ownership check
  //   Reference fields: verify each candidate UUID belongs to the same company_id
  //   and exists in the correct entity table.
  const fkChecks: Array<{ field: string; uuid: string; refType: string }> = []
  for (const [field, val] of Object.entries(patch)) {
    if (val === null || val === '') continue
    const meta = getFieldMeta(entityType, field)
    if (!meta || meta.type !== 'reference' || !meta.referenceType) continue
    if (!isUuidLike(val)) continue  // format check handled in applyReviewPatch too
    fkChecks.push({ field, uuid: val, refType: meta.referenceType })
  }

  for (const chk of fkChecks) {
    const table = tableForReferenceType(chk.refType)
    if (!table) {
      return NextResponse.json({ code: 'INVALID_REFERENCE_TYPE', message: `未対応の reference type: ${chk.refType}` }, { status: 400 })
    }
    const { data: cand, error: candErr } = await auth.adminClient
      .from(table)
      .select('id')
      .eq('id', chk.uuid)
      .eq('company_id', auth.companyId)
      .single()
    if (candErr || !cand) {
      return NextResponse.json(
        {
          code: 'FK_CANDIDATE_NOT_OWNED',
          message: `参照先が見つかりません、または他社データを参照しています (field: ${chk.field})`,
          field: chk.field,
        },
        { status: 400 },
      )
    }
  }

  // Apply patch (allowlist + normalize + revalidate) — pure function
  const result = applyReviewPatch(currentMapped, patch, entityType, unmappedHeaders)

  // If any allowlist rejection occurred, return 400 (fail-loud rather than silently drop)
  if (result.rejected.length > 0) {
    return NextResponse.json(
      {
        code:     'PATCH_FIELD_REJECTED',
        message:  '一部のフィールドは編集が許可されていません',
        rejected: result.rejected,
      },
      { status: 400 },
    )
  }

  // Build validation_errors object (same shape as map route)
  const nextValidationErrors = buildValidationErrors(result.validation, unmappedHeaders)

  // If duplicate-signal field changed and user has already reviewed the row,
  // reset review_status to 'pending' so the user must re-confirm.
  const currentReviewStatus = r.review_status as string
  const nextReviewStatus = result.duplicateStale && currentReviewStatus !== 'pending'
    ? 'pending'
    : currentReviewStatus

  // Persist
  const { error: updateErr } = await auth.adminClient
    .from('import_staging_rows')
    .update({
      mapped_data:       result.mergedMapped,
      validation_status: result.validation.status,
      validation_errors: nextValidationErrors,
      review_status:     nextReviewStatus,
      updated_at:        new Date().toISOString(),
    } as never)
    .eq('id', rowId)
    .eq('session_id', sessionId)
    .eq('company_id', auth.companyId)

  if (updateErr) {
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Staging行の更新に失敗しました' }, { status: 500 })
  }

  // If duplicate-signal field changed and there are existing duplicate candidates,
  // reset their review_status to 'pending' so user re-evaluates.
  if (result.duplicateStale) {
    await auth.adminClient
      .from('import_duplicate_candidates')
      .update({
        review_status:   'pending',
        resolved_action: null,
        resolved_at:     null,
        resolved_by:     null,
      } as never)
      .eq('staging_row_id', rowId)
      .eq('session_id', sessionId)
      .eq('company_id', auth.companyId)
  }

  // Audit — record only field names, not values (PII-safe)
  writeAuditLog(auth, sessionId, 'review.field_edited', {
    row_id:              rowId,
    fields_updated:      Object.keys(result.acceptedPatch),
    validation_status:   result.validation.status,
    duplicate_stale:     result.duplicateStale,
    review_status_reset: nextReviewStatus !== currentReviewStatus,
  })

  return NextResponse.json({
    success: true,
    data: {
      row_id:            rowId,
      mapped_data:       result.mergedMapped,
      validation_status: result.validation.status,
      validation_errors: nextValidationErrors,
      review_status:     nextReviewStatus,
      duplicate_stale:   result.duplicateStale,
    },
  })
}

// ---- helpers ----

function tableForReferenceType(refType: string): string | null {
  switch (refType) {
    case 'client':   return 'clients'
    case 'store':    return 'stores'
    case 'employee': return 'employees'
    case 'project':  return 'projects'
    case 'partner':  return 'partners'
    default: return null
  }
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
