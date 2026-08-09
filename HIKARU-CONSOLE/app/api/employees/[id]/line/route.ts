import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

type EmpRow = { auth_user_id: string | null; company_id: string }
type ProfileLine = { line_user_id: string | null; line_notify_enabled: boolean }

// PATCH /api/employees/[id]/line - LINE連携情報を更新
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: emp } = await auth.adminClient
    .from('employees')
    .select('auth_user_id, company_id')
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .single() as { data: EmpRow | null; error: unknown }

  if (!emp) return NextResponse.json({ error: '従業員が見つかりません' }, { status: 404 })
  if (!emp.auth_user_id) {
    return NextResponse.json({ error: 'この従業員にはログインアカウントが紐付いていません' }, { status: 400 })
  }

  const body = await req.json()
  const update: Record<string, unknown> = {}
  if ('line_user_id' in body)        update.line_user_id        = body.line_user_id ?? null
  if ('line_notify_enabled' in body) update.line_notify_enabled = Boolean(body.line_notify_enabled)

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: '更新するフィールドがありません' }, { status: 400 })
  }

  const { data, error } = await auth.adminClient
    .from('profiles')
    .update(update as never)
    .eq('id', emp.auth_user_id)
    .select('id, line_user_id, line_notify_enabled')
    .single() as { data: ({ id: string } & ProfileLine) | null; error: unknown }

  if (error) return NextResponse.json({ error: String(error) }, { status: 500 })
  return NextResponse.json({ profile: data })
}

// GET /api/employees/[id]/line - LINE連携状態を取得
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: emp } = await auth.adminClient
    .from('employees')
    .select('auth_user_id, company_id')
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .single() as { data: EmpRow | null; error: unknown }

  if (!emp) return NextResponse.json({ error: '従業員が見つかりません' }, { status: 404 })
  if (!emp.auth_user_id) {
    return NextResponse.json({ line_user_id: null, line_notify_enabled: true, has_account: false })
  }

  const { data: profile } = await auth.adminClient
    .from('profiles')
    .select('line_user_id, line_notify_enabled')
    .eq('id', emp.auth_user_id)
    .single() as { data: ProfileLine | null; error: unknown }

  return NextResponse.json({
    line_user_id:        profile?.line_user_id        ?? null,
    line_notify_enabled: profile?.line_notify_enabled ?? true,
    has_account:         true,
  })
}
