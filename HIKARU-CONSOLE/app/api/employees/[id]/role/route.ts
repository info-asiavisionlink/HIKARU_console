import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// PATCH /api/employees/[id]/role  { role: 'admin' | 'worker' }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { companyId, adminClient: admin } = auth

  const { role } = await req.json() as { role: 'admin' | 'worker' }
  if (role !== 'admin' && role !== 'worker') {
    return NextResponse.json({ error: 'role must be admin or worker' }, { status: 400 })
  }

  // auth_user_id を取得
  const { data: emp } = await admin
    .from('employees')
    .select('auth_user_id')
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (!(emp as any)?.auth_user_id) {
    return NextResponse.json({ error: 'この従業員はログインアカウントがありません' }, { status: 400 })
  }

  const authUserId = (emp as any).auth_user_id as string

  // profiles.role を更新
  const { error: profileError } = await admin
    .from('profiles')
    .update({ role })
    .eq('id', authUserId)

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  // Supabase Auth のuser_metadataも更新（任意だが念のため）
  await admin.auth.admin.updateUserById(authUserId, {
    user_metadata: { role },
  })

  return NextResponse.json({ success: true, role })
}
