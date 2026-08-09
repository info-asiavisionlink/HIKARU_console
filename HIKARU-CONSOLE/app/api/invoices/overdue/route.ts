import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendNotification } from '@/lib/line/notification.service'
import { invoiceOverdueTemplate } from '@/lib/line/templates'

// POST /api/invoices/overdue - 支払期限超過請求書の管理者通知
// Vercel Cron または管理者が手動で実行する。
// 同一請求書について1日1回のみ通知（notification_key で重複防止）。
export async function POST(req: NextRequest) {
  // 内部からのみ呼び出し可能: CRON_SECRET で認証
  const secret = req.headers.get('x-cron-secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const today = new Date().toISOString().slice(0, 10)

  // 期限超過の未払い請求書を取得
  const { data: overdueInvoices } = await db
    .from('invoices')
    .select(`
      id, invoice_number, total_amount, due_date, company_id,
      clients:client_id (id, name)
    `)
    .in('status', ['issued', 'sent', 'awaiting_payment', 'overdue'])
    .lt('due_date', today)
    .eq('invoice_type', 'invoice')

  if (!overdueInvoices?.length) {
    return NextResponse.json({ notified: 0 })
  }

  let notified = 0

  for (const invoice of overdueInvoices) {
    // 今日の通知キー: 1日1回のみ
    const todayKey = `invoice_overdue:${invoice.id}:${today}`

    // 管理者を取得
    const { data: admins } = await db
      .from('profiles')
      .select('id')
      .eq('company_id', invoice.company_id)
      .eq('role', 'admin')

    for (const admin of admins ?? []) {
      const adminKey = `${todayKey}:${admin.id}`
      const clientName = (invoice.clients as { name?: string } | null)?.name ?? '顧客'

      await sendNotification({
        companyId:       invoice.company_id,
        eventType:       'invoice_overdue',
        notificationKey: adminKey,
        profileId:       admin.id,
        message:         invoiceOverdueTemplate({
          clientName,
          invoiceNumber: invoice.invoice_number,
          totalAmount:   invoice.total_amount ?? 0,
          dueDate:       invoice.due_date,
          companyBaseUrl: process.env.HIKARU_CONSOLE_URL,
        }),
      })
      notified++
    }
  }

  return NextResponse.json({ notified, overdue_count: overdueInvoices.length })
}
