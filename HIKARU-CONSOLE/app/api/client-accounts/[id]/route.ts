import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

async function getAdminCompanyId() {
  const cookieStore = await cookies()
  const uid = cookieStore.get('hk_c_uid')?.value
  if (!uid) return null
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('company_id, role').eq('id', uid).single()
  if (!data || data.role !== 'admin') return null
  return data.company_id as string
}

// GET /api/client-accounts/:id
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const companyId = await getAdminCompanyId()
  if (!companyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('client_portal_accounts')
    .select(`
      id, login_id, contact_name, is_active, last_login_at, created_at, profile_id,
      clients ( id, name ),
      client_project_permissions (
        id, project_id, can_view_reports, can_view_photos, can_view_timeline, can_download_pdf,
        projects ( id, name )
      )
    `)
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

// PATCH /api/client-accounts/:id
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const companyId = await getAdminCompanyId()
  if (!companyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const { contactName, isActive, password, projectIds, permissions } = body

  const admin = createAdminClient()

  // アカウント基本情報更新
  const updates: any = {}
  if (contactName !== undefined) updates.contact_name = contactName
  if (isActive !== undefined)    updates.is_active    = isActive

  if (Object.keys(updates).length > 0) {
    const { error } = await admin
      .from('client_portal_accounts')
      .update(updates)
      .eq('id', id)
      .eq('company_id', companyId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // パスワード変更
  if (password) {
    const { data: account } = await admin
      .from('client_portal_accounts')
      .select('profile_id')
      .eq('id', id)
      .single()

    if (account) {
      await admin.auth.admin.updateUserById(account.profile_id, { password })
    }
  }

  // 案件権限の更新（全削除 → 再挿入）
  if (projectIds !== undefined) {
    await admin.from('client_project_permissions').delete().eq('portal_account_id', id)

    if (projectIds.length > 0) {
      const permRecords = projectIds.map((pid: string) => ({
        portal_account_id: id,
        project_id: pid,
        can_view_reports:  permissions?.[pid]?.reports  ?? true,
        can_view_photos:   permissions?.[pid]?.photos   ?? true,
        can_view_timeline: permissions?.[pid]?.timeline ?? true,
        can_download_pdf:  permissions?.[pid]?.pdf      ?? true,
      }))
      await admin.from('client_project_permissions').insert(permRecords)
    }
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/client-accounts/:id  （アカウント停止 = auth user削除）
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const companyId = await getAdminCompanyId()
  if (!companyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: account } = await admin
    .from('client_portal_accounts')
    .select('profile_id')
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (!account) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // auth user削除（cascadeでprofiles, client_portal_accountsも削除）
  const { error } = await admin.auth.admin.deleteUser(account.profile_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
