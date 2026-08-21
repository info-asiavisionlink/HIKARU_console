import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

const ALLOWED_CLIENT_POST_FIELDS = ['name', 'code', 'phone', 'email', 'address', 'contact_name', 'notes'] as const

// POST /api/clients — 顧客新規登録（JARVIS Voice経由のconfirm-actionから呼ばれる）
export async function POST(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = await req.json()

  // ホワイトリスト: 請求系・権限系フィールドはVoice経路から受け取らない
  const insertBody: Record<string, string | null> = {}
  for (const field of ALLOWED_CLIENT_POST_FIELDS) {
    if (raw[field] !== undefined) {
      insertBody[field] = typeof raw[field] === 'string' ? (raw[field].trim() || null) : null
    }
  }

  if (!insertBody.name) {
    return NextResponse.json({ error: '顧客名は必須です' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await auth.adminClient
    .from('clients')
    .insert({ ...insertBody, company_id: auth.companyId } as any)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ client: data }, { status: 201 })
}

export async function GET(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized', clients: [], count: 0 }, { status: 401 })
  }

  const url    = new URL(req.url)
  const search = url.searchParams.get('search') ?? ''
  const page   = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'))
  const size   = Math.min(100, parseInt(url.searchParams.get('pageSize') ?? '20'))

  // RLSクライアントが使える場合はそのまま、なければ admin + company_id フィルタ
  const client = auth.rlsClient ?? auth.adminClient

  let query = client
    .from('clients')
    .select('*', { count: 'exact' })
    .order('name', { ascending: true })
    .range((page - 1) * size, page * size - 1)

  // RLS が効かない場合は company_id を明示フィルタ
  if (!auth.rlsClient) {
    query = query.eq('company_id', auth.companyId)
  }
  if (search) {
    query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%,email.ilike.%${search}%`)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message, clients: [], count: 0 }, { status: 500 })
  }

  return NextResponse.json({
    clients: data ?? [],
    count: count ?? 0,
    debug: {
      auth_method: auth.rlsClient ? 'session_cookie' : (process.env.NODE_ENV === 'development' ? 'fallback_uid' : undefined),
      company_id: process.env.NODE_ENV === 'development' ? auth.companyId : undefined,
    }
  })
}
