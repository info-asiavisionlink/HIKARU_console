import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { requireAdmin, getOwnedSession, writeAuditLog } from '@/lib/import/helpers'
import { extractFile, MAX_ROWS, MAX_COLUMNS } from '@/lib/import/extractor'
import { getExtension } from '@/lib/import/file-security'

const BUCKET     = 'hikaru-imports'
const BATCH_SIZE = 250   // rows per Supabase INSERT batch

// POST /api/import/sessions/[id]/extract
//
// アップロード済みファイルをCSV/XLSXとして安全に読み取り、
// import_staging_rows へ保存する。
//
// 遷移: uploaded → extracting → mapping
// 失敗: → uploaded (re-try可)
//
// 設計:
//   - company_idはauth.companyIdのみ使用
//   - storage_pathはimport_filesDBレコードから取得（リクエストから受け取らない）
//   - Formula evaluation禁止 (SheetJS cellFormula:false)
//   - raw_data不変
//   - Batch INSERT (BATCH_SIZE行/回)
//   - 失敗時は今回のstaging rows削除 → sessionをuploadedへ戻す
//   - OpenAI calls: 0
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

  if (session.status !== 'uploaded') {
    return NextResponse.json(
      { code: 'INVALID_SESSION_STATE', message: `Extractionはuploaded状態のセッションのみ可能です (現在: ${session.status})` },
      { status: 409 },
    )
  }

  // 4. Fetch import_files record (storage_path はDBから取得、リクエストから信用しない)
  const { data: fileRecord, error: fileErr } = await auth.adminClient
    .from('import_files')
    .select('id, storage_path, mime_type, file_size_bytes, original_filename')
    .eq('session_id', sessionId)
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (fileErr || !fileRecord) {
    return NextResponse.json(
      { code: 'FILE_NOT_FOUND', message: 'ファイルレコードが見つかりません' },
      { status: 404 },
    )
  }

  const fr = fileRecord as Record<string, unknown>

  // 5. Clean up any existing staging rows (冪等性: 再試行時のゴミをクリア)
  await auth.adminClient
    .from('import_staging_rows')
    .delete()
    .eq('session_id', sessionId)
    .eq('company_id', auth.companyId)

  // 6. Session → extracting
  await auth.adminClient
    .from('import_sessions')
    .update({ status: 'extracting', updated_at: new Date().toISOString() } as never)
    .eq('id', sessionId)
    .eq('company_id', auth.companyId)

  writeAuditLog(auth, sessionId, 'extraction.started', {
    file_id:    fr.id,
    file_size:  fr.file_size_bytes,
  })

  // 7. Download file from Private Storage
  const { data: downloadData, error: downloadErr } = await auth.adminClient.storage
    .from(BUCKET)
    .download(fr.storage_path as string)

  if (downloadErr || !downloadData) {
    console.error('[extract] Storage download failed:', downloadErr?.message)
    await resetSession(auth, sessionId, 'storage_download_failed')
    return NextResponse.json(
      { code: 'UPLOAD_FAILED', message: 'ファイルのダウンロードに失敗しました' },
      { status: 500 },
    )
  }

  // Blob → Buffer
  const arrayBuffer = await downloadData.arrayBuffer()
  const buffer      = Buffer.from(arrayBuffer)

  // 8. Parse (CSV or XLSX)
  const ext    = getExtension(fr.original_filename as string)
  const result = extractFile(buffer, ext)

  if (result.errors.length > 0) {
    const errMsg = result.errors[0]
    await resetSession(auth, sessionId, errMsg)
    writeAuditLog(auth, sessionId, 'extraction.failed', {
      file_id: fr.id,
      error:   errMsg,
    })
    const code = errMsg.includes('空') ? 'EMPTY_FILE'
               : errMsg.includes('列数') ? 'COLUMN_LIMIT_EXCEEDED'
               : errMsg.includes('行数') ? 'ROW_LIMIT_EXCEEDED'
               : 'PARSE_FAILED'
    return NextResponse.json({ code, message: errMsg }, { status: 422 })
  }

  if (result.meta.rowCount === 0) {
    await resetSession(auth, sessionId, 'no_data_rows')
    return NextResponse.json(
      { code: 'EMPTY_FILE', message: 'データ行がありません (ヘッダー行のみです)' },
      { status: 422 },
    )
  }

  // 9. Batch INSERT into import_staging_rows
  // Empty rows are included (isEmpty flag in validation_errors) — preserves row_index fidelity
  const allRows   = result.rows
  const batchCount = Math.ceil(allRows.length / BATCH_SIZE)
  let   insertedCount = 0

  for (let batchIdx = 0; batchIdx < batchCount; batchIdx++) {
    const batch = allRows.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE)

    const insertRows = batch.map(row => ({
      session_id:        sessionId,
      file_id:           fr.id as string,
      company_id:        auth.companyId,
      row_index:         row.rowIndex,
      raw_data:          row.rawData,          // key=original header, value=original cell
      normalized_data:   row.normalizedData,   // key=normalized header, value=normalized cell
      mapped_data:       null,
      validation_status: row.isEmpty ? 'warning'
                       : row.formulaRisks.length > 0 ? 'warning'
                       : 'valid',
      validation_errors: buildValidationErrors(row, result.meta),
    }))

    const { error: batchErr } = await auth.adminClient
      .from('import_staging_rows')
      .insert(insertRows as never)

    if (batchErr) {
      console.error('[extract] Batch insert failed (batch', batchIdx, '):', batchErr.message)
      // Compensation: delete all staging rows inserted so far
      await auth.adminClient
        .from('import_staging_rows')
        .delete()
        .eq('session_id', sessionId)
        .eq('company_id', auth.companyId)

      await resetSession(auth, sessionId, `batch_insert_failed_batch_${batchIdx}`)
      writeAuditLog(auth, sessionId, 'extraction.failed', {
        file_id:        fr.id,
        failed_batch:   batchIdx,
        inserted_before: insertedCount,
        error:          batchErr.code,
      })
      return NextResponse.json(
        { code: 'STAGING_FAILED', message: 'Stagingデータの保存中にエラーが発生しました。セッションをリセットしました。再試行できます。' },
        { status: 500 },
      )
    }

    insertedCount += batch.length
  }

  // 10. Update import_files with extraction metadata (validation_errors → extract metadata)
  await auth.adminClient
    .from('import_files')
    .update({
      row_count:         result.meta.rowCount,
      validation_status: 'valid',
      validation_errors: {
        raw_headers:           result.meta.rawHeaders,
        normalized_headers:    result.meta.normalizedHeaders,
        duplicate_headers:     result.meta.duplicateHeaders,
        empty_headers:         result.meta.emptyHeaders,
        formula_warning_count: result.meta.formulaWarningCount,
        sheet_count:           result.meta.sheetCount,
        selected_sheet:        result.meta.selectedSheet,
        parser_warnings:       result.warnings,
      },
    } as never)
    .eq('id', fr.id as string)
    .eq('company_id', auth.companyId)

  // 11. Update import_sessions with row counts + status → mapping
  const validRows   = result.rows.filter(r => !r.isEmpty && r.formulaRisks.length === 0).length
  const warningRows = result.rows.filter(r => r.isEmpty || r.formulaRisks.length > 0).length

  await auth.adminClient
    .from('import_sessions')
    .update({
      status:       'mapping',
      total_rows:   result.meta.rowCount,
      valid_rows:   validRows,
      invalid_rows: 0,
      duplicate_rows: 0,
      error_message: null,
      updated_at:   new Date().toISOString(),
    } as never)
    .eq('id', sessionId)
    .eq('company_id', auth.companyId)

  // 12. Audit (non-blocking)
  writeAuditLog(auth, sessionId, 'extraction.completed', {
    file_id:              fr.id,
    row_count:            result.meta.rowCount,
    column_count:         result.meta.columnCount,
    formula_warning_count: result.meta.formulaWarningCount,
    warning_rows:         warningRows,
    batch_count:          batchCount,
    parser_warnings_count: result.warnings.length,
  })

  return NextResponse.json({
    success: true,
    data: {
      session: { id: sessionId, status: 'mapping' },
      extraction: {
        row_count:            result.meta.rowCount,
        column_count:         result.meta.columnCount,
        normalized_headers:   result.meta.normalizedHeaders,
        formula_warning_count: result.meta.formulaWarningCount,
        duplicate_headers:    result.meta.duplicateHeaders,
        empty_headers:        result.meta.emptyHeaders,
        warnings:             result.warnings,
        selected_sheet:       result.meta.selectedSheet,
        sheet_count:          result.meta.sheetCount,
      },
    },
  })
}

// ---- Helpers ----

async function resetSession(
  auth: Awaited<ReturnType<typeof getAuthContext>>,
  sessionId: string,
  reason: string,
) {
  if (!auth) return
  await auth.adminClient
    .from('import_sessions')
    .update({
      status:        'uploaded',
      error_message: reason,
      updated_at:    new Date().toISOString(),
    } as never)
    .eq('id', sessionId)
    .eq('company_id', auth.companyId)
}

function buildValidationErrors(
  row: { isEmpty: boolean; formulaRisks: string[] },
  meta: { normalizedHeaders: string[] },
): Record<string, unknown> | null {
  if (!row.isEmpty && row.formulaRisks.length === 0) return null

  const obj: Record<string, unknown> = {}
  if (row.isEmpty)               obj.empty_row      = true
  if (row.formulaRisks.length > 0) obj.formula_risks = row.formulaRisks
  return obj
}
