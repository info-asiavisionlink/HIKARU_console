import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { calculateDeadlineInfo } from '@/lib/contracts/service'

// GET /api/contracts - 契約一覧 + KPI
export async function GET(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const p               = req.nextUrl.searchParams
  const search          = p.get('search')
  const status          = p.get('status')
  const contract_type   = p.get('contract_type')
  const counterparty    = p.get('counterparty_type')
  const auto_renewal    = p.get('auto_renewal')
  const expiring_days   = p.get('expiring_days')  // '30' | '60' | '7'

  let query = auth.adminClient
    .from('contracts' as never)
    .select(`
      id, title, contract_number, counterparty_type, contract_type,
      start_date, end_date, renewal_date, auto_renewal, status,
      published_to_portal, signed_at, sign_provider,
      notes, created_at, updated_at,
      clients:client_id   (id, name),
      partners:partner_id (id, company_name),
      projects:project_id (id, name)
    `)
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: false })

  if (status)         (query as any) = (query as any).eq('status', status)
  if (contract_type)  (query as any) = (query as any).eq('contract_type', contract_type)
  if (counterparty)   (query as any) = (query as any).eq('counterparty_type', counterparty)
  if (auto_renewal === 'true')  (query as any) = (query as any).eq('auto_renewal', true)
  if (auto_renewal === 'false') (query as any) = (query as any).eq('auto_renewal', false)

  if (search) {
    (query as any) = (query as any).or(
      `title.ilike.%${search}%,contract_number.ilike.%${search}%`
    )
  }

  const { data, error } = await query as { data: any[] | null; error: unknown }
  if (error) return NextResponse.json({ error: String(error) }, { status: 500 })

  let contracts = (data ?? []).map(c => ({
    ...c,
    deadline: calculateDeadlineInfo(c.end_date),
  }))

  // 期限フィルター
  if (expiring_days) {
    const days = Number(expiring_days)
    contracts = contracts.filter(c =>
      c.deadline.daysUntilExpiry !== null &&
      c.deadline.daysUntilExpiry >= 0 &&
      c.deadline.daysUntilExpiry <= days
    )
  }

  // KPI
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const in30Days = new Date(today)
  in30Days.setDate(in30Days.getDate() + 30)

  const kpi = {
    total:         contracts.length,
    active:        contracts.filter(c => c.status === 'active' || c.status === 'signed').length,
    expiring30d:   contracts.filter(c =>
      c.end_date &&
      c.deadline.daysUntilExpiry !== null &&
      c.deadline.daysUntilExpiry >= 0 &&
      c.deadline.daysUntilExpiry <= 30
    ).length,
    expired:       contracts.filter(c => c.status === 'expired' || (c.deadline.urgency === 'expired' && c.status !== 'terminated')).length,
    auto_renewal:  contracts.filter(c => c.auto_renewal).length,
    client_count:  contracts.filter(c => c.counterparty_type === 'client').length,
    partner_count: contracts.filter(c => c.counterparty_type === 'partner').length,
  }

  return NextResponse.json({ contracts, kpi })
}

// POST /api/contracts - 契約作成
export async function POST(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    title, contract_number, counterparty_type, client_id, partner_id, project_id,
    contract_type = 'service', start_date, end_date, renewal_date, auto_renewal = false,
    notes, internal_memo,
  } = body

  if (!title?.trim())         return NextResponse.json({ error: '契約名は必須です' }, { status: 400 })
  if (!counterparty_type)     return NextResponse.json({ error: '契約相手種別は必須です' }, { status: 400 })
  if (counterparty_type === 'client'  && !client_id)  return NextResponse.json({ error: '顧客を選択してください' }, { status: 400 })
  if (counterparty_type === 'partner' && !partner_id) return NextResponse.json({ error: '協力業者を選択してください' }, { status: 400 })

  const insertPayload = {
    company_id:       auth.companyId,
    title:            title.trim(),
    contract_number:  contract_number?.trim() || null,
    counterparty_type,
    client_id:        counterparty_type === 'client'  ? client_id  : null,
    partner_id:       counterparty_type === 'partner' ? partner_id : null,
    project_id:       project_id  || null,
    contract_type,
    start_date:       start_date  || null,
    end_date:         end_date    || null,
    renewal_date:     renewal_date|| null,
    auto_renewal:     Boolean(auto_renewal),
    notes:            notes        || null,
    internal_memo:    internal_memo|| null,
    status:           'draft',
    created_by:       auth.userId,
  }

  const { data, error } = await auth.adminClient
    .from('contracts' as never)
    .insert(insertPayload as never)
    .select()
    .single() as { data: any; error: unknown }

  if (error) return NextResponse.json({ error: String(error) }, { status: 500 })

  // 監査ログ
  await auth.adminClient.from('contract_events' as never).insert({
    contract_id:  data.id,
    company_id:   auth.companyId,
    actor_id:     auth.userId,
    event_type:   'created',
    new_value:    { title, contract_type, status: 'draft' },
    description:  '契約を作成しました',
  } as never)

  return NextResponse.json({ contract: data }, { status: 201 })
}
