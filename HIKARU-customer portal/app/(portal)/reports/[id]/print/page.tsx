import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import Image from 'next/image'
import { PrintButton } from './PrintButton'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ReportPrintPage({ params }: Props) {
  const { id } = await params
  const cookieStore = await cookies()
  const uid = cookieStore.get('hk_cp_uid')?.value
  if (!uid) redirect('/login')

  const admin = createAdminClient()

  const { data: account } = await admin
    .from('client_portal_accounts')
    .select('id, contact_name, clients(name)')
    .eq('profile_id', uid)
    .single()

  if (!account) redirect('/login')

  const { data: report } = await admin
    .from('reports')
    .select(`
      id, created_at, overall_score, content,
      projects ( id, name, code, location_name ),
      jobs ( id, started_at, completed_at, work_date, notes, profiles(name) ),
      profiles ( name )
    `)
    .eq('id', id)
    .single()

  if (!report) notFound()

  const projectId = (report.projects as any)?.id
  const { data: perm } = await admin
    .from('client_project_permissions')
    .select('can_view_reports, can_download_pdf')
    .eq('portal_account_id', account.id)
    .eq('project_id', projectId)
    .single()

  if (!perm?.can_view_reports) notFound()

  const jobId = (report.jobs as any)?.id
  type Photo = { id: string; photo_type: string; url: string | null; photo_spots: { name: string } | null; ai_evaluations: any[] | null }
  let photos: Photo[] = []
  if (jobId) {
    const { data } = await admin
      .from('photos')
      .select('id, photo_type, url, photo_spots(name), ai_evaluations(score, passed, recommendation, comment)')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true })
    photos = (data as any[]) ?? []
  }

  const project = report.projects as any
  const job = report.jobs as any
  const worker = report.profiles as any
  const content = report.content as any
  const beforePhotos = photos.filter((p) => p.photo_type === 'before')
  const afterPhotos  = photos.filter((p) => p.photo_type === 'after')
  const evaluated    = afterPhotos.filter((p) => p.ai_evaluations?.length)

  const recLabel: Record<string, string> = { pass: '合格', check: '要確認', redo: '再清掃' }
  const clientName = (account.clients as any)?.name ?? ''

  return (
    <html lang="ja">
      <head>
        <title>{`清掃作業報告書 - ${project?.name}`}</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', sans-serif; background: white; color: #111; font-size: 12px; line-height: 1.6; }
          .page { max-width: 800px; margin: 0 auto; padding: 40px; }
          .header { border-bottom: 2px solid #b8930a; padding-bottom: 20px; margin-bottom: 24px; }
          .logo { display: inline-block; background: linear-gradient(135deg, #a07808, #d4a418, #f0c44a); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 20px; font-weight: 900; }
          .title { font-size: 22px; font-weight: 700; margin-top: 12px; }
          .section { margin-bottom: 24px; }
          .section-title { font-size: 13px; font-weight: 700; color: #b8930a; border-left: 3px solid #b8930a; padding-left: 8px; margin-bottom: 12px; }
          .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
          .info-item { background: #f9f7f2; border: 1px solid #e8dfc8; border-radius: 6px; padding: 8px 10px; }
          .info-label { font-size: 10px; color: #888; margin-bottom: 2px; }
          .info-value { font-size: 12px; font-weight: 600; color: #333; }
          .score-big { font-size: 40px; font-weight: 900; text-align: center; }
          .score-green { color: #1a8a4a; }
          .score-gold  { color: #b8930a; }
          .score-red   { color: #c0392b; }
          .eval-item { border: 1px solid #e8dfc8; border-radius: 8px; padding: 12px; margin-bottom: 8px; }
          .eval-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
          .eval-name { font-weight: 600; font-size: 13px; }
          .eval-score { font-size: 20px; font-weight: 900; }
          .score-bar { height: 4px; background: #eee; border-radius: 2px; overflow: hidden; margin-bottom: 6px; }
          .score-bar-fill { height: 100%; border-radius: 2px; }
          .photo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
          .photo-item { position: relative; aspect-ratio: 1; border-radius: 6px; overflow: hidden; background: #f5f5f5; }
          .photo-item img { width: 100%; height: 100%; object-fit: cover; }
          .photo-label { font-size: 10px; color: #666; margin-top: 3px; text-align: center; }
          .comment-box { background: #f9f7f2; border: 1px solid #e8dfc8; border-radius: 6px; padding: 12px; }
          .print-btn { position: fixed; top: 16px; right: 16px; background: #b8930a; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
          @media print {
            .no-print { display: none !important; }
            body { background: white; }
            .page { padding: 24px; }
          }
        `}</style>
      </head>
      <body>
        <div className="no-print" style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999 }}>
          <PrintButton />
        </div>

        <div className="page">
          {/* ヘッダー */}
          <div className="header">
            <div className="logo">HIKARU</div>
            <div className="title">清掃作業報告書</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
              {clientName} 御中 / 発行日: {new Date(report.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>

          {/* 総合スコア */}
          {report.overall_score !== null && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
              <div style={{ textAlign: 'center', border: '2px solid #b8930a', borderRadius: 12, padding: '16px 32px' }}>
                <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>総合品質スコア</div>
                <div
                  className={`score-big ${report.overall_score >= 90 ? 'score-green' : report.overall_score >= 70 ? 'score-gold' : 'score-red'}`}
                >
                  {report.overall_score}点
                </div>
                <div style={{ fontSize: 11, color: '#888' }}>
                  {report.overall_score >= 90 ? '非常に良好' : report.overall_score >= 70 ? '良好' : '要改善'}
                </div>
              </div>
            </div>
          )}

          {/* 案件情報 */}
          <div className="section">
            <div className="section-title">案件情報</div>
            <div className="info-grid">
              {[
                { label: '案件名', value: project?.name },
                { label: '作業場所', value: project?.location_name },
                { label: '作業日', value: job?.work_date },
                { label: '担当者', value: worker?.name ?? content?.workerName },
                {
                  label: '開始時刻',
                  value: job?.started_at ? new Date(job.started_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : null,
                },
                {
                  label: '終了時刻',
                  value: job?.completed_at ? new Date(job.completed_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : null,
                },
                {
                  label: '作業時間',
                  value: job?.started_at && job?.completed_at
                    ? `${Math.round((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 60000)}分`
                    : null,
                },
              ].filter((i) => i.value).map((item) => (
                <div key={item.label} className="info-item">
                  <div className="info-label">{item.label}</div>
                  <div className="info-value">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* AI品質評価 */}
          {evaluated.length > 0 && (
            <div className="section">
              <div className="section-title">AI品質評価</div>
              {evaluated.map((photo) => {
                const ev = photo.ai_evaluations?.[0]
                if (!ev) return null
                const isGreen = ev.score >= 90
                const isGold  = ev.score >= 70

                return (
                  <div key={photo.id} className="eval-item">
                    <div className="eval-header">
                      <div className="eval-name">{(photo.photo_spots as any)?.name ?? '撮影箇所'}</div>
                      <div>
                        <span className={`eval-score ${isGreen ? 'score-green' : isGold ? 'score-gold' : 'score-red'}`}>
                          {ev.score}点
                        </span>
                        <span style={{
                          marginLeft: 8,
                          fontSize: 10,
                          background: isGreen ? '#e8f9ef' : isGold ? '#fdf6e3' : '#fdf0ed',
                          color: isGreen ? '#1a8a4a' : isGold ? '#b8930a' : '#c0392b',
                          padding: '2px 8px',
                          borderRadius: 99,
                        }}>
                          {recLabel[ev.recommendation] ?? ev.recommendation}
                        </span>
                      </div>
                    </div>
                    <div className="score-bar">
                      <div
                        className="score-bar-fill"
                        style={{
                          width: `${ev.score}%`,
                          background: isGreen ? '#1a8a4a' : isGold ? '#b8930a' : '#c0392b',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 11, color: '#555' }}>{ev.comment}</div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Before 写真 */}
          {beforePhotos.length > 0 && (
            <div className="section">
              <div className="section-title">Before 写真</div>
              <div className="photo-grid">
                {beforePhotos.map((p) => (
                  <div key={p.id}>
                    <div className="photo-item">
                      {p.url && <img src={p.url} alt="before" />}
                    </div>
                    <div className="photo-label">{(p.photo_spots as any)?.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* After 写真 */}
          {afterPhotos.length > 0 && (
            <div className="section">
              <div className="section-title">After 写真</div>
              <div className="photo-grid">
                {afterPhotos.map((p) => (
                  <div key={p.id}>
                    <div className="photo-item">
                      {p.url && <img src={p.url} alt="after" />}
                    </div>
                    <div className="photo-label">
                      {(p.photo_spots as any)?.name}
                      {p.ai_evaluations?.[0] && ` (${p.ai_evaluations[0].score}点)`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* コメント */}
          {(content?.workerComment || job?.notes || content?.adminComment) && (
            <div className="section">
              <div className="section-title">コメント</div>
              {(content?.workerComment || job?.notes) && (
                <div className="comment-box" style={{ marginBottom: 8 }}>
                  <div className="info-label">担当者コメント</div>
                  <div>{content?.workerComment ?? job?.notes}</div>
                </div>
              )}
              {content?.adminComment && (
                <div className="comment-box">
                  <div className="info-label">管理者コメント</div>
                  <div>{content.adminComment}</div>
                </div>
              )}
            </div>
          )}

          {/* フッター */}
          <div style={{ borderTop: '1px solid #e8dfc8', marginTop: 32, paddingTop: 16, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#aaa' }}>
            <span>HIKARU 清掃管理システム</span>
            <span>このレポートはAIにより自動生成されました</span>
            <span>{new Date().toLocaleDateString('ja-JP')}</span>
          </div>
        </div>
      </body>
    </html>
  )
}
