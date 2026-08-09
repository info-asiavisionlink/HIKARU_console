import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { sendNotification } from '@/lib/line/notification.service'
import { expenseSubmittedTemplate } from '@/lib/line/templates'

type ExpenseRow = { status: string; company_id: string; amount: number; description: string; worker_id: string | null }
type ProfileRow = { id: string }

// POST /api/expenses/[id]/submit - draft → submitted（申請者が経費申請を提出）
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: existing } = await auth.adminClient
    .from('expenses')
    .select('status, company_id, amount, description, worker_id')
    .eq('id', id)
    .single() as { data: ExpenseRow | null; error: unknown }

  if (!existing) return NextResponse.json({ error: '経費が見つかりません' }, { status: 404 })
  if (existing.company_id !== auth.companyId) return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  if (existing.status !== 'draft') {
    return NextResponse.json({ error: '下書き状態の経費のみ申請できます' }, { status: 400 })
  }

  const { data, error } = await auth.adminClient
    .from('expenses')
    .update({ status: 'submitted', submitted_at: new Date().toISOString() } as never)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 })

  // LINE通知: 管理者全員へ（業務処理とは独立）
  void notifyAdmins(auth.companyId, id, existing)

  return NextResponse.json({ expense: data })
}

async function notifyAdmins(
  companyId: string,
  expenseId: string,
  expense: ExpenseRow
) {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    let applicantName = '申請者'
    if (expense.worker_id) {
      const { data: profile } = await db
        .from('profiles')
        .select('name')
        .eq('id', expense.worker_id)
        .single()
      applicantName = (profile as { name?: string } | null)?.name ?? applicantName
    }

    const { data: admins } = await db
      .from('profiles')
      .select('id')
      .eq('company_id', companyId)
      .eq('role', 'admin') as { data: ProfileRow[] | null; error: unknown }

    if (!admins?.length) return

    const message = expenseSubmittedTemplate({
      applicantName,
      amount:      expense.amount ?? 0,
      description: expense.description ?? '',
      companyBaseUrl: process.env.HIKARU_CONSOLE_URL,
    })

    for (const admin of admins) {
      await sendNotification({
        companyId,
        eventType:       'expense_submitted',
        notificationKey: `expense_submitted:${expenseId}:${admin.id}`,
        profileId:       admin.id,
        message,
      })
    }
  } catch {
    // 通知失敗は業務処理に影響させない
  }
}
