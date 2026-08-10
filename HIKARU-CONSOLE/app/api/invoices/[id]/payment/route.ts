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

  const paymentAmount = Number(amount)
  if (!amount || isNaN(paymentAmount) || paymentAmount <= 0) {
    return NextResponse.json({ error: '入金額は0より大きい値を指定してください' }, { status: 400 })
  }

  const { data: invoice } = await auth.adminClient
    .from('invoices')
    .select('total_amount, paid_amount, status, company_id, invoice_type, invoice_number')
    .eq('id', id).single()

  if (!invoice) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  if (invoice.company_id !== auth.companyId) return NextResponse.json({ error: '権限なし' }, { status: 403 })
  if (invoice.invoice_type !== 'invoice') return NextResponse.json({ error: '請求書のみ入金登録できます' }, { status: 400 })
  if (invoice.status === 'paid') return NextResponse.json({ error: '既に入金済みの請求書です' }, { status: 400 })

  const currentPaidAmount = invoice.paid_amount ?? 0
  const remaining = (invoice.total_amount ?? 0) - currentPaidAmount

  // 過払い防止チェック
  if (paymentAmount > remaining) {
    return NextResponse.json({
      error: `入金額が残額を超えています。残額: ${remaining}円`,
      remaining,
    }, { status: 400 })
  }

  const newPaidAmount = currentPaidAmount + paymentAmount
  const isPaid = newPaidAmount >= (invoice.total_amount ?? 0)

  // 入金記録をINSERT
  const { data: payment, error: pErr } = await auth.adminClient
    .from('invoice_payments')
    .insert({
      invoice_id:     id,
      company_id:     auth.companyId,
      amount:         paymentAmount,
      paid_at,
      payment_method: payment_method || null,
      notes:          notes || null,
      recorded_by:    auth.userId,
    })
    .select().single()

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  // 楽観ロック: 現在のpaid_amountが変わっていない場合のみUPDATE
  // .eq('paid_amount', currentPaidAmount) が競合検出のキー
  const { data: updatedInvoice, error: upErr } = await auth.adminClient
    .from('invoices')
    .update({
      paid_amount: newPaidAmount,
      status:      isPaid ? 'paid' : invoice.status,
      ...(isPaid ? { paid_at } : {}),
    })
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .eq('paid_amount', currentPaidAmount)  // 楽観ロック: 他のリクエストが先に更新した場合は0行
    .select()
    .maybeSingle()

  if (upErr) {
    // UPDATEエラー: paymentを取り消し
    await auth.adminClient.from('invoice_payments').delete().eq('id', payment.id)
    return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  if (!updatedInvoice) {
    // 楽観ロック衝突: 別リクエストが先に更新した → paymentを取り消し
    await auth.adminClient.from('invoice_payments').delete().eq('id', payment.id)
    return NextResponse.json({
      error: '同時実行エラー: 別の入金処理が実行中です。もう一度試してください。',
      code:  'CONCURRENT_PAYMENT',
    }, { status: 409 })
  }

  // LINE通知: 全額入金時に管理者へ通知
  if (isPaid) {
    void sendNotification({
      companyId:       auth.companyId,
      eventType:       'payment_received',
      notificationKey: `payment_received:${id}`,
      profileId:       auth.userId,
      message:         paymentReceivedTemplate({
        invoiceNumber: invoice.invoice_number ?? id,
        amount:        paymentAmount,
        paidAt:        paid_at,
        companyBaseUrl: process.env.HIKARU_CONSOLE_URL,
      }),
    })
  }

  return NextResponse.json({
    payment,
    is_fully_paid: isPaid,
    paid_amount:   newPaidAmount,
    remaining:     (invoice.total_amount ?? 0) - newPaidAmount,
  }, { status: 201 })
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
