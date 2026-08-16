// ============================================================
// 報告書サービス — CONSOLE用
// browser Supabase廃止。GET /api/reports, /api/reports/[id] 経由で取得。
// ============================================================

export type EmailStatus = 'sent' | 'failed' | 'unsent'

export interface ReportListItem {
  id: string
  job_id: string
  project_id: string
  worker_id: string
  version: number
  overall_score: number | null
  pdf_url: string | null
  created_at: string
  email_status: EmailStatus
  last_sent_at: string | null
  jobs: {
    work_date: string
    started_at: string
    completed_at: string | null
  } | null
  projects: {
    name: string
    code: string | null
    client_id: string | null
    clients: { name: string } | null
    stores: { name: string; address: string | null } | null
  } | null
  profiles: { name: string } | null
}

export interface ReportSpot {
  name: string
  order: number
  score: number | null
  recommendation: 'pass' | 'check' | 'redo' | null
  before_url: string | null
  after_url: string | null
  ai_comment: string
  improvements: string[]
  remaining_issues: string[]
  comparison: string | null
}

export interface ReportContent {
  project: {
    name: string
    code: string | null
    address: string | null
    assigned_to: string | null
    notes: string | null
  }
  store: {
    name: string
    address: string | null
    phone: string | null
  }
  client: { name: string }
  job: {
    work_date: string
    started_at: string
    completed_at: string | null
    worker_name: string
  }
  spots: ReportSpot[]
  summary: {
    overall_score: number
    passed_count: number
    check_count: number
    redo_count: number
    total_spots: number
    work_summary: string
    quality_assessment: string
    total_comment: string
    next_recommendations: string[]
  }
  generated_at: string
  version: number
}

export interface ReportDetail {
  id: string
  job_id: string
  project_id: string
  worker_id: string
  version: number
  overall_score: number | null
  content: ReportContent
  pdf_url: string | null
  created_at: string
}

export async function listReports(opts?: {
  search?: string
  page?: number
  pageSize?: number
  dateFrom?: string
  dateTo?: string
}): Promise<{ data: ReportListItem[]; count: number; error: Error | null }> {
  try {
    const params = new URLSearchParams()
    if (opts?.page)     params.set('page',     String(opts.page))
    if (opts?.pageSize) params.set('pageSize', String(opts.pageSize))
    if (opts?.dateFrom) params.set('dateFrom', opts.dateFrom)
    if (opts?.dateTo)   params.set('dateTo',   opts.dateTo)

    const res  = await fetch(`/api/reports?${params}`, { credentials: 'include' })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      return { data: [], count: 0, error: new Error(json.error ?? 'fetch failed') }
    }
    const json = await res.json()
    return { data: json.data ?? [], count: json.count ?? 0, error: null }
  } catch (e) {
    return { data: [], count: 0, error: e instanceof Error ? e : new Error(String(e)) }
  }
}

export async function getReport(id: string): Promise<{ data: ReportDetail | null; error: Error | null }> {
  try {
    const res  = await fetch(`/api/reports/${id}`, { credentials: 'include' })
    if (!res.ok) {
      return { data: null, error: new Error('Not found') }
    }
    const json = await res.json()
    return { data: json.data as ReportDetail, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e : new Error(String(e)) }
  }
}

export async function getReportStats(): Promise<{
  totalReports: number
  avgScore: number | null
  thisMonthCount: number
}> {
  try {
    const res  = await fetch('/api/reports?page=1&pageSize=1', { credentials: 'include' })
    if (!res.ok) return { totalReports: 0, avgScore: null, thisMonthCount: 0 }
    const json = await res.json()
    return json.stats ?? { totalReports: 0, avgScore: null, thisMonthCount: 0 }
  } catch {
    return { totalReports: 0, avgScore: null, thisMonthCount: 0 }
  }
}
