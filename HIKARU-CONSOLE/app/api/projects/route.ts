import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// GET /api/projects
export async function GET(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized', projects: [], count: 0 }, { status: 401 })
  }

  const url      = new URL(req.url)
  const search   = url.searchParams.get('search') ?? ''
  const status   = url.searchParams.get('status') ?? ''
  const clientId = url.searchParams.get('client_id') ?? ''
  const page     = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'))
  const size     = Math.min(100, parseInt(url.searchParams.get('pageSize') ?? '20'))

  // service_role + company_id フィルタ（RLS 無限再帰を完全回避）
  let query = auth.adminClient
    .from('projects')
    .select('*, stores(id, name, clients(id, name))', { count: 'exact' })
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: false })
    .range((page - 1) * size, page * size - 1)

  if (search) {
    query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%,location_name.ilike.%${search}%`)
  }
  if (status) {
    query = query.eq('status', status)
  }
  if (clientId) {
    query = query.eq('client_id', clientId)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message, projects: [], count: 0 }, { status: 500 })
  }

  return NextResponse.json({
    projects: data ?? [],
    count: count ?? 0,
    debug: process.env.NODE_ENV === 'development'
      ? { auth_method: 'service_role_with_company_filter', company_id: auth.companyId }
      : undefined,
  })
}

// POST /api/projects
export async function POST(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // company_id / id / created_at はサーバー側で決定し Body を信頼しない
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { company_id: _cid, id: _id, created_at: _ca, updated_at: _ua, ...safeBody } = await req.json()

  // client_id の所属確認（他社クライアントへの紐付け防止）
  if (safeBody.client_id) {
    const { data: clientCheck } = await auth.adminClient
      .from('clients')
      .select('id, company_id')
      .eq('id', safeBody.client_id)
      .single()

    if (!clientCheck) return NextResponse.json({ error: 'クライアントが見つかりません' }, { status: 404 })
    if (clientCheck.company_id !== auth.companyId) {
      return NextResponse.json({ error: '他社のクライアントを指定することはできません' }, { status: 403 })
    }
  }

  const { data, error } = await auth.adminClient
    .from('projects')
    .insert({ ...safeBody, company_id: auth.companyId, status: 'active' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ project: data }, { status: 201 })
}
