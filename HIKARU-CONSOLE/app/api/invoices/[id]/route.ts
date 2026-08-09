import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { calcInvoice } from '@/lib/billing/calculator'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await auth.adminClient
    .from('invoices')
    .select(`
      *,
      clients:client_id (id, name, email, phone, address, contact_name),
      projects:project_id (id, name, project_type, location_name, address),
      invoice_items (id, order_num, description, quantity, unit, unit_price, amount, tax_rate, source_type),
      invoice_payments (id, amount, paid_at, payment_method, notes, recorded_by),
      creator:created_by (id, name),
      issuer:issued_by (id, name),
      publisher:published_by (id, name),
      canceller:cancelled_by (id, name),
      source_quote:converted_from_id (id, invoice_number)
    `)
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .order('order_num', { referencedTable: 'invoice_items', ascending: true })
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ invoice: data })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: existing } = await auth.adminClient
    .from('invoices').select('status, company_id, invoice_type').eq('id', id).single()

  if (!existing) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  if (existing.company_id !== auth.companyId) return NextResponse.json({ error: '権限なし' }, { status: 403 })

  // 発行済みは限定的な更新のみ（金額は変更不可）
  const isLocked = !['draft'].includes(existing.status)

  const body = await req.json()
  const { items, tax_rate, rounding_method, ...headerFields } = body

  // ヘッダー更新（発行済みはnotes等のみ）
  const allowedHeader = isLocked
    ? ['notes', 'internal_memo', 'due_date', 'title']
    : ['client_id','project_id','issue_date','due_date','billing_period_from','billing_period_to','period_month','title','notes','internal_memo']

  const update: Record<string, unknown> = {}
  for (const k of allowedHeader) if (k in headerFields) update[k] = headerFields[k]

  // draft のみ金額再計算
  if (!isLocked && items) {
    const calc = calcInvoice(items, tax_rate ?? 0.10, rounding_method ?? 'floor')
    update.subtotal     = calc.subtotal
    update.tax_rate     = calc.tax_rate
    update.tax_amount   = calc.tax_amount
    update.total_amount = calc.total_amount
    update.rounding_method = rounding_method ?? 'floor'

    // 明細を全削除して再挿入
    await auth.adminClient.from('invoice_items').delete().eq('invoice_id', id)
    const itemRows = calc.items.map((item, i) => ({
      invoice_id: id, order_num: item.order_num ?? i,
      description: item.description, quantity: item.quantity,
      unit: item.unit || null, unit_price: item.unit_price,
      amount: item.amount, tax_rate: item.tax_rate ?? calc.tax_rate,
      source_type: item.source_type || 'manual', source_id: item.source_id || null,
    }))
    if (itemRows.length > 0) {
      await auth.adminClient.from('invoice_items').insert(itemRows)
    }
  }

  if (Object.keys(update).length > 0) {
    await auth.adminClient.from('invoices').update(update).eq('id', id)
  }

  const { data: updated } = await auth.adminClient
    .from('invoices').select('*').eq('id', id).single()
  return NextResponse.json({ invoice: updated })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: existing } = await auth.adminClient
    .from('invoices').select('status, company_id').eq('id', id).single()

  if (!existing) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  if (existing.company_id !== auth.companyId) return NextResponse.json({ error: '権限なし' }, { status: 403 })

  // 発行済みは物理削除禁止 → cancelled に変更のみ
  if (existing.status !== 'draft') {
    return NextResponse.json({
      error: '発行済みの文書は削除できません。キャンセルしてください。',
      hint: 'PUT /api/invoices/[id]/status でキャンセルできます',
    }, { status: 400 })
  }

  await auth.adminClient.from('invoices').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
