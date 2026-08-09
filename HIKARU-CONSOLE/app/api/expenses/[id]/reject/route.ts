import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { sendNotification } from '@/lib/line/notification.service'
import { expenseRejectedTemplate } from '@/lib/line/templates'

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
    .select('status, company_id, amount, description, worker_id')
    .eq('id', id).single()

  if (!existing) return NextResponse.json({ error: '経費が見つかりません' }, { status: 404 })
  if (existing.company_id !== auth.companyId) return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  if (existing.status !== 'submitted') {
    return NextResponse.json({ error: '申請中の経費のみ却下できます' }, { status: 400 })
  }

  const { data, error } = await auth.adminClient
    .from('expenses')
    .update({
      status:        'rejected',
      reject_reason: reject_reason.trim(),
      approved_by:   auth.userId,
      approved_at:   new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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
      rejectReason:  reject_reason.trim(),
    }),
  })

  return NextResponse.json({ expense: data })
}
