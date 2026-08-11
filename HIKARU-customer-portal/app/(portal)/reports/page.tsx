import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { FileText, Download, Search, ChevronRight } from 'lucide-react'

const GOLD = 'oklch(0.73 0.12 78)'
const TEXT_MUTED = 'oklch(0.55 0.008 60)'
const GREEN = 'oklch(0.72 0.18 150)'
const RED = 'oklch(0.65 0.25 27)'

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string }>
}) {
  const sp = await searchParams
  const cookieStore = await cookies()
  const uid = cookieStore.get('hk_cp_uid')?.value
  if (!uid) redirect('/login')

  const admin = createAdminClient()

  const { data: account } = await admin
    .from('client_portal_accounts')
    .select('id')
    .eq('profile_id', uid)
    .single()

  if (!account) redirect('/login')

  const { data: perms } = await admin
    .from('client_project_permissions')
    .select('project_id, can_download_pdf')
    .eq('portal_account_id', account.id)
    .eq('can_view_reports', true)

  const projectIds = perms?.map((p) => p.project_id) ?? []

  type Report = {
    id: string
    created_at: string
    overall_score: number | null
    projects: { name: string } | null
    jobs: { started_at: string; completed_at: string | null; work_date: string } | null
  }
  let reports: Report[] = []

  if (projectIds.length > 0) {
    let query = admin
      .from('reports')
      .select('id, created_at, overall_score, projects(name), jobs(started_at, completed_at, work_date)')
      .in('project_id', projectIds)
      .order('created_at', { ascending: false })

    if (sp.from) query = query.gte('created_at', sp.from)
    if (sp.to)   query = query.lte('created_at', sp.to + 'T23:59:59')

    const { data } = await query
    reports = (data as any[]) ?? []

    if (sp.q) {
      const q = sp.q.toLowerCase()
      reports = reports.filter((r) =>
        (r.projects as any)?.name?.toLowerCase().includes(q)
      )
    }
  }

  // 閲覧済みレポートIDセット
  const { data: views } = await admin
    .from('report_views')
    .select('report_id')
    .eq('portal_account_id', account.id)
  const viewedIds = new Set(views?.map((v) => v.report_id) ?? [])

  const pdfPermMap = Object.fromEntries(perms?.map((p) => [p.project_id, p.can_download_pdf]) ?? [])

  return (
    <div className="space-y-6 animate-[slide-up_0.4s_ease-out]">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'oklch(0.90 0.008 75)' }}>報告書履歴</h1>
        <p className="text-sm mt-1" style={{ color: TEXT_MUTED }}>
          全 <span style={{ color: GOLD }}>{reports.length}</span> 件
        </p>
      </div>

      <div style={{ height: '1px', background: `linear-gradient(90deg, ${GOLD}50, transparent)` }} />

      {/* 検索フィルター */}
      <form className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
            style={{ color: TEXT_MUTED }}
          />
          <input
            name="q"
            type="text"
            defaultValue={sp.q}
            placeholder="案件名で検索..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all"
            style={{
              background: 'oklch(0.10 0.005 255 / 0.88)',
              border: `1px solid ${GOLD}22`,
              color: 'oklch(0.85 0.007 60)',
            }}
          />
        </div>
        <input
          name="from"
          type="date"
          defaultValue={sp.from}
          className="px-3 py-2.5 rounded-xl text-sm outline-none"
          style={{
            background: 'oklch(0.10 0.005 255 / 0.88)',
            border: `1px solid ${GOLD}22`,
            color: 'oklch(0.70 0.007 60)',
          }}
        />
        <input
          name="to"
          type="date"
          defaultValue={sp.to}
          className="px-3 py-2.5 rounded-xl text-sm outline-none"
          style={{
            background: 'oklch(0.10 0.005 255 / 0.88)',
            border: `1px solid ${GOLD}22`,
            color: 'oklch(0.70 0.007 60)',
          }}
        />
        <button
          type="submit"
          className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{
            background: `${GOLD}18`,
            border: `1px solid ${GOLD}35`,
            color: GOLD,
          }}
        >
          検索
        </button>
      </form>

      {/* 報告書リスト */}
      {reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <FileText className="h-16 w-16 opacity-15" style={{ color: GOLD }} />
          <p className="text-sm" style={{ color: TEXT_MUTED }}>該当する報告書はありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const scoreColor = report.overall_score == null ? TEXT_MUTED
              : report.overall_score >= 90 ? GREEN
              : report.overall_score >= 70 ? GOLD
              : RED
            const isRead = viewedIds.has(report.id)
            const project = report.projects as any
            const job = report.jobs as any

            return (
              <div
                key={report.id}
                className="flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 hover:scale-[1.005]"
                style={{
                  background: isRead ? 'oklch(0.09 0.005 255 / 0.72)' : 'oklch(0.10 0.005 255 / 0.92)',
                  border: `1px solid ${isRead ? GOLD + '14' : GOLD + '28'}`,
                }}
              >
                {/* 未読ドット */}
                {!isRead && (
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ background: GOLD, boxShadow: `0 0 6px ${GOLD}80` }} />
                )}

                {/* スコア */}
                <div className="shrink-0 text-center" style={{ minWidth: '52px' }}>
                  <p className="text-xl font-black" style={{ color: scoreColor }}>
                    {report.overall_score ?? '—'}
                  </p>
                  {report.overall_score && (
                    <p className="text-[9px]" style={{ color: TEXT_MUTED }}>点</p>
                  )}
                </div>

                {/* 情報 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: isRead ? 'oklch(0.65 0.007 60)' : 'oklch(0.88 0.007 60)' }}>
                    {project?.name ?? '—'}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: TEXT_MUTED }}>
                    {job?.work_date ?? new Date(report.created_at).toLocaleDateString('ja-JP')}
                    {job?.started_at && ` / 開始 ${new Date(job.started_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`}
                    {job?.completed_at && ` → 終了 ${new Date(job.completed_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                </div>

                {/* アクション */}
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/reports/${report.id}`}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                    style={{
                      background: `${GOLD}12`,
                      border: `1px solid ${GOLD}25`,
                      color: GOLD,
                    }}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                    閲覧
                  </Link>
                  <Link
                    href={`/reports/${report.id}/print`}
                    target="_blank"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                    style={{
                      background: 'oklch(0.68 0.20 230 / 0.10)',
                      border: '1px solid oklch(0.68 0.20 230 / 0.25)',
                      color: 'oklch(0.68 0.20 230)',
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                    PDF
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
