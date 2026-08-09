import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronLeft, Download, Camera, Star, CheckCircle2, AlertCircle } from 'lucide-react'

const GOLD = 'oklch(0.73 0.12 78)'
const TEXT_MUTED = 'oklch(0.55 0.008 60)'
const GREEN = 'oklch(0.72 0.18 150)'
const RED = 'oklch(0.65 0.25 27)'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ReportDetailPage({ params }: Props) {
  const { id } = await params
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

  const { data: report } = await admin
    .from('reports')
    .select(`
      id, created_at, overall_score, content, pdf_url,
      projects ( id, name, code, location_name ),
      jobs ( id, started_at, completed_at, work_date, notes, profiles(name) ),
      profiles ( name )
    `)
    .eq('id', id)
    .single()

  if (!report) notFound()

  // アクセス権チェック
  const projectId = (report.projects as any)?.id
  const { data: perm } = await admin
    .from('client_project_permissions')
    .select('can_view_reports, can_download_pdf')
    .eq('portal_account_id', account.id)
    .eq('project_id', projectId)
    .single()

  if (!perm?.can_view_reports) notFound()

  // 閲覧記録を更新
  const { data: existingView } = await admin
    .from('report_views')
    .select('id, view_count')
    .eq('portal_account_id', account.id)
    .eq('report_id', id)
    .single()

  if (existingView) {
    await admin
      .from('report_views')
      .update({ last_viewed_at: new Date().toISOString(), view_count: existingView.view_count + 1 })
      .eq('id', existingView.id)
  } else {
    await admin
      .from('report_views')
      .insert({ portal_account_id: account.id, report_id: id })
  }

  // 写真とAI評価
  const jobId = (report.jobs as any)?.id
  type Photo = { id: string; photo_type: string; url: string | null; created_at: string; photo_spots: { name: string } | null; ai_evaluations: any[] | null }
  let photos: Photo[] = []
  if (jobId) {
    const { data } = await admin
      .from('photos')
      .select('id, photo_type, url, created_at, photo_spots(name), ai_evaluations(score, passed, recommendation, comment, before_summary, after_summary, comparison)')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true })
    photos = (data as any[]) ?? []
  }

  const content = report.content as any
  const project = report.projects as any
  const job = report.jobs as any
  const worker = report.profiles as any
  const beforePhotos = photos.filter((p) => p.photo_type === 'before')
  const afterPhotos  = photos.filter((p) => p.photo_type === 'after')
  const evaluated    = afterPhotos.filter((p) => p.ai_evaluations?.length)

  const scoreColor = (report.overall_score ?? 0) >= 90 ? GREEN : (report.overall_score ?? 0) >= 70 ? GOLD : RED
  const recLabel: Record<string, string> = { pass: '合格', check: '要確認', redo: '再清掃' }

  return (
    <div className="space-y-6 animate-[slide-up_0.4s_ease-out]">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <Link href="/reports" className="inline-flex items-center gap-1.5 text-sm hover:opacity-80" style={{ color: TEXT_MUTED }}>
          <ChevronLeft className="h-4 w-4" />
          報告書一覧
        </Link>
        <Link
          href={`/reports/${id}/print`}
          target="_blank"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-[1.02]"
          style={{
            background: `${GOLD}14`,
            border: `1px solid ${GOLD}30`,
            color: GOLD,
          }}
        >
          <Download className="h-4 w-4" />
          PDFダウンロード
        </Link>
      </div>

      {/* 報告書カード */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'oklch(0.09 0.005 255 / 0.92)',
          border: `1px solid ${GOLD}25`,
          boxShadow: `0 0 40px ${GOLD}08`,
        }}
      >
        {/* タイトルバー */}
        <div
          className="p-6"
          style={{
            background: `linear-gradient(135deg, oklch(0.08 0.004 260) 0%, oklch(0.11 0.006 255 / 0.80) 100%)`,
            borderBottom: `1px solid ${GOLD}20`,
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs mb-1" style={{ color: TEXT_MUTED }}>
                {new Date(report.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <h1 className="text-xl font-bold" style={{ color: 'oklch(0.92 0.008 75)' }}>
                清掃作業報告書
              </h1>
              <p className="text-sm mt-1" style={{ color: GOLD }}>{project?.name}</p>
            </div>
            {report.overall_score !== null && (
              <div className="text-center">
                <p className="text-4xl font-black" style={{ color: scoreColor }}>
                  {report.overall_score}
                </p>
                <p className="text-xs mt-0.5" style={{ color: TEXT_MUTED }}>総合スコア</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* 基本情報 */}
          <section>
            <h2 className="text-sm font-semibold mb-4" style={{ color: GOLD }}>案件情報</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: '案件名',    value: project?.name },
                { label: '場所',      value: project?.location_name },
                { label: '作業日',    value: job?.work_date },
                { label: '担当者',    value: worker?.name ?? content?.workerName },
                { label: '開始時刻',  value: job?.started_at ? new Date(job.started_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : null },
                { label: '終了時刻',  value: job?.completed_at ? new Date(job.completed_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : null },
                {
                  label: '作業時間',
                  value: job?.started_at && job?.completed_at
                    ? `${Math.round((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 60000)}分`
                    : null,
                },
                { label: '総合評価',  value: report.overall_score !== null ? `${report.overall_score}点` : null },
              ].filter((i) => i.value).map((item) => (
                <div
                  key={item.label}
                  className="p-3 rounded-xl"
                  style={{
                    background: 'oklch(0.12 0.006 255 / 0.70)',
                    border: `1px solid ${GOLD}12`,
                  }}
                >
                  <p className="text-[10px] mb-1" style={{ color: TEXT_MUTED }}>{item.label}</p>
                  <p className="text-sm font-semibold" style={{ color: 'oklch(0.82 0.007 60)' }}>{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* AI品質評価詳細 */}
          {evaluated.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: GOLD }}>
                <Star className="h-4 w-4" />
                AI品質評価詳細
              </h2>
              <div className="space-y-4">
                {evaluated.map((photo) => {
                  const ev = photo.ai_evaluations?.[0]
                  if (!ev) return null
                  const sc = ev.score >= 90 ? GREEN : ev.score >= 70 ? GOLD : RED

                  return (
                    <div
                      key={photo.id}
                      className="p-4 rounded-xl"
                      style={{
                        background: 'oklch(0.12 0.006 255 / 0.60)',
                        border: `1px solid ${sc}20`,
                      }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold" style={{ color: 'oklch(0.82 0.007 60)' }}>
                          {(photo.photo_spots as any)?.name ?? '撮影箇所'}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-black" style={{ color: sc }}>{ev.score}点</span>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: `${sc}18`, border: `1px solid ${sc}35`, color: sc }}
                          >
                            {recLabel[ev.recommendation] ?? ev.recommendation}
                          </span>
                        </div>
                      </div>
                      {/* スコアバー */}
                      <div className="h-1.5 rounded-full mb-3 overflow-hidden" style={{ background: 'oklch(0.18 0.007 255)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${ev.score}%`, background: `linear-gradient(90deg, ${sc}80, ${sc})` }}
                        />
                      </div>
                      <p className="text-xs" style={{ color: TEXT_MUTED }}>{ev.comment}</p>
                      {ev.comparison && (
                        <p className="text-xs mt-2" style={{ color: 'oklch(0.50 0.007 60)' }}>{ev.comparison}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Before / After 写真 */}
          {(beforePhotos.length > 0 || afterPhotos.length > 0) && (
            <section>
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: GOLD }}>
                <Camera className="h-4 w-4" />
                Before / After 写真
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Before */}
                {beforePhotos.length > 0 && (
                  <div>
                    <p className="text-xs mb-3 font-medium" style={{ color: 'oklch(0.68 0.20 230)' }}>Before</p>
                    <div className="grid grid-cols-2 gap-2">
                      {beforePhotos.map((p) => (
                        <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden">
                          {p.url ? (
                            <Image src={p.url} alt="before" fill className="object-cover" />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center" style={{ background: `${GOLD}08` }}>
                              <Camera className="h-6 w-6 opacity-20" style={{ color: GOLD }} />
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 p-1.5" style={{ background: 'linear-gradient(to top, rgb(0 0 0 / 0.7), transparent)' }}>
                            <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.7)' }}>
                              {(p.photo_spots as any)?.name}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* After */}
                {afterPhotos.length > 0 && (
                  <div>
                    <p className="text-xs mb-3 font-medium" style={{ color: GREEN }}>After</p>
                    <div className="grid grid-cols-2 gap-2">
                      {afterPhotos.map((p) => (
                        <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden">
                          {p.url ? (
                            <Image src={p.url} alt="after" fill className="object-cover" />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center" style={{ background: `${GOLD}08` }}>
                              <Camera className="h-6 w-6 opacity-20" style={{ color: GOLD }} />
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 p-1.5" style={{ background: 'linear-gradient(to top, rgb(0 0 0 / 0.7), transparent)' }}>
                            <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.7)' }}>
                              {(p.photo_spots as any)?.name}
                            </p>
                          </div>
                          {(() => {
                            const ev = p.ai_evaluations?.[0]
                            if (!ev) return null
                            const sc = ev.score >= 90 ? GREEN : ev.score >= 70 ? GOLD : RED
                            return (
                              <div className="absolute top-1.5 right-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                                style={{ background: 'rgb(0 0 0 / 0.7)', color: sc }}>
                                {ev.score}点
                              </div>
                            )
                          })()}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 作業者コメント / 管理者コメント */}
          {(content?.workerComment || content?.adminComment || job?.notes) && (
            <section>
              <h2 className="text-sm font-semibold mb-4" style={{ color: GOLD }}>コメント</h2>
              <div className="space-y-3">
                {(content?.workerComment || job?.notes) && (
                  <div
                    className="p-4 rounded-xl"
                    style={{ background: 'oklch(0.12 0.006 255 / 0.60)', border: `1px solid ${GOLD}12` }}
                  >
                    <p className="text-[10px] mb-2" style={{ color: TEXT_MUTED }}>担当者コメント</p>
                    <p className="text-sm" style={{ color: 'oklch(0.78 0.007 60)' }}>
                      {content?.workerComment ?? job?.notes}
                    </p>
                  </div>
                )}
                {content?.adminComment && (
                  <div
                    className="p-4 rounded-xl"
                    style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}20` }}
                  >
                    <p className="text-[10px] mb-2" style={{ color: TEXT_MUTED }}>管理者コメント</p>
                    <p className="text-sm" style={{ color: 'oklch(0.82 0.007 60)' }}>{content.adminComment}</p>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
