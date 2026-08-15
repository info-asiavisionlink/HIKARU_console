import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { getJstDateString, getJstYear } from '@/lib/billing/date-utils'

// POST /api/invoices/[id]/convert  見積書 → 請求書に変換
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { due_date, issue_date } = await req.json().catch(() => ({}))

  // 元の見積書を取得
  const { data: quote } = await auth.adminClient
    .from('invoices')
    .select('*, invoice_items(*)')
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .single()

  if (!quote) return NextResponse.json({ error: '見積書が見つかりません' }, { status: 404 })
  if (quote.invoice_type !== 'quote') {
    return NextResponse.json({ error: '見積書のみ変換できます' }, { status: 400 })
  }
  if (!['issued', 'accepted'].includes(quote.status)) {
    return NextResponse.json({ error: '発行済みまたは承認済みの見積書のみ変換できます' }, { status: 400 })
  }

  // 新しい請求書番号発行
  const year = issue_date ? parseInt((issue_date as string).slice(0, 4), 10) : getJstYear()
  const { data: numData } = await auth.adminClient
    .rpc('next_invoice_number', {
      p_company_id:   auth.companyId,
      p_invoice_type: 'invoice',
      p_year:         year,
    })

  if (!numData) return NextResponse.json({ error: '請求書番号の発行に失敗しました' }, { status: 500 })

  // 請求書作成（金額は見積書からSnapshot）
  const { data: invoice, error: invErr } = await auth.adminClient
    .from('invoices')
    .insert({
      company_id:          auth.companyId,
      client_id:           quote.client_id,
      project_id:          quote.project_id,
      invoice_type:        'invoice',
      invoice_number:      numData,
      converted_from_id:   quote.id,
      issue_date:          issue_date || getJstDateString(),
      due_date:            due_date || null,
      billing_period_from: quote.billing_period_from,
      billing_period_to:   quote.billing_period_to,
      period_month:        quote.period_month,
      subtotal:            quote.subtotal,       // Snapshot
      tax_rate:            quote.tax_rate,       // Snapshot
      tax_amount:          quote.tax_amount,     // Snapshot
      total_amount:        quote.total_amount,   // Snapshot
      rounding_method:     quote.rounding_method,
      title:               quote.title,
      notes:               quote.notes,
      status:              'draft',
      created_by:          auth.userId,
    })
    .select()
    .single()

  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 })

  // 明細もSnapshot
  const items = (quote.invoice_items ?? []).map((item: any) => ({
    invoice_id:  invoice.id,
    order_num:   item.order_num,
    description: item.description,
    quantity:    item.quantity,
    unit:        item.unit,
    unit_price:  item.unit_price,
    amount:      item.amount,
    tax_rate:    item.tax_rate,
    source_type: item.source_type,
    source_id:   item.source_id,
  }))

  if (items.length > 0) {
    await auth.adminClient.from('invoice_items').insert(items)
  }

  // 元の見積書を accepted に変更
  await auth.adminClient
    .from('invoices').update({ status: 'accepted' }).eq('id', quote.id)

  return NextResponse.json({ invoice }, { status: 201 })
}
