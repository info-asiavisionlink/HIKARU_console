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
    .from('invoices').select('status, company_id, invoice_type, project_id').eq('id', id).single()

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

  // invoice cancel 時に invoice_job_links を削除し、jobを再請求可能にする。
  // statusの更新が成功してからの後処理。失敗してもcancelは取り消さない。
  if (newStatus === 'cancelled') {
    const { error: linkErr } = await auth.adminClient
      .from('invoice_job_links')
      .delete()
      .eq('invoice_id', id)
    if (linkErr) {
      console.error('[api/invoices/status] invoice_job_links 削除失敗 (invoice cancel 済):', linkErr.message)
    }
  }

  // project_billing 同期: invoiceの特定status変化を spot 案件の billing_status へ反映。
  // issued → billed で「未入金」としてDashboardに表示。
  // awaiting_payment → awaiting_payment、paid → paid。
  // quote / 他typeは対象外。失敗しても status 変更は取り消さない。
  if (existing.invoice_type === 'invoice' && existing.project_id) {
    const billingStatusMap: Record<string, string> = {
      issued:           'billed',
      awaiting_payment: 'awaiting_payment',
      paid:             'paid',
    }
    const billingStatus = billingStatusMap[newStatus]
    if (billingStatus) {
      void syncSpotProjectBilling(
        auth.adminClient,
        auth.companyId,
        existing.project_id as string,
        billingStatus,
        newStatus === 'paid' ? new Date().toISOString().split('T')[0] : undefined
      )
    }
  }

  return NextResponse.json({ invoice: data })
}

// ── project_billing 同期ヘルパー ──────────────────────────────────
// spot案件のみを対象とし、billing_status と actual_payment_date を更新する。
// 使用カラム: project_id(PK), billing_status, actual_payment_date
// 非存在カラム: period_month, actual_payment_amount は一切書き込まない。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncSpotProjectBilling(
  adminClient: any,
  companyId:   string,
  projectId:   string,
  billingStatus: string,
  paidDate?:   string
): Promise<void> {
  try {
    const { data: project } = await adminClient
      .from('projects')
      .select('project_type')
      .eq('id', projectId)
      .eq('company_id', companyId)
      .single()

    if (!project || project.project_type !== 'spot') return

    const upsertPayload: Record<string, unknown> = {
      project_id:     projectId,
      billing_status: billingStatus,
    }
    if (paidDate && billingStatus === 'paid') {
      upsertPayload.actual_payment_date = paidDate
    }

    const { error } = await adminClient
      .from('project_billing')
      .upsert(upsertPayload, { onConflict: 'project_id' })

    if (error) {
      console.error('[project_billing sync] upsert failed:', error.message)
    }
  } catch (e) {
    console.error('[project_billing sync] unexpected error:', e)
  }
}
