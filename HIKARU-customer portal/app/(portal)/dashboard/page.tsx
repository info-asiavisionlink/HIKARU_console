import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { FolderOpen, CheckCircle2, Clock, FileText, CalendarDays, Bell } from 'lucide-react'
import Link from 'next/link'

const GOLD = 'oklch(0.73 0.12 78)'
const TEXT_MUTED = 'oklch(0.55 0.008 60)'

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  href,
}: {
  label: string
  value: number | string
  icon: React.ElementType
  color?: string
  href?: string
}) {
  const c = color ?? GOLD
  const card = (
    <div
      className="flex items-center gap-4 p-5 rounded-2xl transition-all duration-200 hover:scale-[1.02]"
      style={{
        background: 'oklch(0.10 0.005 255 / 0.88)',
        border: `1px solid ${c}22`,
        boxShadow: `0 0 20px ${c}08`,
      }}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-xl shrink-0"
        style={{ background: `${c}14`, border: `1px solid ${c}30` }}
      >
        <Icon className="h-6 w-6" style={{ color: c, filter: `drop-shadow(0 0 6px ${c}99)` }} />
      </div>
      <div>
        <p
          className="text-3xl font-black tabular-nums"
          style={{
            background: `linear-gradient(135deg, ${c === GOLD ? 'oklch(0.62 0.11 75)' : c}, ${c})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {value}
        </p>
        <p className="text-xs mt-0.5" style={{ color: TEXT_MUTED }}>{label}</p>
      </div>
    </div>
  )
  if (href) return <Link href={href}>{card}</Link>
  return card
}

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const uid = cookieStore.get('hk_cp_uid')?.value
  if (!uid) redirect('/login')

  const admin = createAdminClient()

  // ポータルアカウント取得
  const { data: account } = await admin
    .from('client_portal_accounts')
    .select('id, contact_name, clients(name)')
    .eq('profile_id', uid)
    .single()

  if (!account) redirect('/login')

  // 権限がある案件ID
  const { data: perms } = await admin
    .from('client_project_permissions')
    .select('project_id')
    .eq('portal_account_id', account.id)

  const projectIds = perms?.map((p) => p.project_id) ?? []

  // 案件数・ステータス集計
  let totalProjects = 0
  let activeJobs = 0
  let completedProjects = 0

  if (projectIds.length > 0) {
    const { count } = await admin
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .in('id', projectIds)
    totalProjects = count ?? 0

    const { count: c2 } = await admin
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .in('id', projectIds)
      .eq('status', 'completed')
    completedProjects = c2 ?? 0

    const { count: c3 } = await admin
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .in('project_id', projectIds)
      .eq('status', 'in_progress')
    activeJobs = c3 ?? 0
  }

  // 未確認報告書
  let unreadReports = 0
  if (projectIds.length > 0) {
    const { data: allReports } = await admin
      .from('reports')
      .select('id')
      .in('project_id', projectIds)

    if (allReports && allReports.length > 0) {
      const reportIds = allReports.map((r) => r.id)
      const { data: viewedReports } = await admin
        .from('report_views')
        .select('report_id')
        .eq('portal_account_id', account.id)
        .in('report_id', reportIds)

      const viewedIds = new Set(viewedReports?.map((r) => r.report_id) ?? [])
      unreadReports = reportIds.filter((id) => !viewedIds.has(id)).length
    }
  }

  // 最新作業日時
  let latestJobAt = ''
  if (projectIds.length > 0) {
    const { data: latestJob } = await admin
      .from('jobs')
      .select('work_date, started_at')
      .in('project_id', projectIds)
      .order('work_date', { ascending: false })
      .limit(1)
      .single()

    if (latestJob) {
      latestJobAt = new Date(latestJob.started_at).toLocaleDateString('ja-JP', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    }
  }

  // 最新報告書
  type RecentReport = { id: string; created_at: string; projects: { name: string } | null; overall_score: number | null }
  let recentReports: RecentReport[] = []
  if (projectIds.length > 0) {
    const { data } = await admin
      .from('reports')
      .select('id, created_at, overall_score, projects(name)')
      .in('project_id', projectIds)
      .order('created_at', { ascending: false })
      .limit(5)
    recentReports = (data as any[]) ?? []
  }

  // 最新通知
  const { data: recentNotifs } = await admin
    .from('client_notifications')
    .select('id, title, body, type, is_read, created_at')
    .eq('portal_account_id', account.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const clientName = (account.clients as any)?.name ?? ''

  return (
    <div className="space-y-8 animate-[slide-up_0.4s_ease-out]">
      {/* ヘッダー */}
      <div>
        <p className="text-xs mb-1" style={{ color: TEXT_MUTED }}>Welcome back</p>
        <h1 className="text-2xl font-bold" style={{ color: 'oklch(0.90 0.008 75)' }}>
          {clientName && <span style={{ color: GOLD }}>{clientName}</span>} ダッシュボード
        </h1>
      </div>

      {/* ゴールドライン */}
      <div style={{ height: '1px', background: `linear-gradient(90deg, ${GOLD}50, transparent)` }} />

      {/* 統計カード */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="col-span-2 md:col-span-1 lg:col-span-1">
          <StatCard label="契約案件数" value={totalProjects} icon={FolderOpen} href="/projects" />
        </div>
        <div className="col-span-2 md:col-span-1 lg:col-span-1">
          <StatCard label="進行中" value={activeJobs} icon={Clock} color="oklch(0.68 0.20 230)" />
        </div>
        <div className="col-span-2 md:col-span-1 lg:col-span-1">
          <StatCard label="完了案件" value={completedProjects} icon={CheckCircle2} color="oklch(0.72 0.18 150)" />
        </div>
        <div className="col-span-2 md:col-span-1 lg:col-span-1">
          <StatCard label="未確認報告書" value={unreadReports} icon={FileText} color={unreadReports > 0 ? 'oklch(0.65 0.25 27)' : TEXT_MUTED} href="/reports" />
        </div>
        <div className="col-span-2 md:col-span-2 lg:col-span-2">
          <StatCard
            label="最新作業日"
            value={latestJobAt || '—'}
            icon={CalendarDays}
            color="oklch(0.73 0.12 78)"
          />
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 最新報告書 */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'oklch(0.09 0.005 255 / 0.88)',
            border: `1px solid ${GOLD}20`,
          }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: GOLD }}>
              <FileText className="h-4 w-4" />
              最新報告書
            </h2>
            <Link href="/reports" className="text-xs hover:underline" style={{ color: TEXT_MUTED }}>
              すべて表示 →
            </Link>
          </div>

          {recentReports.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: TEXT_MUTED }}>報告書はありません</p>
          ) : (
            <div className="space-y-3">
              {recentReports.map((r) => (
                <Link
                  key={r.id}
                  href={`/reports/${r.id}`}
                  className="flex items-center justify-between p-3 rounded-xl transition-all duration-200 hover:scale-[1.01]"
                  style={{
                    background: 'oklch(0.12 0.006 255 / 0.70)',
                    border: `1px solid ${GOLD}14`,
                  }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'oklch(0.85 0.007 60)' }}>
                      {(r.projects as any)?.name ?? '—'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: TEXT_MUTED }}>
                      {new Date(r.created_at).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                  {r.overall_score !== null && (
                    <span
                      className="text-lg font-black"
                      style={{
                        color: r.overall_score >= 90 ? 'oklch(0.72 0.18 150)' : r.overall_score >= 70 ? GOLD : 'oklch(0.65 0.25 27)',
                      }}
                    >
                      {r.overall_score}点
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 最新通知 */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'oklch(0.09 0.005 255 / 0.88)',
            border: `1px solid ${GOLD}20`,
          }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: GOLD }}>
              <Bell className="h-4 w-4" />
              最新通知
            </h2>
            <Link href="/notifications" className="text-xs hover:underline" style={{ color: TEXT_MUTED }}>
              すべて表示 →
            </Link>
          </div>

          {!recentNotifs || recentNotifs.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: TEXT_MUTED }}>通知はありません</p>
          ) : (
            <div className="space-y-3">
              {recentNotifs.map((n) => (
                <div
                  key={n.id}
                  className="p-3 rounded-xl"
                  style={{
                    background: n.is_read ? 'oklch(0.12 0.006 255 / 0.50)' : 'oklch(0.12 0.006 255 / 0.80)',
                    border: `1px solid ${n.is_read ? GOLD + '0e' : GOLD + '22'}`,
                  }}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && (
                      <span
                        className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ background: GOLD }}
                      />
                    )}
                    <div className={n.is_read ? '' : 'ml-0'}>
                      <p className="text-sm font-medium" style={{ color: n.is_read ? 'oklch(0.65 0.007 60)' : 'oklch(0.88 0.007 60)' }}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs mt-0.5" style={{ color: TEXT_MUTED }}>{n.body}</p>
                      )}
                      <p className="text-xs mt-1" style={{ color: 'oklch(0.38 0.005 60)' }}>
                        {new Date(n.created_at).toLocaleString('ja-JP')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
