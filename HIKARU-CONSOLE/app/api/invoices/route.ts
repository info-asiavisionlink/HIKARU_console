import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { calcInvoice, buildItemsFromProjectPrice, isOverdue } from '@/lib/billing/calculator'
import { getJstDateString, getJstYear } from '@/lib/billing/date-utils'

// GET /api/invoices
export async function GET(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const p            = req.nextUrl.searchParams
  const invoiceType  = p.get('invoice_type')  // 'quote' | 'invoice'
  const status       = p.get('status')
  const clientId     = p.get('client_id')
  const projectId    = p.get('project_id')
  const dateFrom     = p.get('date_from')
  const dateTo       = p.get('date_to')

  let query = auth.adminClient
    .from('invoices')
    .select(`
      *,
      clients:client_id (id, name, email, phone, address, contact_name),
      projects:project_id (id, name, project_type, location_name),
      creator:created_by (id, name),
      issuer:issued_by (id, name)
    `)
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: false })

  if (invoiceType) query = query.eq('invoice_type', invoiceType)
  if (status)      query = query.eq('status', status)
  if (clientId)    query = query.eq('client_id', clientId)
  if (projectId)   query = query.eq('project_id', projectId)
  if (dateFrom)    query = query.gte('issue_date', dateFrom)
  if (dateTo)      query = query.lte('issue_date', dateTo)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // KPI（今月）
  const month = getJstDateString().slice(0, 7)
  const allThisMonth = await auth.adminClient
    .from('invoices')
    .select('invoice_type, status, total_amount, paid_amount, due_date')
    .eq('company_id', auth.companyId)
    .gte('issue_date', `${month}-01`)

  const kpi = {
    quotes_draft: 0, quotes_issued: 0,
    invoices_awaiting: 0, invoices_paid: 0, invoices_overdue: 0,
    total_billed: 0, total_paid: 0, total_unpaid: 0,
  }
  for (const inv of allThisMonth.data ?? []) {
    if (inv.invoice_type === 'quote' && inv.status === 'draft') kpi.quotes_draft++
    if (inv.invoice_type === 'quote' && inv.status === 'issued') kpi.quotes_issued++
    if (inv.invoice_type === 'invoice') {
      kpi.total_billed += inv.total_amount ?? 0
      kpi.total_paid   += inv.paid_amount  ?? 0
      kpi.total_unpaid += (inv.total_amount ?? 0) - (inv.paid_amount ?? 0)
      if (inv.status === 'awaiting_payment') {
        kpi.invoices_awaiting++
        if (isOverdue(inv.due_date, inv.status)) kpi.invoices_overdue++
      }
      if (inv.status === 'paid') kpi.invoices_paid++
    }
  }

  return NextResponse.json({ invoices: data ?? [], kpi })
}

// POST /api/invoices - 新規作成
export async function POST(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    invoice_type = 'quote',
    client_id, project_id, project_type,
    tax_rate = 0.10,
    rounding_method = 'floor',
    issue_date, due_date,
    billing_period_from, billing_period_to,
    period_month,
    title, notes, internal_memo,
    items: rawItems = [],
    // 案件単価から自動生成する場合
    auto_from_project_price_id,
  } = body

  if (!client_id) return NextResponse.json({ error: 'client_id は必須です' }, { status: 400 })

  // client_id の所属確認（他社クライアントへの紐付け防止）
  const { data: clientCheck, error: clientCheckErr } = await auth.adminClient
    .from('clients')
    .select('id, company_id')
    .eq('id', client_id)
    .single()

  if (clientCheckErr || !clientCheck) {
    return NextResponse.json({ error: 'クライアントが見つかりません' }, { status: 404 })
  }
  if (clientCheck.company_id !== auth.companyId) {
    return NextResponse.json({ error: '他社のクライアントを指定することはできません' }, { status: 403 })
  }

  // project_id の所属確認（他社案件への紐付け防止）
  if (project_id) {
    const { data: projectCheck, error: projectCheckErr } = await auth.adminClient
      .from('projects')
      .select('id, company_id, client_id')
      .eq('id', project_id)
      .single()

    if (projectCheckErr || !projectCheck) {
      return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 })
    }
    if (projectCheck.company_id !== auth.companyId) {
      return NextResponse.json({ error: '他社の案件を指定することはできません' }, { status: 403 })
    }
    // project と client の整合性確認
    if (projectCheck.client_id && projectCheck.client_id !== client_id) {
      return NextResponse.json({ error: '案件に紐付くクライアントと指定クライアントが一致しません' }, { status: 400 })
    }
  }

  // 明細計算（サーバーサイドで再計算してSnapshotを作成）
  let lineItems = rawItems
  if (auto_from_project_price_id) {
    const { data: price } = await auth.adminClient
      .from('project_prices')
      .select('*')
      .eq('id', auto_from_project_price_id)
      .single()

    if (!price) return NextResponse.json({ error: '単価データが見つかりません' }, { status: 404 })

    const { data: proj } = await auth.adminClient
      .from('projects').select('name').eq('id', project_id).single()

    let periodLabel = ''
    if (period_month) {
      const year = issue_date ? parseInt((issue_date as string).slice(0, 4), 10) : getJstYear()
      periodLabel = `${year}年${period_month}月分`
    }

    lineItems = buildItemsFromProjectPrice(price, project_type ?? 'spot', periodLabel, proj?.name)
  }

  // 金額再計算（ブラウザ値を信用しない）
  const calc = calcInvoice(lineItems, tax_rate, rounding_method)

  // 番号発行（DB関数で重複防止）
  const year = issue_date ? parseInt((issue_date as string).slice(0, 4), 10) : getJstYear()
  const { data: numData } = await auth.adminClient
    .rpc('next_invoice_number', {
      p_company_id:   auth.companyId,
      p_invoice_type: invoice_type,
      p_year:         year,
    })

  if (!numData) return NextResponse.json({ error: '請求書番号の発行に失敗しました' }, { status: 500 })

  // invoicesレコード作成
  const { data: invoice, error: invErr } = await auth.adminClient
    .from('invoices')
    .insert({
      company_id:          auth.companyId,
      client_id,
      project_id:          project_id || null,
      invoice_type,
      invoice_number:      numData,
      issue_date:          issue_date || getJstDateString(),
      due_date:            due_date || null,
      billing_period_from: billing_period_from || null,
      billing_period_to:   billing_period_to   || null,
      period_month:        period_month || null,
      subtotal:            calc.subtotal,
      tax_rate:            calc.tax_rate,
      tax_amount:          calc.tax_amount,
      total_amount:        calc.total_amount,
      rounding_method,
      title:               title || null,
      notes:               notes || null,
      internal_memo:       internal_memo || null,
      status:              'draft',
      created_by:          auth.userId,
    })
    .select()
    .single()

  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 })

  // 明細レコード作成
  if (calc.items.length > 0) {
    const itemRows = calc.items.map((item, i) => ({
      invoice_id:  invoice.id,
      order_num:   item.order_num ?? i,
      description: item.description,
      quantity:    item.quantity,
      unit:        item.unit || null,
      unit_price:  item.unit_price,
      amount:      item.amount,
      tax_rate:    item.tax_rate ?? tax_rate,
      source_type: item.source_type || 'manual',
      source_id:   item.source_id   || null,
    }))

    const { error: itemErr } = await auth.adminClient
      .from('invoice_items').insert(itemRows)
    if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 })
  }

  return NextResponse.json({ invoice }, { status: 201 })
}
