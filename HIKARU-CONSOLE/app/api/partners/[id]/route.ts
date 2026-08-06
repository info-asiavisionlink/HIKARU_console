import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { companyId, adminClient: admin } = auth
  const { data, error } = await admin
    .from('partners')
    .select('*')
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  let loginEmail: string | null = null
  if (data.auth_user_id) {
    const { data: authUser } = await admin.auth.admin.getUserById(data.auth_user_id)
    loginEmail = authUser.user?.email ?? null
  }

  const { data: assignments } = await admin
    .from('project_assignments')
    .select('project_id, assigned_at, projects(id, name, code, status)')
    .eq('assignee_type', 'partner')
    .eq('assignee_id', id)

  return NextResponse.json({ data: { ...data, loginEmail, assignments: assignments ?? [] } })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { companyId, adminClient: admin } = auth

  const body = await req.json()

  const { data, error } = await admin
    .from('partners')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', companyId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { companyId, adminClient: admin } = auth

  // 削除前に auth_user_id を取得
  const { data: partner, error: fetchErr } = await admin
    .from('partners')
    .select('auth_user_id')
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 404 })

  // 担当案件のアサイン情報を削除
  await admin
    .from('project_assignments')
    .delete()
    .eq('assignee_type', 'partner')
    .eq('assignee_id', id)

  // 協力業者レコードを物理削除
  const { error: delErr } = await admin
    .from('partners')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  // Supabase Auth ユーザーも完全削除
  if ((partner as any)?.auth_user_id) {
    await admin.auth.admin.deleteUser((partner as any).auth_user_id)
  }

  return NextResponse.json({ success: true })
}
