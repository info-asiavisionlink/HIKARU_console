import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES, contractStoragePath } from '@/lib/contracts/service'

// POST /api/contracts/[id]/upload - 契約書ファイルアップロード（バージョン管理）
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  // 契約が自社のものか確認
  const { data: contract } = await auth.adminClient
    .from('contracts' as never)
    .select('id, title, company_id')
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .single() as { data: any }

  if (!contract) return NextResponse.json({ error: '契約が見つかりません' }, { status: 404 })

  const formData = await req.formData()
  const file     = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'ファイルが必要です' }, { status: 400 })
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'PDF・画像・Word文書（.docx）のみアップロードできます' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: `ファイルサイズは20MB以下にしてください（現在: ${(file.size / 1024 / 1024).toFixed(1)}MB）` }, { status: 400 })
  }

  // 現在の最大バージョン番号を取得
  const { data: latestFile } = await auth.adminClient
    .from('contract_files' as never)
    .select('version')
    .eq('contract_id', id)
    .order('version', { ascending: false })
    .limit(1)
    .single() as { data: any }

  const nextVersion = (latestFile?.version ?? 0) + 1

  // Storage にアップロード
  const storagePath = contractStoragePath(auth.companyId, id, nextVersion, file.name)
  const arrayBuffer = await file.arrayBuffer()

  const { error: uploadError } = await auth.adminClient.storage
    .from('contracts')
    .upload(storagePath, arrayBuffer, {
      contentType:  file.type,
      cacheControl: '3600',
      upsert:       false,
    })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  // 旧バージョンを is_current = false に更新
  await auth.adminClient
    .from('contract_files' as never)
    .update({ is_current: false } as never)
    .eq('contract_id', id)

  // 新ファイルレコードを挿入
  const { data: fileRecord, error: insertError } = await auth.adminClient
    .from('contract_files' as never)
    .insert({
      contract_id:  id,
      company_id:   auth.companyId,
      version:      nextVersion,
      file_name:    file.name,
      storage_path: storagePath,
      mime_type:    file.type,
      file_size:    file.size,
      is_current:   true,
      uploaded_by:  auth.userId,
    } as never)
    .select()
    .single() as { data: any; error: unknown }

  if (insertError) return NextResponse.json({ error: String(insertError) }, { status: 500 })

  // 監査ログ
  await auth.adminClient.from('contract_events' as never).insert({
    contract_id:  id,
    company_id:   auth.companyId,
    actor_id:     auth.userId,
    event_type:   nextVersion === 1 ? 'file_uploaded' : 'file_replaced',
    new_value:    { version: nextVersion, file_name: file.name, file_size: file.size },
    description:  nextVersion === 1
      ? `契約書をアップロードしました（v${nextVersion}: ${file.name}）`
      : `契約書を差し替えました（v${nextVersion}: ${file.name}）`,
  } as never)

  return NextResponse.json({ file: fileRecord }, { status: 201 })
}
