import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { requireAdmin, getOwnedSession, writeAuditLog } from '@/lib/import/helpers'
import { buildHeaderMapping, applyRowMapping, validateMappedRow } from '@/lib/import/mapper'
import type { ImportEntityType } from '@/types/import'

const BATCH_SIZE = 250  // rows per upsert batch

// POST /api/import/sessions/[id]/map
//
// Staging Rowsに対してDeterministic Header Mappingを実行し、
// mapped_data / validation_status を更新する。
//
// 遷移: mapping → validating → review_required
//
// 設計:
//   - Header Mappingはファイル単位で1回のみ決定 (N×推測禁止)
//   - 全Rowへ同一Mapping Ruleを適用
//   - Batch UPSERT (BATCH_SIZE行/回)
//   - OpenAI calls: 0
//   - Business Tableへの書き込みなし (import_staging_rowsのみ)
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params

  // 1. Authentication
  const auth = await getAuthContext()
  if (!auth) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: '認証が必要です' }, { status: 401 })
  }

  // 2. Admin authorization
  if (!(await requireAdmin(auth))) {
    return NextResponse.json({ code: 'FORBIDDEN', message: '管理者権限が必要です' }, { status: 403 })
  }

  // 3. Session ownership + state validation
  const session = await getOwnedSession(auth, sessionId)
  if (!session) {
    return NextResponse.json(
      { code: 'IMPORT_SESSION_NOT_FOUND', message: 'インポートセッションが見つかりません' },
      { status: 404 },
    )
  }

  if (session.status !== 'mapping') {
    return NextResponse.json(
      { code: 'INVALID_SESSION_STATE', message: `Mappingはmapping状態のセッションのみ可能です (現在: ${session.status})` },
      { status: 409 },
    )
  }

  const entityType = session.entity_type as ImportEntityType

  // 4. Get import_files to retrieve normalized_headers from extraction metadata
  const { data: fileRecord, error: fileErr } = await auth.adminClient
    .from('import_files')
    .select('id, validation_errors')
    .eq('session_id', sessionId)
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (fileErr || !fileRecord) {
    return NextResponse.json({ code: 'FILE_NOT_FOUND', message: 'ファイルレコードが見つかりません' }, { status: 404 })
  }

  const fr = fileRecord as Record<string, unknown>
  const extractMeta = fr.validation_errors as Record<string, unknown> | null
  const normalizedHeaders: string[] = Array.isArray(extractMeta?.['normalized_headers'])
    ? (extractMeta!['normalized_headers'] as string[])
    : []

  if (normalizedHeaders.length === 0) {
    return NextResponse.json(
      { code: 'MAPPING_FAILED', message: 'ヘッダー情報が取得できません。Extractionが完了しているか確認してください' },
      { status: 422 },
    )
  }

  // 5. Build header mapping ONCE for this file (not per row)
  const mappingResult = buildHeaderMapping(normalizedHeaders, entityType)

  // Session → validating
  await auth.adminClient
    .from('import_sessions')
    .update({ status: 'validating', updated_at: new Date().toISOString() } as never)
    .eq('id', sessionId)
    .eq('company_id', auth.companyId)

  writeAuditLog(auth, sessionId, 'mapping.started', {
    entity_type:      entityType,
    header_mapping:   mappingResult.headerMapping,
    unmapped_headers: mappingResult.unmappedHeaders,
  })

  // 6. Fetch all staging rows for this session
  const { data: stagingRows, error: fetchErr } = await auth.adminClient
    .from('import_staging_rows')
    .select('id, session_id, file_id, company_id, row_index, raw_data, normalized_data, review_status, created_at')
    .eq('session_id', sessionId)
    .eq('company_id', auth.companyId)
    .order('row_index', { ascending: true })

  if (fetchErr || !stagingRows) {
    return NextResponse.json({ code: 'STAGING_FAILED', message: 'Staging行の取得に失敗しました' }, { status: 500 })
  }

  // 7. Apply mapping + validation to each row (in memory)
  let validCount   = 0
  let invalidCount = 0
  let warningCount = 0

  const processedRows = (stagingRows as Record<string, unknown>[]).map(row => {
    const normalizedData = (row['normalized_data'] as Record<string, string | null>) ?? {}

    const { mappedData, unmappedHeaders: rowUnmapped } = applyRowMapping(normalizedData, mappingResult)
    const validation = validateMappedRow(mappedData, entityType, rowUnmapped)

    if (validation.status === 'valid')    validCount++
    else if (validation.status === 'invalid') invalidCount++
    else                                      warningCount++

    const validationErrors = buildRowValidationErrors(validation, rowUnmapped)

    return {
      id:                row['id'] as string,
      session_id:        sessionId,
      file_id:           row['file_id'] as string,
      company_id:        auth.companyId,
      row_index:         row['row_index'] as number,
      raw_data:          row['raw_data'],          // untouched
      normalized_data:   row['normalized_data'],    // untouched
      mapped_data:       mappedData,
      validation_status: validation.status,
      validation_errors: validationErrors,
      review_status:     row['review_status'] as string,
      created_at:        row['created_at'] as string,
      updated_at:        new Date().toISOString(),
    }
  })

  // 8. Batch upsert staging rows (mapped_data + validation updates)
  const totalRows  = processedRows.length
  const batchCount = Math.ceil(totalRows / BATCH_SIZE)

  for (let i = 0; i < batchCount; i++) {
    const batch = processedRows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)

    const { error: upsertErr } = await auth.adminClient
      .from('import_staging_rows')
      .upsert(batch as never, { onConflict: 'id' })

    if (upsertErr) {
      console.error('[map] Batch upsert failed (batch', i, '):', upsertErr.message)
      // Restore session to mapping state for retry
      await auth.adminClient
        .from('import_sessions')
        .update({ status: 'mapping', updated_at: new Date().toISOString() } as never)
        .eq('id', sessionId)
        .eq('company_id', auth.companyId)

      writeAuditLog(auth, sessionId, 'mapping.failed', { failed_batch: i, error: upsertErr.code })
      return NextResponse.json(
        { code: 'MAPPING_FAILED', message: 'Mappingデータの保存に失敗しました。再試行できます。' },
        { status: 500 },
      )
    }
  }

  // 9. Update session counters + status → review_required
  await auth.adminClient
    .from('import_sessions')
    .update({
      status:       'review_required',
      valid_rows:   validCount,
      invalid_rows: invalidCount,
      updated_at:   new Date().toISOString(),
    } as never)
    .eq('id', sessionId)
    .eq('company_id', auth.companyId)

  // 10. Audit (non-blocking)
  writeAuditLog(auth, sessionId, 'mapping.completed', {
    entity_type:       entityType,
    total_rows:        totalRows,
    valid_rows:        validCount,
    invalid_rows:      invalidCount,
    warning_rows:      warningCount,
    unmapped_headers:  mappingResult.unmappedHeaders,
    batch_count:       batchCount,
  })

  return NextResponse.json({
    success: true,
    data: {
      session: { id: sessionId, status: 'review_required' },
      mapping: {
        entity_type:      entityType,
        header_mapping:   mappingResult.headerMapping,
        unmapped_headers: mappingResult.unmappedHeaders,
        total_rows:       totalRows,
        valid_rows:       validCount,
        invalid_rows:     invalidCount,
        warning_rows:     warningCount,
      },
    },
  })
}

// ---- Helper ----

function buildRowValidationErrors(
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
  if (unmappedHeaders.length > 0)            obj['unmapped_headers']  = unmappedHeaders
  return obj
}
