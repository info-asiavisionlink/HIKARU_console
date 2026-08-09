import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { sendNotification } from '@/lib/line/notification.service'
import { paymentReceivedTemplate } from '@/lib/line/templates'

// POST /api/invoices/[id]/payment - 入金記録
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { amount, paid_at, payment_method, notes } = await req.json()
  if (!amount || !paid_at) return NextResponse.json({ error: 'amount, paid_at は必須です' }, { status: 400 })

  const { data: invoice } = await auth.adminClient
    .from('invoices')
    .select('total_amount, paid_amount, status, company_id, invoice_type, invoice_number')
    .eq('id', id).single()

  if (!invoice) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  if (invoice.company_id !== auth.companyId) return NextResponse.json({ error: '権限なし' }, { status: 403 })
  if (invoice.invoice_type !== 'invoice') return NextResponse.json({ error: '請求書のみ入金登録できます' }, { status: 400 })

  // 入金記録
  const { data: payment, error: pErr } = await auth.adminClient
    .from('invoice_payments')
    .insert({
      invoice_id:     id,
      company_id:     auth.companyId,
      amount:         Number(amount),
      paid_at,
      payment_method: payment_method || null,
      notes:          notes || null,
      recorded_by:    auth.userId,
    })
    .select().single()

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  // paid_amount を更新
  const newPaidAmount = (invoice.paid_amount ?? 0) + Number(amount)
  const isPaid        = newPaidAmount >= (invoice.total_amount ?? 0)

  const update: Record<string, unknown> = {
    paid_amount: newPaidAmount,
    status: isPaid ? 'paid' : 'awaiting_payment',
  }
  if (isPaid) {
    update.paid_at = paid_at
  }

  await auth.adminClient.from('invoices').update(update).eq('id', id)

  // LINE通知: 全額入金時に管理者へ通知
  if (isPaid) {
    void sendNotification({
      companyId:       auth.companyId,
      eventType:       'payment_received',
      notificationKey: `payment_received:${id}`,
      profileId:       auth.userId,
      message:         paymentReceivedTemplate({
        invoiceNumber: invoice.invoice_number ?? id,
        amount:        Number(amount),
        paidAt:        paid_at,
        companyBaseUrl: process.env.HIKARU_CONSOLE_URL,
      }),
    })
  }

  return NextResponse.json({ payment, is_fully_paid: isPaid, paid_amount: newPaidAmount }, { status: 201 })
}

// GET /api/invoices/[id]/payment - 入金履歴一覧
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await auth.adminClient
    .from('invoice_payments')
    .select('*, recorder:recorded_by(id,name)')
    .eq('invoice_id', id)
    .order('paid_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ payments: data ?? [] })
}
