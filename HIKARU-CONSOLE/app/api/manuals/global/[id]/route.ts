import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

function isGlobalAdmin(companyId: string): boolean {
  const adminCompanyId = process.env.HIKARU_GLOBAL_ADMIN_COMPANY_ID
  if (!adminCompanyId) return false
  return companyId === adminCompanyId
}

function globalForbidden() {
  return NextResponse.json(
    { error: 'HIKARU標準マニュアルの管理権限がありません' },
    { status: 403 }
  )
}

// ============================================================
// PATCH /api/manuals/global/[id] — Global Manual更新
// 対象がGlobal (company_id IS NULL, project_id IS NULL) であることをサーバー側確認。
// Scope escalation防止: company_id / project_id の変更を拒否。
// ============================================================
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth   = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!isGlobalAdmin(auth.companyId)) return globalForbidden()

  const admin = auth.adminClient as AnyClient

  // 対象がGlobalであることをサーバー側確認（Scope escalation防止）
  const { data: existing } = await admin
    .from('manuals')
    .select('id, company_id, project_id')
    .eq('id', id)
    .is('company_id', null)
    .is('project_id', null)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'Global Manualが見つかりません' }, { status: 404 })
  }

  const body = await req.json()
  // company_id / project_id は変更禁止（Scope escalation防止）
  const allowed = ['title', 'type', 'content', 'category', 'order_num']
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }

  const { data, error } = await admin
    .from('manuals')
    .update(patch)
    .eq('id', id)
    .is('company_id', null)
    .is('project_id', null)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// ============================================================
// DELETE /api/manuals/global/[id] — Global Manual削除
// 対象がGlobal (company_id IS NULL, project_id IS NULL) であることをサーバー側確認。
// ============================================================
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth   = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!isGlobalAdmin(auth.companyId)) return globalForbidden()

  const admin = auth.adminClient as AnyClient

  // 対象がGlobalであることをサーバー側確認
  const { error } = await admin
    .from('manuals')
    .delete()
    .eq('id', id)
    .is('company_id', null)
    .is('project_id', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
