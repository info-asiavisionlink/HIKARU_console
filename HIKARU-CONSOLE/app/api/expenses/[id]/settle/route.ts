import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { sendNotification } from '@/lib/line/notification.service'
import { expenseSettledTemplate } from '@/lib/line/templates'

const CATEGORY_LABELS: Record<string, string> = {
  transport:   '交通費',
  parking:     '駐車料',
  supplies:    '備品費',
  consumables: '消耗品費',
  other:       'その他',
}

// POST /api/expenses/[id]/settle - approved → settled
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const settled_amount = body.settled_amount // 精算額（未指定時は申請額を使用）

  const { data: existing } = await auth.adminClient
    .from('expenses')
    .select('status, company_id, amount, description, worker_id, category')
    .eq('id', id).single()

  if (!existing) return NextResponse.json({ error: '経費が見つかりません' }, { status: 404 })
  if (existing.company_id !== auth.companyId) return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  if (existing.status !== 'approved') {
    return NextResponse.json({ error: '承認済みの経費のみ精算できます' }, { status: 400 })
  }

  const finalAmount = settled_amount ?? existing.amount

  const { data, error } = await auth.adminClient
    .from('expenses')
    .update({
      status:         'settled',
      settled_by:     auth.userId,
      settled_at:     new Date().toISOString(),
      settled_amount: finalAmount,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // System内通知: 申請者へ精算完了通知（業務処理とは独立。失敗しても精算を取り消さない）
  void insertExpenseSystemNotification(auth.adminClient, {
    expenseId:  id,
    companyId:  existing.company_id,
    workerId:   existing.worker_id,
    type:       'expense_settled',
    title:      '経費が精算されました',
    body:       buildSettleBody(existing.category, finalAmount),
  })

  // LINE通知: 申請者へ精算完了通知（業務処理とは独立）
  void sendNotification({
    companyId:       auth.companyId,
    eventType:       'expense_settled',
    notificationKey: `expense_settled:${id}`,
    profileId:       existing.worker_id ?? undefined,
    message:         expenseSettledTemplate({
      applicantName: '',
      amount:        finalAmount ?? 0,
      description:   existing.description ?? '',
    }),
  })

  return NextResponse.json({ expense: data })
}

function buildSettleBody(category: string | null, amount: number | null): string {
  const label = CATEGORY_LABELS[category ?? ''] ?? 'その他'
  const yen   = (amount ?? 0).toLocaleString('ja-JP')
  return `${label} ¥${yen} が精算されました。`
}

async function insertExpenseSystemNotification(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any,
  opts: {
    expenseId:  string
    companyId:  string
    workerId:   string | null
    type:       string
    title:      string
    body:       string
  }
) {
  if (!opts.workerId) return
  const { error } = await adminClient
    .from('notifications')
    .insert({
      company_id:           opts.companyId,
      recipient_profile_id: opts.workerId,
      title:                opts.title,
      body:                 opts.body,
      type:                 opts.type,
      target_app:           'worker',
      is_read:              false,
      target_url:           `/expenses/${opts.expenseId}`,
    })
  if (error) {
    console.error(`[System通知] expenses/${opts.expenseId} ${opts.type} 挿入失敗:`, error.message)
  }
}
