'use client'

import * as React from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  ChevronLeft, Activity, CheckCircle2, Clock, Camera,
  FileText, Star, AlertCircle, RefreshCw,
} from 'lucide-react'
import Image from 'next/image'

const GOLD = 'oklch(0.73 0.12 78)'
const TEXT_MUTED = 'oklch(0.55 0.008 60)'
const GREEN = 'oklch(0.72 0.18 150)'
const RED = 'oklch(0.65 0.25 27)'

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  in_progress: { label: '作業中', color: GREEN, icon: Activity },
  completed:   { label: '完了', color: GREEN, icon: CheckCircle2 },
  cancelled:   { label: 'キャンセル', color: RED, icon: AlertCircle },
}

const NOTIF_TYPE_MAP: Record<string, { label: string; color: string }> = {
  job_started:        { label: '作業開始', color: GREEN },
  job_completed:      { label: '作業完了', color: GREEN },
  report_ready:       { label: '報告書完成', color: GOLD },
  quality_evaluated:  { label: 'AI評価完了', color: 'oklch(0.68 0.20 230)' },
  redo_requested:     { label: '再清掃', color: RED },
  info:               { label: 'お知らせ', color: TEXT_MUTED },
}

interface TimelineEvent {
  id: string
  time: string
  label: string
  color: string
  type: 'milestone' | 'photo' | 'ai' | 'report'
}

function buildTimeline(
  job: any,
  photos: any[],
  hasReport: boolean
): TimelineEvent[] {
  const events: TimelineEvent[] = []

  if (job.started_at) {
    events.push({
      id: 'start',
      time: new Date(job.started_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      label: '現地到着・作業開始',
      color: GREEN,
      type: 'milestone',
    })
  }

  const beforePhotos = photos.filter((p) => p.photo_type === 'before')
  if (beforePhotos.length > 0) {
    events.push({
      id: 'before-photos',
      time: new Date(beforePhotos[0].created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      label: `Before写真撮影 (${beforePhotos.length}枚)`,
      color: GOLD,
      type: 'photo',
    })
  }

  const afterPhotos = photos.filter((p) => p.photo_type === 'after')
  if (afterPhotos.length > 0) {
    events.push({
      id: 'after-photos',
      time: new Date(afterPhotos[0].created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      label: `After写真撮影 (${afterPhotos.length}枚)`,
      color: GOLD,
      type: 'photo',
    })

    const evaluated = afterPhotos.filter((p) => p.ai_evaluations?.length > 0)
    if (evaluated.length > 0) {
      events.push({
        id: 'ai-eval',
        time: new Date(afterPhotos[afterPhotos.length - 1].created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
        label: `AI品質評価完了 (${evaluated.length}箇所)`,
        color: 'oklch(0.68 0.20 230)',
        type: 'ai',
      })
    }
  }

  if (job.completed_at) {
    events.push({
      id: 'complete',
      time: new Date(job.completed_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      label: '作業完了',
      color: GREEN,
      type: 'milestone',
    })
  }

  if (hasReport) {
    events.push({
      id: 'report',
      time: '—',
      label: '報告書生成完了',
      color: GOLD,
      type: 'report',
    })
  }

  return events
}

interface Props {
  project: any
  perm: any
  jobs: any[]
  photos: any[]
  latestReport: any
  portalAccountId: string
}

export function ProjectDetailClient({ project, perm, jobs, photos, latestReport, portalAccountId }: Props) {
  const [livePhotos, setLivePhotos] = React.useState<any[]>(photos)
  const [liveJobs, setLiveJobs] = React.useState<any[]>(jobs)
  const [liveReport, setLiveReport] = React.useState<any>(latestReport)
  const [activeTab, setActiveTab] = React.useState<'timeline' | 'photos' | 'quality'>('timeline')
  const [isLive, setIsLive] = React.useState(false)

  const latestJob = liveJobs[0]

  // Supabase Realtime サブスクリプション
  React.useEffect(() => {
    const supabase = createClient()
    setIsLive(true)

    const channel = supabase
      .channel(`project-${project.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'photos',
        filter: `job_id=eq.${latestJob?.id}`,
      }, async (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          // 写真更新時: 最新データを再取得
          const { data } = await supabase
            .from('photos')
            .select(`
              id, photo_type, url, storage_path, created_at,
              photo_spots ( name ),
              ai_evaluations ( score, passed, recommendation, comment )
            `)
            .eq('job_id', latestJob.id)
            .order('created_at', { ascending: true })
          if (data) setLivePhotos(data as any[])
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'jobs',
        filter: `project_id=eq.${project.id}`,
      }, async (payload) => {
        const { data } = await supabase
          .from('jobs')
          .select('id, status, work_date, started_at, completed_at, notes, profiles(name)')
          .eq('project_id', project.id)
          .order('work_date', { ascending: false })
          .limit(10)
        if (data) setLiveJobs(data as any[])
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'reports',
        filter: `project_id=eq.${project.id}`,
      }, async (payload) => {
        setLiveReport(payload.new)
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ai_evaluations',
      }, async () => {
        if (!latestJob) return
        const { data } = await supabase
          .from('photos')
          .select(`
            id, photo_type, url, storage_path, created_at,
            photo_spots ( name ),
            ai_evaluations ( score, passed, recommendation, comment )
          `)
          .eq('job_id', latestJob.id)
          .order('created_at', { ascending: true })
        if (data) setLivePhotos(data as any[])
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      setIsLive(false)
    }
  }, [project.id, latestJob?.id])

  const timeline = latestJob ? buildTimeline(latestJob, livePhotos, !!liveReport) : []
  const beforePhotos = livePhotos.filter((p) => p.photo_type === 'before')
  const afterPhotos  = livePhotos.filter((p) => p.photo_type === 'after')
  const evaluatedPhotos = afterPhotos.filter((p) => p.ai_evaluations?.length > 0)

  const tabs = [
    { id: 'timeline', label: 'タイムライン', show: perm.can_view_timeline },
    { id: 'photos',   label: '写真',         show: perm.can_view_photos },
    { id: 'quality',  label: 'AI品質評価',   show: perm.can_view_photos },
  ] as const

  const jobStatus = STATUS_MAP[latestJob?.status] ?? null
  const avgScore = evaluatedPhotos.length > 0
    ? Math.round(evaluatedPhotos.reduce((sum, p) => sum + (p.ai_evaluations?.[0]?.score ?? 0), 0) / evaluatedPhotos.length)
    : null

  return (
    <div className="space-y-6 animate-[slide-up_0.4s_ease-out]">
      {/* パンくず */}
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm hover:opacity-80 transition-opacity"
        style={{ color: TEXT_MUTED }}
      >
        <ChevronLeft className="h-4 w-4" />
        案件一覧
      </Link>

      {/* ヘッダー */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {project.code && (
              <span className="text-xs" style={{ color: 'oklch(0.40 0.006 60)' }}>{project.code}</span>
            )}
            {jobStatus && (
              <span
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
                style={{
                  background: `${jobStatus.color}18`,
                  border: `1px solid ${jobStatus.color}35`,
                  color: jobStatus.color,
                }}
              >
                <jobStatus.icon className="h-3 w-3" />
                {jobStatus.label}
              </span>
            )}
            {isLive && (
              <span
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full animate-pulse"
                style={{
                  background: `${GREEN}18`,
                  border: `1px solid ${GREEN}35`,
                  color: GREEN,
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: GREEN }} />
                LIVE
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold" style={{ color: 'oklch(0.90 0.008 75)' }}>
            {project.name}
          </h1>
          {project.location_name && (
            <p className="text-sm mt-1" style={{ color: TEXT_MUTED }}>{project.location_name}</p>
          )}
        </div>

        {/* サマリー */}
        <div className="flex gap-3">
          {avgScore !== null && (
            <div
              className="flex flex-col items-center px-4 py-3 rounded-xl"
              style={{
                background: 'oklch(0.10 0.005 255 / 0.88)',
                border: `1px solid ${GOLD}22`,
              }}
            >
              <span
                className="text-2xl font-black"
                style={{
                  color: avgScore >= 90 ? GREEN : avgScore >= 70 ? GOLD : RED,
                }}
              >
                {avgScore}
              </span>
              <span className="text-[10px]" style={{ color: TEXT_MUTED }}>平均スコア</span>
            </div>
          )}
          {liveReport && perm.can_view_reports && (
            <Link
              href={`/reports/${liveReport.id}`}
              className="flex flex-col items-center justify-center px-4 py-3 rounded-xl text-center transition-all hover:scale-[1.02]"
              style={{
                background: `${GOLD}10`,
                border: `1px solid ${GOLD}30`,
              }}
            >
              <FileText className="h-5 w-5 mb-1" style={{ color: GOLD }} />
              <span className="text-[10px]" style={{ color: GOLD }}>報告書を見る</span>
            </Link>
          )}
        </div>
      </div>

      {/* ゴールドライン */}
      <div style={{ height: '1px', background: `linear-gradient(90deg, ${GOLD}50, transparent)` }} />

      {/* 最新ジョブ情報バー */}
      {latestJob && (
        <div
          className="flex flex-wrap items-center gap-4 p-4 rounded-xl text-xs"
          style={{
            background: 'oklch(0.09 0.005 255 / 0.88)',
            border: `1px solid ${GOLD}18`,
          }}
        >
          <div>
            <p style={{ color: TEXT_MUTED }}>作業日</p>
            <p className="font-semibold" style={{ color: 'oklch(0.80 0.008 60)' }}>
              {latestJob.work_date}
            </p>
          </div>
          {latestJob.started_at && (
            <div>
              <p style={{ color: TEXT_MUTED }}>開始</p>
              <p className="font-semibold" style={{ color: 'oklch(0.80 0.008 60)' }}>
                {new Date(latestJob.started_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          )}
          {latestJob.completed_at && (
            <div>
              <p style={{ color: TEXT_MUTED }}>終了</p>
              <p className="font-semibold" style={{ color: 'oklch(0.80 0.008 60)' }}>
                {new Date(latestJob.completed_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          )}
          {latestJob.started_at && latestJob.completed_at && (
            <div>
              <p style={{ color: TEXT_MUTED }}>作業時間</p>
              <p className="font-semibold" style={{ color: GOLD }}>
                {Math.round((new Date(latestJob.completed_at).getTime() - new Date(latestJob.started_at).getTime()) / 60000)}分
              </p>
            </div>
          )}
          <div>
            <p style={{ color: TEXT_MUTED }}>担当者</p>
            <p className="font-semibold" style={{ color: 'oklch(0.80 0.008 60)' }}>
              {(latestJob.profiles as any)?.name ?? '—'}
            </p>
          </div>
        </div>
      )}

      {/* タブ */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'oklch(0.08 0.004 255 / 0.80)' }}>
        {tabs.filter((t) => t.show).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200"
            style={{
              background: activeTab === tab.id ? `${GOLD}18` : 'transparent',
              color: activeTab === tab.id ? GOLD : TEXT_MUTED,
              border: activeTab === tab.id ? `1px solid ${GOLD}30` : '1px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* タイムライン */}
      {activeTab === 'timeline' && (
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'oklch(0.09 0.005 255 / 0.88)',
            border: `1px solid ${GOLD}18`,
          }}
        >
          <h2 className="text-sm font-semibold mb-6" style={{ color: GOLD }}>
            作業タイムライン
          </h2>

          {timeline.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-20" style={{ color: GOLD }} />
              <p className="text-sm" style={{ color: TEXT_MUTED }}>
                {latestJob?.status === 'in_progress' ? '作業進行中...' : '作業データがありません'}
              </p>
            </div>
          ) : (
            <div className="relative pl-8">
              {/* 縦線 */}
              <div
                className="absolute left-3 top-2 bottom-2 w-px"
                style={{ background: `linear-gradient(to bottom, ${GOLD}50, ${GOLD}10)` }}
              />

              <div className="space-y-6">
                {timeline.map((event, idx) => (
                  <div key={event.id} className="relative flex items-start gap-4 animate-[slide-up_0.3s_ease-out]" style={{ animationDelay: `${idx * 0.05}s` }}>
                    {/* ドット */}
                    <div
                      className="absolute -left-5 mt-0.5 h-4 w-4 rounded-full flex items-center justify-center"
                      style={{
                        background: `${event.color}22`,
                        border: `2px solid ${event.color}`,
                        boxShadow: `0 0 8px ${event.color}50`,
                      }}
                    >
                      <div className="h-1.5 w-1.5 rounded-full" style={{ background: event.color }} />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs tabular-nums" style={{ color: TEXT_MUTED }}>{event.time}</span>
                        <span className="text-sm font-medium" style={{ color: 'oklch(0.82 0.007 60)' }}>{event.label}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* 作業中インジケーター */}
                {latestJob?.status === 'in_progress' && (
                  <div className="relative flex items-start gap-4">
                    <div
                      className="absolute -left-5 mt-0.5 h-4 w-4 rounded-full flex items-center justify-center animate-pulse"
                      style={{
                        background: `${GREEN}22`,
                        border: `2px solid ${GREEN}`,
                        boxShadow: `0 0 12px ${GREEN}70`,
                      }}
                    >
                      <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: GREEN }} />
                    </div>
                    <div>
                      <span className="text-sm" style={{ color: GREEN }}>作業進行中...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 写真 */}
      {activeTab === 'photos' && (
        <div className="space-y-6">
          {/* Before */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: 'oklch(0.09 0.005 255 / 0.88)',
              border: `1px solid ${GOLD}18`,
            }}
          >
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'oklch(0.68 0.20 230)' }}>
              <Camera className="h-4 w-4" />
              Before 写真 ({beforePhotos.length}枚)
            </h2>
            {beforePhotos.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: TEXT_MUTED }}>写真はありません</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {beforePhotos.map((photo) => (
                  <PhotoCard key={photo.id} photo={photo} type="before" />
                ))}
              </div>
            )}
          </div>

          {/* After */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: 'oklch(0.09 0.005 255 / 0.88)',
              border: `1px solid ${GOLD}18`,
            }}
          >
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: GREEN }}>
              <Camera className="h-4 w-4" />
              After 写真 ({afterPhotos.length}枚)
            </h2>
            {afterPhotos.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: TEXT_MUTED }}>写真はありません</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {afterPhotos.map((photo) => (
                  <PhotoCard key={photo.id} photo={photo} type="after" />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI品質評価 */}
      {activeTab === 'quality' && (
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'oklch(0.09 0.005 255 / 0.88)',
            border: `1px solid ${GOLD}18`,
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold" style={{ color: GOLD }}>
              AI品質評価
            </h2>
            {avgScore !== null && (
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: TEXT_MUTED }}>総合スコア</span>
                <span
                  className="text-2xl font-black"
                  style={{ color: avgScore >= 90 ? GREEN : avgScore >= 70 ? GOLD : RED }}
                >
                  {avgScore}点
                </span>
              </div>
            )}
          </div>

          {evaluatedPhotos.length === 0 ? (
            <div className="text-center py-12">
              <RefreshCw className="h-12 w-12 mx-auto mb-3 opacity-20" style={{ color: GOLD }} />
              <p className="text-sm" style={{ color: TEXT_MUTED }}>AI評価データがありません</p>
            </div>
          ) : (
            <div className="space-y-4">
              {evaluatedPhotos.map((photo) => {
                const eval_ = photo.ai_evaluations?.[0]
                if (!eval_) return null
                const scoreColor = eval_.score >= 90 ? GREEN : eval_.score >= 70 ? GOLD : RED
                const recMap: Record<string, string> = {
                  pass: '合格',
                  check: '要確認',
                  redo: '再清掃',
                }

                return (
                  <div
                    key={photo.id}
                    className="flex flex-col md:flex-row gap-4 p-4 rounded-xl"
                    style={{
                      background: 'oklch(0.12 0.006 255 / 0.70)',
                      border: `1px solid ${scoreColor}20`,
                    }}
                  >
                    <div className="shrink-0">
                      {photo.url ? (
                        <div className="relative h-20 w-20 rounded-lg overflow-hidden">
                          <Image src={photo.url} alt="after" fill className="object-cover" />
                        </div>
                      ) : (
                        <div
                          className="h-20 w-20 rounded-lg flex items-center justify-center"
                          style={{ background: `${GOLD}0a`, border: `1px solid ${GOLD}18` }}
                        >
                          <Camera className="h-6 w-6 opacity-30" style={{ color: GOLD }} />
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold" style={{ color: 'oklch(0.82 0.007 60)' }}>
                          {(photo.photo_spots as any)?.name ?? '撮影箇所'}
                        </p>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xl font-black"
                            style={{ color: scoreColor }}
                          >
                            {eval_.score}点
                          </span>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{
                              background: `${scoreColor}18`,
                              border: `1px solid ${scoreColor}35`,
                              color: scoreColor,
                            }}
                          >
                            {recMap[eval_.recommendation] ?? eval_.recommendation}
                          </span>
                        </div>
                      </div>

                      {/* スコアバー */}
                      <div className="h-1.5 rounded-full mb-3 overflow-hidden" style={{ background: 'oklch(0.15 0.006 255)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-1000"
                          style={{
                            width: `${eval_.score}%`,
                            background: `linear-gradient(90deg, ${scoreColor}80, ${scoreColor})`,
                            boxShadow: `0 0 8px ${scoreColor}60`,
                          }}
                        />
                      </div>

                      <p className="text-xs" style={{ color: TEXT_MUTED }}>{eval_.comment}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PhotoCard({ photo, type }: { photo: any; type: 'before' | 'after' }) {
  const GOLD = 'oklch(0.73 0.12 78)'
  const GREEN = 'oklch(0.72 0.18 150)'
  const BLUE = 'oklch(0.68 0.20 230)'
  const typeColor = type === 'before' ? BLUE : GREEN
  const eval_ = photo.ai_evaluations?.[0]

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'oklch(0.12 0.006 255 / 0.70)',
        border: `1px solid ${typeColor}20`,
      }}
    >
      {/* 写真 */}
      <div className="relative aspect-square">
        {photo.url ? (
          <Image src={photo.url} alt={type} fill className="object-cover" />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: `${GOLD}08` }}
          >
            <Camera className="h-8 w-8 opacity-20" style={{ color: GOLD }} />
          </div>
        )}
        <div
          className="absolute top-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
          style={{
            background: `${typeColor}22`,
            color: typeColor,
            border: `1px solid ${typeColor}40`,
            backdropFilter: 'blur(8px)',
          }}
        >
          {type === 'before' ? 'BEFORE' : 'AFTER'}
        </div>
        {eval_ && (
          <div
            className="absolute top-1.5 right-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold"
            style={{
              background: 'rgb(0 0 0 / 0.7)',
              color: eval_.score >= 90 ? GREEN : eval_.score >= 70 ? GOLD : 'oklch(0.65 0.25 27)',
              backdropFilter: 'blur(8px)',
            }}
          >
            {eval_.score}点
          </div>
        )}
      </div>

      {/* 情報 */}
      <div className="p-2">
        <p className="text-[11px] font-medium truncate" style={{ color: 'oklch(0.72 0.007 60)' }}>
          {(photo.photo_spots as any)?.name ?? '撮影箇所'}
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: 'oklch(0.40 0.005 60)' }}>
          {new Date(photo.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
        </p>
        {eval_ && (
          <p className="text-[10px] mt-1 line-clamp-2" style={{ color: 'oklch(0.50 0.007 60)' }}>
            {eval_.comment}
          </p>
        )}
      </div>
    </div>
  )
}
