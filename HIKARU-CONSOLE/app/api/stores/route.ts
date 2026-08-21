import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// GET /api/stores — JARVIS案件Voice用。担当者解決のREADのみ。
export async function GET(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized', stores: [], count: 0 }, { status: 401 })
  }

  const url        = new URL(req.url)
  const search     = url.searchParams.get('search') ?? ''
  const clientId   = url.searchParams.get('client_id') ?? ''
  const activeOnly = url.searchParams.get('active_only') !== 'false'

  let query = auth.adminClient
    .from('stores')
    .select('id, name, client_id, address, is_active, clients(id, name)', { count: 'exact' })
    .eq('company_id', auth.companyId)
    .order('name', { ascending: true })
    .limit(50)

  if (search)     query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`)
  if (clientId)   query = query.eq('client_id', clientId)
  if (activeOnly) query = query.eq('is_active', true)

  const { data, count, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message, stores: [], count: 0 }, { status: 500 })
  }
  return NextResponse.json({ stores: data ?? [], count: count ?? 0 })
}
