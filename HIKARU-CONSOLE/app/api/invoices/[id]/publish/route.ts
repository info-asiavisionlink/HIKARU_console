import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { sendNotification } from '@/lib/line/notification.service'
import { quotePublishedTemplate, invoiceIssuedTemplate } from '@/lib/line/templates'

// POST /api/invoices/[id]/publish - 顧客ポータルへ公開
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: existing } = await auth.adminClient
    .from('invoices')
    .select('status, company_id, invoice_type, published_to_portal, invoice_number, total_amount, due_date, client_id')
    .eq('id', id).single()

  if (!existing) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  if (existing.company_id !== auth.companyId) return NextResponse.json({ error: '権限なし' }, { status: 403 })
  if (existing.status === 'draft') return NextResponse.json({ error: '下書きは公開できません。先に発行してください。' }, { status: 400 })

  const now = new Date().toISOString()
  const { data, error } = await auth.adminClient
    .from('invoices')
    .update({
      published_to_portal: true,
      published_at:        now,
      published_by:        auth.userId,
    })
    .eq('id', id)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // LINE通知: 顧客へ公開通知（業務処理とは独立）
  void notifyClientOnPublish(auth.companyId, id, existing)

  return NextResponse.json({ invoice: data })
}

async function notifyClientOnPublish(
  companyId: string,
  invoiceId: string,
  invoice: {
    invoice_type: string
    invoice_number: string
    total_amount: number
    due_date?: string
    client_id: string
  }
) {
  try {
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 顧客のポータルアカウントを取得（LINE通知対象）
    const { data: accounts } = await db
      .from('client_portal_accounts')
      .select('id, line_user_id, line_notify_enabled')
      .eq('client_id', invoice.client_id)
      .eq('company_id', companyId)
      .eq('is_active', true)

    if (!accounts?.length) return

    const eventType = invoice.invoice_type === 'quote' ? 'quote_published' as const : 'invoice_issued' as const
    const params = {
      invoiceNumber: invoice.invoice_number,
      clientName:    '',
      totalAmount:   invoice.total_amount ?? 0,
      dueDate:       invoice.due_date ?? undefined,
      invoiceType:   invoice.invoice_type as 'quote' | 'invoice',
      companyBaseUrl: process.env.HIKARU_CLIENT_URL,
    }
    const message = eventType === 'quote_published'
      ? quotePublishedTemplate(params)
      : invoiceIssuedTemplate(params)

    for (const account of accounts) {
      await sendNotification({
        companyId,
        eventType,
        notificationKey:  `${eventType}:${invoiceId}:${account.id}`,
        portalAccountId:  account.id,
        clientLineUserId: account.line_user_id ?? undefined,
        message,
      })
    }
  } catch {
    // 通知失敗は業務処理に影響させない
  }
}
