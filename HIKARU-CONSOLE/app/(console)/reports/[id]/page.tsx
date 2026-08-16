'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getReport, type ReportContent, type ReportSpot } from '@/services/reports.service'
import { cn } from '@hikaru/ui'
import { Printer, ChevronLeft, CheckCircle2, AlertTriangle, XCircle, Sparkles, FileText, Mail } from 'lucide-react'

// ============================================================
// 印刷スタイル
// ============================================================

const PRINT_STYLES = `
@media print {
  .no-print { display: none !important; }
  body { background: white !important; }
  .report-wrapper { padding: 0 !important; }
  .report-page {
    box-shadow: none !important;
    border-radius: 0 !important;
    max-width: none !important;
  }
  @page {
    size: A4;
    margin: 15mm 15mm 20mm 15mm;
  }
  .spot-card { page-break-inside: avoid; }
  .section-header { page-break-after: avoid; }
}
`

// ============================================================
// スコアカラー
// ============================================================

function getScoreColor(score: number | null): string {
  if (score == null) return 'text-[var(--color-muted-foreground)]'
  if (score >= 75)   return 'text-[var(--color-success)]'
  if (score >= 60)   return 'text-[var(--color-warning)]'
  return 'text-[var(--color-error)]'
}

function getScoreLabel(score: number | null): string {
  if (score == null) return '未評価'
  if (score >= 90)   return '非常に良好'
  if (score >= 75)   return '良好'
  if (score >= 60)   return '普通'
  if (score >= 45)   return '要改善'
  return '不合格'
}

function calcWorkDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return '—'
  const diff = Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 60000)
  if (diff < 60) return `${diff}分`
  const h = Math.floor(diff / 60), m = diff % 60
  return m === 0 ? `${h}時間` : `${h}時間${m}分`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}

// ============================================================
// 推奨バッジ
// ============================================================

function RecBadge({ rec }: { rec: 'pass' | 'check' | 'redo' | null }) {
  if (!rec) return null
  const cfg = {
    pass:  { label: '合格',      cls: 'bg-[var(--color-success-muted)] text-[var(--color-success-foreground)] border border-[var(--color-success)]/30' },
    check: { label: '要確認',    cls: 'bg-[var(--color-warning-muted)] text-[var(--color-warning-foreground)] border border-[var(--color-warning)]/30' },
    redo:  { label: '再清掃推奨', cls: 'bg-[var(--color-error-muted)]   text-[var(--color-error-foreground)]   border border-[var(--color-error)]/30' },
  }[rec]
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', cfg.cls)}>
      {cfg.label}
    </span>
  )
}

// ============================================================
// スコアサークル
// ============================================================

function ScoreCircle({ score }: { score: number | null }) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center w-16 h-16 rounded-full border-2 font-bold shrink-0',
      score != null && score >= 75 ? 'border-[var(--color-success)] bg-[var(--color-success-muted)]' :
      score != null && score >= 60 ? 'border-[var(--color-warning)] bg-[var(--color-warning-muted)]' :
      score != null               ? 'border-[var(--color-error)] bg-[var(--color-error-muted)]' :
                                    'border-[var(--color-border)] bg-[var(--color-muted)]',
      getScoreColor(score)
    )}>
      <span className="text-xl leading-none">{score ?? '—'}</span>
      {score != null && <span className="text-[9px] opacity-70">点</span>}
    </div>
  )
}

// ============================================================
// 報告書本体
// ============================================================

function ReportDocument({ content, version, createdAt }: {
  content: ReportContent
  version: number
  createdAt: string
}) {
  const { project, store, client, job, spots, summary } = content

  return (
    <div className="report-page bg-white max-w-[800px] mx-auto shadow-[0_4px_24px_rgba(0,0,0,0.1)] print:shadow-none" style={{ color: '#111' }}>
      {/* ヘッダー */}
      <div className="bg-[var(--color-primary)] text-white px-8 py-6 print:px-6 print:py-5" style={{ color: 'white' }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium opacity-70 tracking-widest uppercase">HIKARU Quality Report</p>
            <h1 className="text-2xl font-bold mt-1">清掃品質報告書</h1>
          </div>
          <div className="text-right text-sm opacity-80">
            <p>No. {version.toString().padStart(3, '0')}</p>
            <p>{new Date(createdAt).toLocaleDateString('ja-JP')}</p>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-7 print:px-6 print:py-5 print:space-y-5">

        {/* 作業概要テーブル */}
        <section>
          <h2 className="section-header text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 border-b border-gray-200 pb-1.5">
            作業概要
          </h2>
          <table className="w-full text-sm border-collapse">
            <tbody>
              {[
                ['案件名',    project.name],
                ['クライアント', client.name],
                ['作業場所',  store.name],
                ['担当者',    job.worker_name],
                ['作業日',    formatDate(job.work_date)],
                ['開始時刻',  formatTime(job.started_at)],
                ['終了時刻',  job.completed_at ? formatTime(job.completed_at) : '—'],
                ['作業時間',  calcWorkDuration(job.started_at, job.completed_at)],
              ].map(([label, value]) => (
                <tr key={label} className="border-b border-gray-100">
                  <td className="py-2 pr-4 w-32 text-gray-600 font-medium">{label}</td>
                  <td className="py-2 font-medium text-gray-900">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 品質スコアサマリー */}
        <section>
          <h2 className="section-header text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 border-b border-gray-200 pb-1.5">
            品質評価サマリー
          </h2>
          <div className="flex items-center gap-6 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4">
            <ScoreCircle score={summary.overall_score} />
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className={cn('text-4xl font-bold', getScoreColor(summary.overall_score))}>
                  {summary.overall_score}
                </span>
                <span className="text-lg text-gray-500">/ 100点</span>
                <span className={cn('text-sm font-semibold ml-2', getScoreColor(summary.overall_score))}>
                  {getScoreLabel(summary.overall_score)}
                </span>
              </div>
              <div className="flex gap-4 mt-2 text-xs text-gray-600">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-success)]" />
                  合格: {summary.passed_count}箇所
                </span>
                {summary.check_count > 0 && (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-warning)]" />
                    要確認: {summary.check_count}箇所
                  </span>
                )}
                {summary.redo_count > 0 && (
                  <span className="flex items-center gap-1">
                    <XCircle className="h-3.5 w-3.5 text-[var(--color-error)]" />
                    再清掃: {summary.redo_count}箇所
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 作業内容サマリー */}
        <section>
          <h2 className="section-header text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 border-b border-gray-200 pb-1.5">
            本日の作業内容
          </h2>
          <p className="text-sm leading-relaxed text-gray-900">{summary.work_summary}</p>
        </section>

        {/* 品質評価総括 */}
        <section>
          <h2 className="section-header text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 border-b border-gray-200 pb-1.5">
            品質評価
          </h2>
          <p className="text-sm leading-relaxed text-gray-900">{summary.quality_assessment}</p>
        </section>

        {/* 箇所別詳細 */}
        <section>
          <h2 className="section-header text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-200 pb-1.5">
            撮影箇所別詳細 （{spots.length}箇所）
          </h2>
          <div className="space-y-5">
            {spots.map((spot) => (
              <div key={spot.name} className="spot-card border border-gray-200 rounded-xl overflow-hidden">
                {/* スポットヘッダー */}
                <div className="flex items-center justify-between bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-primary)] text-white text-[10px] font-bold shrink-0">
                      {spot.order}
                    </span>
                    <h3 className="font-bold text-base text-gray-900">{spot.name}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {spot.score != null && (
                      <span className={cn('text-sm font-bold', getScoreColor(spot.score))}>
                        {spot.score}点
                      </span>
                    )}
                    <RecBadge rec={spot.recommendation} />
                  </div>
                </div>

                <div className="px-4 py-4 space-y-3">
                  {/* Before / After */}
                  {(spot.before_url || spot.after_url) && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Before（清掃前）</p>
                        {spot.before_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={spot.before_url}
                            alt={`${spot.name} Before`}
                            className="w-full aspect-[4/3] object-cover rounded-lg border border-gray-200"
                          />
                        ) : (
                          <div className="aspect-[4/3] bg-gray-100 rounded-lg flex items-center justify-center">
                            <p className="text-xs text-gray-400">写真なし</p>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wide">After（清掃後）</p>
                        {spot.after_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={spot.after_url}
                            alt={`${spot.name} After`}
                            className="w-full aspect-[4/3] object-cover rounded-lg border border-gray-200"
                          />
                        ) : (
                          <div className="aspect-[4/3] bg-gray-100 rounded-lg flex items-center justify-center">
                            <p className="text-xs text-gray-400">写真なし</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* AIコメント */}
                  {spot.ai_comment && (
                    <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5">
                      <p className="text-xs font-semibold text-blue-700 mb-1 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> AIコメント
                      </p>
                      <p className="text-sm text-gray-900 leading-relaxed">{spot.ai_comment}</p>
                    </div>
                  )}

                  {/* 改善提案 */}
                  {spot.improvements && spot.improvements.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-1">改善提案</p>
                      <ul className="space-y-0.5">
                        {spot.improvements.map((imp, i) => (
                          <li key={i} className="text-xs text-gray-800 flex items-start gap-1">
                            <span className="text-amber-500 mt-0.5 shrink-0">•</span>
                            {imp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 総合評価 */}
        <section>
          <h2 className="section-header text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 border-b border-gray-200 pb-1.5">
            総合評価
          </h2>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 space-y-3">
            <p className="text-sm leading-relaxed text-gray-900">{summary.total_comment}</p>
            {summary.next_recommendations && summary.next_recommendations.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">次回作業への推奨事項</p>
                <ul className="space-y-1">
                  {summary.next_recommendations.map((rec, i) => (
                    <li key={i} className="text-xs text-gray-800 flex items-start gap-1.5">
                      <span className="text-[var(--color-primary)] mt-0.5">→</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* フッター */}
        <footer className="border-t border-gray-200 pt-4 mt-6 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            <p className="font-semibold text-[var(--color-primary)]">HIKARU 清掃品質管理システム</p>
            <p>生成日時: {new Date(content.generated_at).toLocaleString('ja-JP')}</p>
          </div>
          <div className="text-xs text-gray-500 text-right">
            <p>担当: {job.worker_name}</p>
            <p>Ver.{version}</p>
          </div>
        </footer>
      </div>
    </div>
  )
}

// ============================================================
// メインページ
// ============================================================

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [report, setReport]   = React.useState<{ content: ReportContent; version: number; created_at: string; pdf_url?: string | null } | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError]     = React.useState<string | null>(null)

  // PDF生成
  const [pdfLoading, setPdfLoading] = React.useState(false)
  const [pdfUrl,     setPdfUrl]     = React.useState<string | null>(null)

  // メール送信モーダル
  const [emailOpen,    setEmailOpen]    = React.useState(false)
  const [emailLoading, setEmailLoading] = React.useState(false)
  const [emailPreview, setEmailPreview] = React.useState<{
    configured:   boolean
    to_email:     string | null
    subject:      string
    body_text:    string
    pdf_available: boolean
    pdf_filename: string | null
    can_send:     boolean
    reason:       string | null
    is_resend:    boolean
  } | null>(null)

  React.useEffect(() => {
    async function load() {
      const { data, error: err } = await getReport(id)
      if (err || !data) {
        setError('報告書が見つかりませんでした')
      } else {
        setReport({ content: data.content, version: data.version, created_at: data.created_at, pdf_url: (data as any).pdf_url ?? null })
      }
      setLoading(false)
    }
    load()
  }, [id])

  async function handlePdf() {
    setPdfLoading(true)
    try {
      const res  = await fetch(`/api/reports/${id}/pdf`, { method: 'POST', credentials: 'include' })
      const json = await res.json()
      if (!res.ok) { alert(json.error ?? 'PDF生成に失敗しました'); return }
      setPdfUrl(json.signed_url)
      setReport(r => r ? { ...r, pdf_url: json.pdf_path } : r)
    } catch { alert('PDF生成に失敗しました') }
    finally { setPdfLoading(false) }
  }

  async function handleEmailOpen() {
    setEmailLoading(true)
    setEmailOpen(true)
    try {
      const res  = await fetch(`/api/reports/${id}/email`, { credentials: 'include' })
      const json = await res.json()
      setEmailPreview(json)
    } catch {
      alert('メール情報の取得に失敗しました')
      setEmailOpen(false)
    } finally {
      setEmailLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-10 w-10 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-[var(--color-error)]">{error ?? '読み込みエラー'}</p>
        <button
          onClick={() => router.back()}
          className="mt-4 text-sm text-[var(--color-primary)] hover:underline"
        >
          ← 戻る
        </button>
      </div>
    )
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />

      {/* ツールバー */}
      <div className="no-print flex items-center justify-between mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> 報告書一覧
        </button>
        <div className="flex gap-3">
          {/* PDF生成 */}
          <button
            onClick={handlePdf}
            disabled={pdfLoading}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors border',
              'border-[var(--color-border)] text-[var(--color-foreground)] bg-transparent',
              'hover:bg-[var(--color-muted)]/20 disabled:opacity-50'
            )}
          >
            <FileText className="h-4 w-4" /> {pdfLoading ? '生成中...' : 'PDF生成'}
          </button>
          {/* PDF DL */}
          {(pdfUrl || report.pdf_url) && (
            <a href={pdfUrl ?? '#'} target="_blank" rel="noopener noreferrer">
              <button className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold border',
                'border-[var(--color-border)] text-[var(--color-foreground)] bg-transparent hover:bg-[var(--color-muted)]/20'
              )}>
                <FileText className="h-4 w-4" /> PDF
              </button>
            </a>
          )}
          {/* メール送信 */}
          <button
            onClick={handleEmailOpen}
            disabled={emailLoading}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors border',
              'border-[var(--color-border)] text-[var(--color-foreground)] bg-transparent',
              'hover:bg-[var(--color-muted)]/20 disabled:opacity-50'
            )}
          >
            <Mail className="h-4 w-4" /> メール送信
          </button>
          {/* 印刷 */}
          <button
            onClick={() => window.print()}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2',
              'bg-[var(--color-primary)] text-white text-sm font-semibold',
              'hover:bg-[var(--color-primary-hover)] transition-colors'
            )}
          >
            <Printer className="h-4 w-4" /> 印刷
          </button>
        </div>
      </div>

      {/* 報告書本体 */}
      <div className="report-wrapper pb-10">
        <ReportDocument
          content={report.content}
          version={report.version}
          createdAt={report.created_at}
        />
      </div>

      {/* メール送信確認モーダル */}
      {emailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 no-print">
          <div className="mx-4 max-w-lg w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-xl space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center gap-2 text-base font-semibold">
              <Mail className="h-4 w-4" /> メール送信確認
            </div>

            {emailLoading ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">読み込み中...</p>
            ) : emailPreview ? (
              <>
                {/* 送信不可警告 */}
                {(!emailPreview.configured || !emailPreview.can_send) && (
                  <div className="rounded border border-amber-300/40 bg-amber-50/20 px-4 py-3">
                    <p className="text-sm font-medium text-amber-700">
                      {!emailPreview.configured
                        ? 'メール送信設定が完了していません。Resendの接続設定後に送信できます。'
                        : emailPreview.reason}
                    </p>
                  </div>
                )}
                {/* 再送警告 */}
                {emailPreview.is_resend && emailPreview.can_send && (
                  <div className="rounded border border-[var(--color-border)] bg-[var(--color-muted)]/10 px-4 py-3">
                    <p className="text-sm text-[var(--color-muted-foreground)]">この報告書は過去に送信済みです。再送になります。</p>
                  </div>
                )}
                {/* 送信先 */}
                <div>
                  <p className="text-xs font-medium text-[var(--color-muted-foreground)] mb-1">送信先</p>
                  <p className="text-sm font-medium">
                    {emailPreview.to_email ?? <span className="text-red-500">未設定</span>}
                  </p>
                </div>
                {/* 件名 */}
                <div>
                  <p className="text-xs font-medium text-[var(--color-muted-foreground)] mb-1">件名</p>
                  <p className="text-sm">{emailPreview.subject}</p>
                </div>
                {/* 添付PDF */}
                <div>
                  <p className="text-xs font-medium text-[var(--color-muted-foreground)] mb-1">添付PDF</p>
                  {emailPreview.pdf_available
                    ? <p className="text-sm">{emailPreview.pdf_filename}</p>
                    : <p className="text-sm text-[var(--color-muted-foreground)]">未生成（先にPDF生成ボタンでPDFを作成してください）</p>
                  }
                </div>
                {/* 本文 */}
                <div>
                  <p className="text-xs font-medium text-[var(--color-muted-foreground)] mb-1">本文プレビュー</p>
                  <pre className="text-xs whitespace-pre-wrap bg-[var(--color-muted)]/10 rounded border border-[var(--color-border)] p-3 leading-relaxed">
                    {emailPreview.body_text}
                  </pre>
                </div>
              </>
            ) : null}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setEmailOpen(false); setEmailPreview(null) }}
                className="rounded-lg px-4 py-2 text-sm border border-[var(--color-border)] hover:bg-[var(--color-muted)]/20 transition-colors"
              >
                閉じる
              </button>
              <button
                disabled
                title="実送信機能は現在準備中です"
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold bg-[var(--color-primary)] text-white opacity-40 cursor-not-allowed"
              >
                <Mail className="h-4 w-4" /> 送信（準備中）
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
