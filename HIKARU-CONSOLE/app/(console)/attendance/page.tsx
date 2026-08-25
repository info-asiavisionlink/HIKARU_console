'use client'

import * as React from 'react'
import { PageHeader, Skeleton, Badge } from '@hikaru/ui'
import { Users, Clock, Banknote, CalendarDays, ChevronDown, ChevronRight } from 'lucide-react'

const CONTRACT_LABELS: Record<string, string> = {
  full_time:  '正社員',
  contract:   '契約社員',
  part_time:  'パートタイム',
  hourly:     'アルバイト',
  freelance:  '業務委託',
  dispatched: '派遣社員',
}

function minsToHHMM(mins: number) {
  if (!mins) return '0:00'
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`
}
function fmtTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
}

export default function AttendanceDashboardPage() {
  const today  = new Date()
  const [year, setYear]   = React.useState(today.getFullYear())
  const [month, setMonth] = React.useState(today.getMonth() + 1)
  const [summary, setSummary] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())

  React.useEffect(() => {
    setLoading(true)
    fetch(`/api/attendance?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(json => { setSummary(json.summary ?? []); setLoading(false) })
      .catch(() => { setLoading(false) })
  }, [year, month])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const totalPay      = summary.reduce((s, w) => s + w.totalPay, 0)
  const totalWorkMins = summary.reduce((s, w) => s + w.totalWorkMins, 0)
  const payMonth      = month === 12 ? `${year + 1}年1月` : `${year}年${month + 1}月`

  return (
    <div>
      <PageHeader title="勤怠管理" description="従業員の出退勤・勤務時間・月間報酬を管理します" />

      {/* 月ナビゲーション */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={prevMonth} className="px-3 py-1.5 rounded-lg text-sm border border-[var(--color-border)] hover:bg-[var(--color-bg-elevated)]">◀</button>
        <h2 className="text-xl font-bold">{year}年{month}月</h2>
        <button onClick={nextMonth} className="px-3 py-1.5 rounded-lg text-sm border border-[var(--color-border)] hover:bg-[var(--color-bg-elevated)]">▶</button>
        <span className="ml-auto text-xs text-[var(--color-muted-foreground)]">給与支払: {payMonth}10日</span>
      </div>

      {/* 全体サマリー */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { icon: Users,       label: '対象従業員数', value: `${summary.length}名` },
          { icon: Clock,       label: '合計実働時間',  value: minsToHHMM(totalWorkMins) },
          { icon: Banknote,    label: '合計報酬',      value: `¥${totalPay.toLocaleString()}` },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-5 py-4 flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-muted)]">
              <Icon className="h-5 w-5 text-[var(--color-primary)]" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>
              <p className="text-xl font-bold">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 従業員別テーブル */}
      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : summary.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[var(--color-muted-foreground)]">
          <CalendarDays className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm">この月の勤怠記録がありません</p>
        </div>
      ) : (
        <div className="space-y-2">
          {summary.map((worker) => {
            const isOpen = expanded.has(worker.worker_id)
            return (
              <div key={worker.worker_id} className="rounded-xl border border-[var(--color-border)] overflow-hidden">
                {/* 従業員行 */}
                <button
                  className="w-full flex items-center gap-4 px-4 py-3 bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-elevated)] transition-colors text-left"
                  onClick={() => setExpanded(prev => {
                    const next = new Set(prev)
                    next.has(worker.worker_id) ? next.delete(worker.worker_id) : next.add(worker.worker_id)
                    return next
                  })}
                >
                  {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]" /> : <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{worker.name}</span>
                      {worker.employee_number && <span className="text-xs text-[var(--color-muted-foreground)]">{worker.employee_number}</span>}
                      {worker.contract_type && (
                        <Badge variant="secondary" size="sm">{CONTRACT_LABELS[worker.contract_type] ?? worker.contract_type}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
                      時給 ¥{(worker.hourly_rate ?? 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-6 shrink-0 text-right">
                    <div>
                      <p className="text-xs text-[var(--color-muted-foreground)]">出勤日数</p>
                      <p className="font-bold text-sm">{worker.workDays}日</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--color-muted-foreground)]">実働時間</p>
                      <p className="font-bold text-sm">{minsToHHMM(worker.totalWorkMins)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--color-muted-foreground)]">月間報酬</p>
                      <p className="font-bold text-sm text-[var(--color-primary)]">¥{worker.totalPay.toLocaleString()}</p>
                    </div>
                  </div>
                </button>

                {/* 日別明細 */}
                {isOpen && (
                  <div className="divide-y divide-[var(--color-border)]">
                    <div className="grid grid-cols-7 gap-2 px-4 py-2 bg-[var(--color-bg-elevated)] text-[10px] text-[var(--color-muted-foreground)] font-semibold uppercase tracking-wide">
                      <span>日付</span><span>出勤</span><span>休憩開始</span><span>休憩終了</span><span>退勤</span><span>実働</span><span className="text-right">報酬</span>
                    </div>
                    {worker.records.map((r: any) => (
                      <div key={r.id} className="grid grid-cols-7 gap-2 px-4 py-2.5 text-xs bg-[var(--color-bg)] hover:bg-[var(--color-bg-surface)]">
                        <span className="text-[var(--color-muted-foreground)]">
                          {new Date(`${r.work_date}T00:00:00+09:00`).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short', timeZone: 'Asia/Tokyo' })}
                        </span>
                        <span>{fmtTime(r.clock_in)}</span>
                        <span>{fmtTime(r.break_start)}</span>
                        <span>{fmtTime(r.break_end)}</span>
                        <span>{fmtTime(r.clock_out)}</span>
                        <span className="font-medium">{minsToHHMM(r.work_minutes ?? 0)}</span>
                        <span className="text-right font-bold text-[var(--color-primary)]">
                          {r.daily_pay ? `¥${r.daily_pay.toLocaleString()}` : '—'}
                        </span>
                      </div>
                    ))}
                    <div className="grid grid-cols-7 gap-2 px-4 py-2.5 bg-[var(--color-bg-elevated)] text-xs font-bold">
                      <span className="col-span-5 text-[var(--color-muted-foreground)]">合計</span>
                      <span>{minsToHHMM(worker.totalWorkMins)}</span>
                      <span className="text-right text-[var(--color-primary)]">¥{worker.totalPay.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
