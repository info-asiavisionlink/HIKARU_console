import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { companyId, adminClient: admin } = auth

  const { password } = await req.json()
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'パスワードは8文字以上で入力してください' }, { status: 400 })
  }

  const { data: partner } = await admin
    .from('partners')
    .select('auth_user_id')
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (!partner?.auth_user_id) {
    return NextResponse.json({ error: 'ログインアカウントが設定されていません' }, { status: 400 })
  }

  const { error } = await admin.auth.admin.updateUserById(partner.auth_user_id, { password })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
