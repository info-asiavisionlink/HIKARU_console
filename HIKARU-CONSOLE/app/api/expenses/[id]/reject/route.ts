import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { sendNotification } from '@/lib/line/notification.service'
import { expenseRejectedTemplate } from '@/lib/line/templates'

const CATEGORY_LABELS: Record<string, string> = {
  transport:   '交通費',
  parking:     '駐車料',
  supplies:    '備品費',
  consumables: '消耗品費',
  other:       'その他',
}

// POST /api/expenses/[id]/reject - submitted → rejected（却下理由必須）
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { reject_reason } = await req.json()
  if (!reject_reason?.trim()) {
    return NextResponse.json({ error: '却下理由は必須です' }, { status: 400 })
  }

  const { data: existing } = await auth.adminClient
    .from('expenses')
    .select('status, company_id, amount, description, worker_id, category')
    .eq('id', id).single()

  if (!existing) return NextResponse.json({ error: '経費が見つかりません' }, { status: 404 })
  if (existing.company_id !== auth.companyId) return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  if (existing.status !== 'submitted') {
    return NextResponse.json({ error: '申請中の経費のみ却下できます' }, { status: 400 })
  }

  const trimmedReason = reject_reason.trim()

  const { data, error } = await auth.adminClient
    .from('expenses')
    .update({
      status:        'rejected',
      reject_reason: trimmedReason,
      approved_by:   auth.userId,
      approved_at:   new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // System内通知: 申請者へ却下通知（業務処理とは独立。失敗しても却下を取り消さない）
  void insertExpenseSystemNotification(auth.adminClient, {
    expenseId:  id,
    companyId:  existing.company_id,
    workerId:   existing.worker_id,
    type:       'expense_rejected',
    title:      '経費申請が却下されました',
    body:       buildRejectBody(existing.category, existing.amount, trimmedReason),
  })

  // LINE通知: 申請者へ却下通知（業務処理とは独立）
  void sendNotification({
    companyId:       auth.companyId,
    eventType:       'expense_rejected',
    notificationKey: `expense_rejected:${id}`,
    profileId:       existing.worker_id ?? undefined,
    message:         expenseRejectedTemplate({
      applicantName: '',
      amount:        existing.amount ?? 0,
      description:   existing.description ?? '',
      rejectReason:  trimmedReason,
    }),
  })

  return NextResponse.json({ expense: data })
}

function buildRejectBody(category: string | null, amount: number | null, reason: string): string {
  const label = CATEGORY_LABELS[category ?? ''] ?? 'その他'
  const yen   = (amount ?? 0).toLocaleString('ja-JP')
  return `${label} ¥${yen} の経費申請が却下されました。\n理由: ${reason}`
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
