import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { requireAdmin, getOwnedSession } from '@/lib/import/helpers'
import { listXlsxSheets } from '@/lib/import/extractor'
import { getExtension } from '@/lib/import/file-security'

const BUCKET = 'hikaru-imports'

// GET /api/import/sessions/[id]/sheets
//
// アップロード済み XLSX ファイルの sheet 一覧を返す (Phase U4)。
// - Session must be 'uploaded' (extract 前)
// - CSV の場合は sheets: [] を返し、sheet 選択 UI を skip 可能
// - Storage からファイルを downlaod するが業務 table への write は一切しない
//
// Response:
//   {
//     success: true,
//     data: {
//       source_type: 'csv' | 'xlsx',
//       sheets: [
//         { name: string, index: number, rowCount: number, columnCount: number }
//       ]
//     }
//   }
export async function GET(
  _req: NextRequest,
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

  if (session.status !== 'uploaded') {
    return NextResponse.json(
      { code: 'INVALID_SESSION_STATE', message: `シート一覧は uploaded 状態のみ取得可能です (現在: ${session.status})` },
      { status: 409 },
    )
  }

  const sourceType = session.source_type as string

  // CSV は sheet 概念なし
  if (sourceType === 'csv') {
    return NextResponse.json({
      success: true,
      data: { source_type: 'csv', sheets: [] },
    })
  }

  const { data: fileRecord, error: fileErr } = await auth.adminClient
    .from('import_files')
    .select('id, storage_path, original_filename')
    .eq('session_id', sessionId)
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (fileErr || !fileRecord) {
    return NextResponse.json({ code: 'FILE_NOT_FOUND', message: 'ファイルレコードが見つかりません' }, { status: 404 })
  }

  const fr = fileRecord as Record<string, unknown>
  const ext = getExtension(fr.original_filename as string)

  if (ext !== 'xlsx') {
    return NextResponse.json({
      success: true,
      data: { source_type: sourceType, sheets: [] },
    })
  }

  const { data: downloadData, error: downloadErr } = await auth.adminClient.storage
    .from(BUCKET)
    .download(fr.storage_path as string)

  if (downloadErr || !downloadData) {
    return NextResponse.json({ code: 'UPLOAD_FAILED', message: 'ファイルのダウンロードに失敗しました' }, { status: 500 })
  }

  const arrayBuffer = await downloadData.arrayBuffer()
  const buffer      = Buffer.from(arrayBuffer)

  const { sheets, errors } = listXlsxSheets(buffer)
  if (errors.length > 0) {
    return NextResponse.json({ code: 'PARSE_FAILED', message: errors[0] }, { status: 422 })
  }

  return NextResponse.json({
    success: true,
    data: {
      source_type: 'xlsx',
      sheets,
    },
  })
}
