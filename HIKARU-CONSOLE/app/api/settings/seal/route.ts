import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, type AuthContext } from '@/lib/supabase/server-admin'

const BUCKET   = 'company-assets'
const MAX_BYTES = 1 * 1024 * 1024  // 1 MB
const PNG_MAGIC = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] as const

async function isAdmin(auth: AuthContext): Promise<boolean> {
  const { data } = await auth.adminClient
    .from('profiles')
    .select('role')
    .eq('id', auth.userId)
    .single()
  return (data as { role?: string } | null)?.role === 'admin'
}

// POST /api/settings/seal — 電子印アップロード（admin only）
export async function POST(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await isAdmin(auth))) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'ファイルが必要です' }, { status: 400 })

  // MIME type check
  if (file.type !== 'image/png') {
    return NextResponse.json({ error: 'PNGファイルのみアップロードできます' }, { status: 400 })
  }

  // File size check
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `ファイルサイズは1MB以下にしてください（現在: ${(file.size / 1024 / 1024).toFixed(2)}MB）` },
      { status: 400 }
    )
  }

  const buf = Buffer.from(await file.arrayBuffer())

  // PNG magic bytes validation（Content-Typeだけを信用しない）
  const isPNG = PNG_MAGIC.every((b, i) => buf[i] === b)
  if (!isPNG) {
    return NextResponse.json({ error: 'ファイルの内容がPNGではありません' }, { status: 400 })
  }

  const path = `${auth.companyId}/seal.png`

  // Private Storage へ upload（upsert: true で上書き可）
  const { error: uploadError } = await auth.adminClient.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: 'image/png', upsert: true })

  if (uploadError) {
    return NextResponse.json(
      { error: `アップロードに失敗しました: ${uploadError.message}` },
      { status: 500 }
    )
  }

  // Storage 成功後に DB 更新
  const { error: dbError } = await auth.adminClient
    .from('companies')
    .update({ seal_path: path } as never)
    .eq('id', auth.companyId)

  if (dbError) {
    // DB 失敗時は Storage をロールバック
    console.error('[seal] DB update failed after Storage upload — rolling back:', dbError)
    await auth.adminClient.storage.from(BUCKET).remove([path])
    return NextResponse.json({ error: 'DB更新に失敗しました。Storageをロールバックしました。' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/settings/seal — 電子印削除（admin only）
export async function DELETE() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await isAdmin(auth))) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // 現在の seal_path を確認
  const { data: company } = await auth.adminClient
    .from('companies')
    .select('seal_path')
    .eq('id', auth.companyId)
    .single()

  const currentPath = (company as { seal_path?: string | null } | null)?.seal_path
  if (!currentPath) {
    // 既に未登録 — 冪等成功
    return NextResponse.json({ success: true })
  }

  // Storage 削除
  const { error: removeError } = await auth.adminClient.storage
    .from(BUCKET)
    .remove([currentPath])

  if (removeError) {
    console.error('[seal] Storage remove failed:', removeError)
    return NextResponse.json(
      { error: `Storage削除に失敗しました: ${removeError.message}` },
      { status: 500 }
    )
  }

  // Storage 削除成功後に DB を NULL 更新
  const { error: dbError } = await auth.adminClient
    .from('companies')
    .update({ seal_path: null } as never)
    .eq('id', auth.companyId)

  if (dbError) {
    console.error('[seal] DB update failed after Storage remove:', dbError)
    return NextResponse.json({ error: 'DB更新に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
