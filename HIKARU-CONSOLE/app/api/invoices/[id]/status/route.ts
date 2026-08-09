import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// 有効なステータス遷移
const VALID_TRANSITIONS: Record<string, Record<string, string[]>> = {
  quote: {
    draft:     ['issued', 'cancelled'],
    issued:    ['accepted', 'rejected', 'cancelled'],
    accepted:  ['cancelled'],
    rejected:  ['draft', 'cancelled'],
    cancelled: [],
  },
  invoice: {
    draft:            ['issued', 'cancelled'],
    issued:           ['sent', 'awaiting_payment', 'cancelled'],
    sent:             ['awaiting_payment', 'cancelled'],
    awaiting_payment: ['paid', 'overdue', 'cancelled'],
    overdue:          ['paid', 'cancelled'],
    paid:             [],
    cancelled:        [],
  },
}

// POST /api/invoices/[id]/status
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { status: newStatus, cancel_reason } = await req.json()
  if (!newStatus) return NextResponse.json({ error: 'status は必須です' }, { status: 400 })

  const { data: existing } = await auth.adminClient
    .from('invoices').select('status, company_id, invoice_type').eq('id', id).single()

  if (!existing) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  if (existing.company_id !== auth.companyId) return NextResponse.json({ error: '権限なし' }, { status: 403 })

  const allowed = VALID_TRANSITIONS[existing.invoice_type]?.[existing.status] ?? []
  if (!allowed.includes(newStatus)) {
    return NextResponse.json({
      error: `${existing.status} → ${newStatus} への変更はできません`,
      allowed,
    }, { status: 400 })
  }

  const update: Record<string, unknown> = { status: newStatus }

  if (newStatus === 'issued') {
    update.issued_by = auth.userId
    update.issued_at = new Date().toISOString()
    // 将来: LINE通知 invoice_issued / quote_issued イベントをここでキック
  }
  if (newStatus === 'cancelled') {
    update.cancelled_by = auth.userId
    update.cancelled_at = new Date().toISOString()
    update.cancel_reason = cancel_reason || null
  }

  const { data, error } = await auth.adminClient
    .from('invoices').update(update).eq('id', id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invoice: data })
}
