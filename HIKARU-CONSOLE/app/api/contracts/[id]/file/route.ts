import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// GET /api/contracts/[id]/file?version=N  - Signed URL 取得（デフォルト: 最新）
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  // 契約が自社のものか確認
  const { data: contract } = await auth.adminClient
    .from('contracts' as never)
    .select('id, company_id')
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .single() as { data: any }

  if (!contract) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

  const versionParam = req.nextUrl.searchParams.get('version')

  let fileQuery = auth.adminClient
    .from('contract_files' as never)
    .select('*')
    .eq('contract_id', id)

  if (versionParam) {
    (fileQuery as any) = (fileQuery as any).eq('version', Number(versionParam))
  } else {
    (fileQuery as any) = (fileQuery as any).eq('is_current', true)
  }

  const { data: fileRecord } = await fileQuery.single() as { data: any }

  if (!fileRecord) return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 404 })

  // Signed URL（10分間有効）
  const { data: signed, error: signError } = await auth.adminClient.storage
    .from('contracts')
    .createSignedUrl(fileRecord.storage_path, 600)

  if (signError) return NextResponse.json({ error: signError.message }, { status: 500 })

  return NextResponse.json({
    url:          signed.signedUrl,
    file_name:    fileRecord.file_name,
    version:      fileRecord.version,
    mime_type:    fileRecord.mime_type,
    file_size:    fileRecord.file_size,
    uploaded_at:  fileRecord.created_at,
  })
}
