'use client'

import * as React from 'react'
import { Star, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Send } from 'lucide-react'

const GOLD    = 'oklch(0.73 0.12 78)'
const TEXT    = 'oklch(0.92 0.006 60)'
const MUTED   = 'oklch(0.55 0.008 60)'
const BG_CARD = 'oklch(0.09 0.003 260)'
const BORDER  = 'oklch(0.14 0.005 260)'
const SUCCESS = 'oklch(0.72 0.18 150)'
const ERROR   = 'oklch(0.65 0.25 27)'
const WARNING = 'oklch(0.82 0.17 83)'

interface SurveyJob {
  id: string
  work_date: string
  project_id: string
  ai_score: number | null
  show_ai_score: boolean
  projects: { id: string; name: string; project_type: string; location_name: string | null } | null
  survey: { id: string; rating: number; comment: string | null; created_at: string } | null
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  const dt = new Date(d)
  return `${dt.getFullYear()}/${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}`
}

function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = React.useState(0)
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          style={{
            background: 'none', border: 'none', padding: '2px', cursor: 'pointer',
            color: n <= (hover || value) ? GOLD : MUTED,
            transition: 'color 0.15s',
          }}
        >
          <Star size={28} fill={n <= (hover || value) ? GOLD : 'none'} />
        </button>
      ))}
    </div>
  )
}

function SmallStarInput({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = React.useState(0)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: '13px', color: MUTED }}>{label}</span>
      <div style={{ display: 'flex', gap: '2px' }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(n)}
            style={{ background: 'none', border: 'none', padding: '1px', cursor: 'pointer', color: n <= (hover || value) ? GOLD : MUTED }}
          >
            <Star size={18} fill={n <= (hover || value) ? GOLD : 'none'} />
          </button>
        ))}
      </div>
    </div>
  )
}

function StarDisplay({ value, size = 18 }: { value: number; size?: number }) {
  return (
    <span style={{ display: 'flex', gap: '2px' }}>
      {[1,2,3,4,5].map(n => (
        <Star key={n} size={size} fill={n <= value ? GOLD : 'none'} color={n <= value ? GOLD : MUTED} />
      ))}
    </span>
  )
}

function SurveyForm({ job, onSubmit }: { job: SurveyJob; onSubmit: (jobId: string) => void }) {
  const [rating,        setRating]        = React.useState(0)
  const [comment,       setComment]       = React.useState('')
  const [ratingQuality, setRatingQuality] = React.useState(0)
  const [ratingSpeed,   setRatingSpeed]   = React.useState(0)
  const [ratingAttitude,setRatingAttitude]= React.useState(0)
  const [showDetail,    setShowDetail]    = React.useState(false)
  const [submitting,    setSubmitting]    = React.useState(false)
  const [error,         setError]         = React.useState('')

  async function handleSubmit() {
    if (!rating) { setError('総合評価を選択してください'); return }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/portal/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id:           job.id,
          rating,
          comment:          comment || undefined,
          rating_quality:   ratingQuality  || undefined,
          rating_speed:     ratingSpeed    || undefined,
          rating_attitude:  ratingAttitude || undefined,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        setError(json.error ?? '送信に失敗しました')
      } else {
        onSubmit(job.id)
      }
    } catch {
      setError('送信に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '20px', marginBottom: '12px' }}>
      {/* ジョブヘッダー */}
      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '16px', fontWeight: 700, color: TEXT }}>{job.projects?.name ?? '—'}</p>
        <p style={{ fontSize: '13px', color: MUTED, marginTop: '2px' }}>作業日: {fmtDate(job.work_date)}</p>
        {job.show_ai_score && job.ai_score !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', padding: '8px 12px', background: `${GOLD}10`, border: `1px solid ${GOLD}30`, borderRadius: '8px' }}>
            <span style={{ fontSize: '12px', color: GOLD }}>AI品質スコア</span>
            <span style={{ fontSize: '18px', fontWeight: 700, color: GOLD }}>{job.ai_score}</span>
            <span style={{ fontSize: '11px', color: MUTED }}>/100</span>
          </div>
        )}
      </div>

      <p style={{ fontSize: '14px', color: TEXT, marginBottom: '12px' }}>今回の清掃はいかがでしたか？</p>

      {/* 総合評価 */}
      <div style={{ marginBottom: '16px' }}>
        <StarInput value={rating} onChange={setRating} />
        {rating > 0 && (
          <p style={{ fontSize: '12px', color: MUTED, marginTop: '4px' }}>
            {['', '改善が必要です', '少し不満があります', '普通です', '満足しています', '非常に満足しています'][rating]}
          </p>
        )}
      </div>

      {/* コメント */}
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="ご意見・ご感想があればお聞かせください（任意）"
        rows={3}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'oklch(0.07 0.002 260)', border: `1px solid ${BORDER}`,
          borderRadius: '8px', padding: '10px 12px',
          color: TEXT, fontSize: '14px', resize: 'vertical',
          outline: 'none', fontFamily: 'inherit',
          marginBottom: '12px',
        }}
      />

      {/* 詳細評価（折りたたみ） */}
      <button
        type="button"
        onClick={() => setShowDetail(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: GOLD, fontSize: '13px', cursor: 'pointer', marginBottom: '8px', padding: 0 }}
      >
        {showDetail ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        詳細評価を入力する（任意）
      </button>

      {showDetail && (
        <div style={{ marginBottom: '16px' }}>
          <SmallStarInput label="清掃品質"   value={ratingQuality}  onChange={setRatingQuality} />
          <SmallStarInput label="作業スピード" value={ratingSpeed}   onChange={setRatingSpeed} />
          <SmallStarInput label="スタッフ対応" value={ratingAttitude} onChange={setRatingAttitude} />
        </div>
      )}

      {error && (
        <p style={{ fontSize: '13px', color: ERROR, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <AlertCircle size={14} /> {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || !rating}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          width: '100%', padding: '12px',
          background: rating ? `${GOLD}` : `${GOLD}40`,
          color: 'oklch(0.06 0.003 260)',
          border: 'none', borderRadius: '8px',
          fontWeight: 700, fontSize: '14px', cursor: rating ? 'pointer' : 'not-allowed',
        }}
      >
        <Send size={15} />
        {submitting ? '送信中...' : '評価を送信'}
      </button>
    </div>
  )
}

export default function SurveysPage() {
  const [pending,  setPending]  = React.useState<SurveyJob[]>([])
  const [answered, setAnswered] = React.useState<SurveyJob[]>([])
  const [loading,  setLoading]  = React.useState(true)
  const [submitted, setSubmitted] = React.useState<Set<string>>(new Set())

  React.useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const res = await fetch('/api/portal/surveys')
    if (res.ok) {
      const data = await res.json()
      setPending(data.pending ?? [])
      setAnswered(data.answered ?? [])
    }
    setLoading(false)
  }

  function handleSubmit(jobId: string) {
    setSubmitted(prev => new Set([...prev, jobId]))
    setPending(prev => prev.filter(j => j.id !== jobId))
  }

  const visiblePending = pending.filter(j => !submitted.has(j.id))

  return (
    <div style={{ padding: '24px', maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: TEXT, marginBottom: '4px' }}>作業評価</h1>
        <p style={{ fontSize: '13px', color: MUTED }}>清掃作業のご評価にご協力ください</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: MUTED, fontSize: '14px' }}>読み込み中...</div>
      ) : (
        <>
          {/* 未回答 */}
          {visiblePending.length > 0 && (
            <section style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '13px', fontWeight: 600, color: WARNING, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={14} /> 未回答 ({visiblePending.length}件)
              </h2>
              {visiblePending.map(job => (
                <SurveyForm key={job.id} job={job} onSubmit={handleSubmit} />
              ))}
            </section>
          )}

          {/* 送信完了メッセージ */}
          {submitted.size > 0 && (
            <div style={{ padding: '16px', background: `${SUCCESS}15`, border: `1px solid ${SUCCESS}40`, borderRadius: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle size={18} color={SUCCESS} />
              <p style={{ fontSize: '14px', color: SUCCESS }}>評価を送信しました。ありがとうございます。</p>
            </div>
          )}

          {/* 回答済み */}
          {answered.length > 0 && (
            <section>
              <h2 style={{ fontSize: '13px', fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={14} /> 回答済み ({answered.length}件)
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {answered.map(job => (
                  <div key={job.id} style={{ background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '16px', opacity: 0.7 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: TEXT }}>{job.projects?.name ?? '—'}</p>
                        <p style={{ fontSize: '12px', color: MUTED, marginTop: '2px' }}>{fmtDate(job.work_date)}</p>
                      </div>
                      {job.survey && <StarDisplay value={job.survey.rating} />}
                    </div>
                    {job.survey?.comment && (
                      <p style={{ fontSize: '12px', color: MUTED, marginTop: '8px', fontStyle: 'italic' }}>
                        「{job.survey.comment}」
                      </p>
                    )}
                    {job.survey && (
                      <p style={{ fontSize: '11px', color: MUTED, marginTop: '6px' }}>
                        回答日: {fmtDate(job.survey.created_at)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 何もない場合 */}
          {!visiblePending.length && !submitted.size && !answered.length && (
            <div style={{ textAlign: 'center', padding: '48px 24px', background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: '12px' }}>
              <CheckCircle size={40} style={{ color: MUTED, margin: '0 auto 12px' }} />
              <p style={{ color: MUTED, fontSize: '14px' }}>評価対象の作業はありません</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
