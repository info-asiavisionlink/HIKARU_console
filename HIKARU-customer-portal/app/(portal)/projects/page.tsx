import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { FolderOpen, ChevronRight, Activity, CheckCircle2, Clock, Tag } from 'lucide-react'

const GOLD = 'oklch(0.73 0.12 78)'
const TEXT_MUTED = 'oklch(0.55 0.008 60)'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active:    { label: '進行中', color: 'oklch(0.72 0.18 150)' },
  paused:    { label: '一時停止', color: 'oklch(0.73 0.12 78)' },
  completed: { label: '完了', color: 'oklch(0.60 0.010 75)' },
  cancelled: { label: 'キャンセル', color: 'oklch(0.65 0.25 27)' },
}

const TYPE_MAP: Record<string, string> = {
  recurring: '定期案件',
  hotel:     'ホテル案件',
  spot:      'スポット案件',
}

export default async function ProjectsPage() {
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
    .select('project_id, can_view_reports, can_view_photos, can_view_timeline')
    .eq('portal_account_id', account.id)

  const projectIds = perms?.map((p) => p.project_id) ?? []

  if (projectIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <FolderOpen className="h-16 w-16 opacity-20" style={{ color: GOLD }} />
        <p className="text-sm" style={{ color: TEXT_MUTED }}>閲覧可能な案件がありません</p>
      </div>
    )
  }

  const { data: projects } = await admin
    .from('projects')
    .select('id, name, code, status, start_date, end_date, location_name')
    .in('id', projectIds)
    .order('created_at', { ascending: false })

  // 各案件の最新ジョブ情報
  type JobInfo = { project_id: string; started_at: string; completed_at: string | null; status: string }
  const jobInfoMap: Record<string, JobInfo> = {}
  if (projectIds.length > 0) {
    const { data: latestJobs } = await admin
      .from('jobs')
      .select('project_id, started_at, completed_at, status')
      .in('project_id', projectIds)
      .order('started_at', { ascending: false })

    latestJobs?.forEach((j: JobInfo) => {
      if (!jobInfoMap[j.project_id]) {
        jobInfoMap[j.project_id] = j
      }
    })
  }

  return (
    <div className="space-y-6 animate-[slide-up_0.4s_ease-out]">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'oklch(0.90 0.008 75)' }}>
          案件一覧
        </h1>
        <p className="text-sm mt-1" style={{ color: TEXT_MUTED }}>
          閲覧可能な案件: <span style={{ color: GOLD }}>{projectIds.length}</span> 件
        </p>
      </div>

      <div style={{ height: '1px', background: `linear-gradient(90deg, ${GOLD}50, transparent)` }} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects?.map((project) => {
          const status = STATUS_MAP[project.status] ?? STATUS_MAP.active
          const latestJob = jobInfoMap[project.id]
          const perm = perms?.find((p) => p.project_id === project.id)

          return (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="group block rounded-2xl p-5 transition-all duration-200 hover:scale-[1.01]"
              style={{
                background: 'oklch(0.09 0.005 255 / 0.88)',
                border: `1px solid ${GOLD}20`,
                boxShadow: `0 0 20px ${GOLD}06`,
              }}
            >
              {/* ヘッダー */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: `${status.color}18`,
                        border: `1px solid ${status.color}35`,
                        color: status.color,
                      }}
                    >
                      {status.label}
                    </span>
                    {project.code && (
                      <span className="text-[10px]" style={{ color: 'oklch(0.40 0.006 60)' }}>
                        {project.code}
                      </span>
                    )}
                  </div>
                  <h3
                    className="text-base font-semibold truncate group-hover:text-gold-gradient transition-all"
                    style={{ color: 'oklch(0.88 0.007 60)' }}
                  >
                    {project.name}
                  </h3>
                  {project.location_name && (
                    <p className="text-xs mt-0.5" style={{ color: TEXT_MUTED }}>{project.location_name}</p>
                  )}
                </div>
                <ChevronRight
                  className="h-5 w-5 shrink-0 ml-2 transition-transform group-hover:translate-x-0.5"
                  style={{ color: GOLD }}
                />
              </div>

              {/* 期間 */}
              <div className="flex items-center gap-4 mb-4">
                {project.start_date && (
                  <div>
                    <p className="text-[10px]" style={{ color: 'oklch(0.40 0.006 60)' }}>開始</p>
                    <p className="text-xs" style={{ color: 'oklch(0.70 0.008 60)' }}>
                      {project.start_date}
                    </p>
                  </div>
                )}
                {project.end_date && (
                  <>
                    <span className="text-xs" style={{ color: 'oklch(0.30 0.004 60)' }}>→</span>
                    <div>
                      <p className="text-[10px]" style={{ color: 'oklch(0.40 0.006 60)' }}>終了</p>
                      <p className="text-xs" style={{ color: 'oklch(0.70 0.008 60)' }}>
                        {project.end_date}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* 最新ジョブ */}
              {latestJob && (
                <div
                  className="flex items-center gap-2 p-2.5 rounded-xl text-xs"
                  style={{
                    background: `${GOLD}0a`,
                    border: `1px solid ${GOLD}18`,
                  }}
                >
                  {latestJob.status === 'in_progress' ? (
                    <Activity className="h-3.5 w-3.5 animate-pulse" style={{ color: 'oklch(0.72 0.18 150)' }} />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" style={{ color: 'oklch(0.72 0.18 150)' }} />
                  )}
                  <span style={{ color: 'oklch(0.65 0.008 60)' }}>
                    最新作業: {new Date(latestJob.started_at).toLocaleDateString('ja-JP')}
                  </span>
                  {latestJob.status === 'in_progress' && (
                    <span
                      className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full animate-pulse"
                      style={{
                        background: 'oklch(0.72 0.18 150 / 0.15)',
                        color: 'oklch(0.72 0.18 150)',
                      }}
                    >
                      作業中
                    </span>
                  )}
                </div>
              )}

              {/* 権限バッジ */}
              <div className="flex gap-1.5 mt-3">
                {perm?.can_view_timeline && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${GOLD}12`, color: GOLD, border: `1px solid ${GOLD}25` }}>リアルタイム</span>
                )}
                {perm?.can_view_photos && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${GOLD}12`, color: GOLD, border: `1px solid ${GOLD}25` }}>写真</span>
                )}
                {perm?.can_view_reports && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${GOLD}12`, color: GOLD, border: `1px solid ${GOLD}25` }}>報告書</span>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
