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

// GET /api/client-accounts
export async function GET(req: NextRequest) {
  const companyId = await getAdminCompanyId()
  if (!companyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')

  const admin = createAdminClient()
  let query = admin
    .from('client_portal_accounts')
    .select(`
      id, login_id, contact_name, is_active, last_login_at, created_at,
      clients ( id, name ),
      client_project_permissions ( project_id, projects ( name ) )
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (clientId) query = query.eq('client_id', clientId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST /api/client-accounts
export async function POST(req: NextRequest) {
  const companyId = await getAdminCompanyId()
  if (!companyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    loginId,
    password,
    contactName,
    email,
    clientId,
    projectIds = [],
    permissions = {},
  } = body

  if (!loginId || !password || !contactName || !clientId) {
    return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'パスワードは8文字以上で入力してください' }, { status: 400 })
  }

  const admin = createAdminClient()

  // LoginID → internal email: CLT-0001 → clt-0001@hikaru.client
  const internalEmail = `${loginId.toLowerCase()}@hikaru.client`

  // Supabase auth ユーザー作成
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: internalEmail,
    password,
    email_confirm: true,
    user_metadata: { name: contactName, role: 'client', company_id: companyId },
  })

  if (authError) {
    if (authError.message.includes('already been registered')) {
      return NextResponse.json({ error: 'このログインIDはすでに使用されています' }, { status: 409 })
    }
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  // トリガーが profiles を自動作成するため、company_id を UPDATE で補完
  const { error: profileError } = await admin.from('profiles').update({
    company_id: companyId,
    email: email || internalEmail,
    name: contactName,
    role: 'client',
  }).eq('id', authUser.user.id)

  if (profileError) {
    await admin.auth.admin.deleteUser(authUser.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  // client_portal_accounts 作成
  const { data: account, error: accountError } = await admin
    .from('client_portal_accounts')
    .insert({
      profile_id: authUser.user.id,
      company_id: companyId,
      client_id: clientId,
      login_id: loginId.toUpperCase(),
      contact_name: contactName,
      is_active: true,
    })
    .select()
    .single()

  if (accountError) {
    await admin.auth.admin.deleteUser(authUser.user.id)
    return NextResponse.json({ error: accountError.message }, { status: 500 })
  }

  // 案件権限付与
  if (projectIds.length > 0) {
    const permRecords = projectIds.map((pid: string) => ({
      portal_account_id: (account as any).id,
      project_id: pid,
      can_view_reports:  permissions[pid]?.reports  ?? true,
      can_view_photos:   permissions[pid]?.photos   ?? true,
      can_view_timeline: permissions[pid]?.timeline ?? true,
      can_download_pdf:  permissions[pid]?.pdf      ?? true,
    }))

    await admin.from('client_project_permissions').insert(permRecords)
  }

  return NextResponse.json({ data: account }, { status: 201 })
}
