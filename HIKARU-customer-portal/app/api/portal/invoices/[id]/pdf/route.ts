import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/portal/invoices/[id]/pdf
// 顧客ポータル用 PDF署名URL取得 → リダイレクト
// 自社の公開済み書類のみアクセス可能（RLS相当の検証をサーバーサイドで実施）
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const cookieStore = await cookies()
  const uid = cookieStore.get('hk_cp_uid')?.value

  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // ポータルアカウント取得
  const { data: account } = await admin
    .from('client_portal_accounts')
    .select('client_id, company_id')
    .eq('profile_id', uid)
    .eq('is_active', true)
    .single()

  if (!account) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 書類が自社・自顧客・公開済みであることを確認（テナント分離）
  const { data: invoice } = await admin
    .from('invoices')
    .select('pdf_path, published_to_portal, client_id, company_id, status')
    .eq('id', id)
    .eq('company_id', account.company_id)
    .eq('client_id', account.client_id)
    .eq('published_to_portal', true)
    .single()

  if (!invoice) return NextResponse.json({ error: 'Not found or not accessible' }, { status: 404 })
  if (!invoice.pdf_path) return NextResponse.json({ error: 'PDF が生成されていません' }, { status: 404 })

  // 署名URL発行（1時間有効）
  const { data: signed, error } = await admin.storage
    .from('documents')
    .createSignedUrl(invoice.pdf_path, 3600)

  if (error || !signed) {
    return NextResponse.json({ error: 'PDF URLの取得に失敗しました' }, { status: 500 })
  }

  // ダウンロードとしてリダイレクト
  return NextResponse.redirect(signed.signedUrl)
}
