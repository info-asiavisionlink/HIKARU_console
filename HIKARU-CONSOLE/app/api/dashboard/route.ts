import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { getJstYear, getJstMonth } from '@/lib/billing/date-utils'

export async function GET() {
  const auth = await getAuthContext()
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const client = auth.adminClient  // service_role で RLS をバイパス
  const cid    = auth.companyId

  // JST 基準の日付境界（issue_date は DATE 型なので文字列比較が正確）
  const jstYear  = getJstYear()
  const jstMonth = getJstMonth()
  const thisMonthStart = `${jstYear}-${String(jstMonth).padStart(2, '0')}-01`
  const nextYear   = jstMonth === 12 ? jstYear + 1 : jstYear
  const nextMonth  = jstMonth === 12 ? 1 : jstMonth + 1
  const nextMonthStart = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
  const thisYearStart  = `${jstYear}-01-01`
  const nextYearStart  = `${jstYear + 1}-01-01`

  const [projectsRes, clientsRes, employeesRes, partnersRes, invoiceRevenueRes, unbilledRes] = await Promise.all([
    client.from('projects').select('status, project_type').eq('company_id', cid),
    client.from('clients').select('is_active').eq('company_id', cid),
    client.from('employees').select('status').eq('company_id', cid).neq('status', 'deleted'),
    client.from('partners').select('status').eq('company_id', cid).neq('status', 'deleted'),
    // 新: invoices ベース売上集計（v_invoice_revenue は draft/cancelled を除外済み）
    client.from('v_invoice_revenue')
      .select('project_type, issue_date, status, total_amount, paid_amount')
      .eq('company_id', cid),
    // 既存維持: 未請求のみ旧 v_project_revenue を継続使用
    // （recurring/日常の月次未請求対応は別 Phase）
    client.from('v_project_revenue')
      .select('billing_status, total_inc_tax')
      .eq('company_id', cid),
  ])

  const projects = { total: 0, active: 0, paused: 0, completed: 0, cancelled: 0, spot: 0, recurring: 0, hotel: 0 }
  projectsRes.data?.forEach((p) => {
    projects.total++
    if (p.status in projects) projects[p.status as keyof typeof projects]++
    if (p.project_type in projects) projects[p.project_type as keyof typeof projects]++
  })

  const clients = { total: 0, active: 0 }
  clientsRes.data?.forEach((c) => { clients.total++; if (c.is_active) clients.active++ })

  const employees = { total: 0, active: 0, on_leave: 0, resigned: 0, suspended: 0 }
  employeesRes.data?.forEach((e) => {
    employees.total++
    if (e.status in employees) employees[e.status as keyof typeof employees]++
  })

  const partners = { total: 0, active: 0, suspended: 0, terminated: 0 }
  partnersRes.data?.forEach((p) => {
    partners.total++
    if (p.status in partners) partners[p.status as keyof typeof partners]++
  })

  // 売上集計（レスポンス形状は既存 UI と完全互換）
  const revenue = {
    this_month: 0,  // 今月請求額（issue_date 基準、JST）
    this_year:  0,  // 年間請求額（issue_date 基準、JST）
    unbilled:   0,  // 未請求（旧ロジック維持: recurring/日常対応は別 Phase）
    unpaid:     0,  // 未入金残高（total_amount - paid_amount）
    by_type: { spot: 0, recurring: 0, hotel: 0 },
  }

  // 未入金対象ステータス（issued/sent/awaiting_payment/overdue）
  const UNPAID_STATUSES = new Set(['issued', 'sent', 'awaiting_payment', 'overdue'])

  // invoices ベース集計（今月売上・年間売上・未入金・種別別）
  invoiceRevenueRes.data?.forEach((r: any) => {
    const amount    = Number(r.total_amount ?? 0)
    const paid      = Number(r.paid_amount  ?? 0)
    const issueDate = r.issue_date as string  // 'YYYY-MM-DD'

    // 今月売上（JST当月 issue_date のみ）
    if (issueDate >= thisMonthStart && issueDate < nextMonthStart) {
      revenue.this_month += amount
    }

    // 年間売上（JST当年 issue_date のみ）
    if (issueDate >= thisYearStart && issueDate < nextYearStart) {
      revenue.this_year += amount
    }

    // 未入金（部分入金を正確に残額へ反映）
    if (UNPAID_STATUSES.has(r.status as string)) {
      revenue.unpaid += amount - paid
    }

    // 種別別（全期間、project_type で分類）
    const pt = r.project_type as string
    if (pt in revenue.by_type) {
      revenue.by_type[pt as keyof typeof revenue.by_type] += amount
    }
  })

  // 未請求: 旧 v_project_revenue ベースを維持（project_billing.billing_status='unbilled'）
  unbilledRes.data?.forEach((r: any) => {
    if (r.billing_status === 'unbilled') {
      revenue.unbilled += Number(r.total_inc_tax ?? 0)
    }
  })

  return NextResponse.json({ projects, clients, stores: { total: 0, active: 0 }, employees, partners, revenue })
}
