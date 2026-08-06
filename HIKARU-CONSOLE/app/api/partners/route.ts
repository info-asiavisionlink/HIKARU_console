import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// GET /api/partners  - 協力業者一覧
export async function GET(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { companyId, adminClient: admin } = auth

  const { searchParams } = new URL(req.url)
  const search   = searchParams.get('search') ?? ''
  const status   = searchParams.get('status') ?? ''
  const page     = parseInt(searchParams.get('page') ?? '1')
  const pageSize = parseInt(searchParams.get('pageSize') ?? '20')
  let query = admin
    .from('partners')
    .select('*', { count: 'exact' })
    .eq('company_id', companyId)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (search) {
    query = query.or(
      `company_name.ilike.%${search}%,company_name_kana.ilike.%${search}%,contact_person_name.ilike.%${search}%,email.ilike.%${search}%`
    )
  }
  if (status) {
    query = query.eq('status', status)
  }

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, count: count ?? 0 })
}

// POST /api/partners  - 協力業者登録
export async function POST(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { companyId, adminClient: admin } = auth

  const body = await req.json()
  const { loginEmail, loginPassword, ...partnerFields } = body
  let authUserId: string | null = null

  if (loginEmail && loginPassword) {
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: loginEmail,
      password: loginPassword,
      email_confirm: true,
      user_metadata: {
        name: partnerFields.contact_person_name ?? partnerFields.company_name,
        role: 'worker',
        company_id: companyId,
      },
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    authUserId = authUser.user.id

    await admin.from('profiles').update({
      company_id: companyId,
      role: 'worker',
      entity_type: 'partner',
    }).eq('id', authUserId)
  }

  const { data: partner, error: partnerError } = await admin
    .from('partners')
    .insert({
      company_id: companyId,
      auth_user_id: authUserId,
      ...partnerFields,
    })
    .select()
    .single()

  if (partnerError) {
    if (authUserId) await admin.auth.admin.deleteUser(authUserId)
    return NextResponse.json({ error: partnerError.message }, { status: 500 })
  }

  if (authUserId) {
    await admin.from('profiles').update({ entity_id: partner.id }).eq('id', authUserId)
  }

  return NextResponse.json({ data: partner }, { status: 201 })
}
