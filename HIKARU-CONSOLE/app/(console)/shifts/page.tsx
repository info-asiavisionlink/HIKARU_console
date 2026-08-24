'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader, Breadcrumb, Button, toast } from '@hikaru/ui'
import { getJstDateString } from '@/lib/billing/date-utils'
import {
  Plus, ChevronLeft, ChevronRight, CalendarDays, List,
  Clock, MapPin, User, Zap, RefreshCw, Hotel, Trash2, Check,
} from 'lucide-react'

const GOLD  = 'oklch(0.73 0.12 78)'
const CYAN  = 'oklch(0.85 0.18 198)'
const VIOLET = 'oklch(0.75 0.15 290)'

type ViewMode = 'day' | 'week' | 'month'

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  scheduled:   { label: '予定',    color: GOLD },
  confirmed:   { label: '確定',    color: CYAN },
  in_progress: { label: '作業中',  color: 'oklch(0.75 0.20 145)' },
  completed:   { label: '完了',    color: 'oklch(0.60 0.008 75)' },
  cancelled:   { label: 'キャンセル', color: 'oklch(0.50 0.005 0)' },
}

const TYPE_ICON: Record<string, React.ElementType> = {
  spot: Zap, recurring: RefreshCw, hotel: Hotel,
}

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

function getWeekRange(d: Date) {
  const day = d.getDay()
  const mon = addDays(d, -day + (day === 0 ? -6 : 1))
  const sun = addDays(mon, 6)
  return { from: mon, to: sun }
}

function getMonthRange(d: Date) {
  const from = new Date(d.getFullYear(), d.getMonth(), 1)
  const to   = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return { from, to }
}

interface Shift {
  id: string
  shift_date: string
  start_time: string
  end_time: string
  status: string
  notes: string | null
  assignee_type: string
  employee_id: string | null
  partner_id: string | null
  projects: { id: string; name: string; location_name: string | null; address: string | null; project_type: string } | null
  employees: { id: string; name: string; name_kana: string | null; phone: string | null } | null
  partners:  { id: string; company_name: string; contact_person_name: string | null; phone: string | null } | null
}

export default function ShiftsPage() {
  const router = useRouter()
  const [viewMode, setViewMode] = React.useState<ViewMode>('week')
  const [baseDate, setBaseDate] = React.useState(new Date())
  const [shifts, setShifts]   = React.useState<Shift[]>([])
  const [loading, setLoading] = React.useState(true)

  const dateRange = React.useMemo(() => {
    if (viewMode === 'day')   return { from: baseDate, to: baseDate }
    if (viewMode === 'week')  return getWeekRange(baseDate)
    return getMonthRange(baseDate)
  }, [viewMode, baseDate])

  const fetchShifts = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/shifts?date_from=${formatDate(dateRange.from)}&date_to=${formatDate(dateRange.to)}`,
        { credentials: 'include' }
      )
      if (res.ok) {
        const { shifts: data } = await res.json()
        setShifts(data ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  React.useEffect(() => { fetchShifts() }, [fetchShifts])

  function navigate(dir: number) {
    if (viewMode === 'day')   setBaseDate(d => addDays(d, dir))
    if (viewMode === 'week')  setBaseDate(d => addDays(d, dir * 7))
    if (viewMode === 'month') setBaseDate(d => { const r = new Date(d); r.setMonth(r.getMonth() + dir); return r })
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/shifts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    })
    if (res.ok) { toast.success('ステータスを更新しました'); fetchShifts() }
    else toast.error('更新に失敗しました')
  }

  async function deleteShift(id: string) {
    if (!confirm('このシフトを削除しますか？')) return
    const res = await fetch(`/api/shifts/${id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) { toast.success('シフトを削除しました'); fetchShifts() }
    else toast.error('削除に失敗しました')
  }

  // 日付ごとにグループ化
  const grouped = React.useMemo(() => {
    const map: Record<string, Shift[]> = {}
    for (const s of shifts) {
      if (!map[s.shift_date]) map[s.shift_date] = []
      map[s.shift_date].push(s)
    }
    return map
  }, [shifts])

  // 表示する日付リスト
  const displayDates = React.useMemo(() => {
    const dates: string[] = []
    let cur = new Date(dateRange.from)
    while (cur <= dateRange.to) {
      dates.push(formatDate(cur))
      cur = addDays(cur, 1)
    }
    return dates
  }, [dateRange])

  const rangeLabel = (() => {
    if (viewMode === 'day') return `${formatDate(baseDate)}`
    const f = formatDate(dateRange.from)
    const t = formatDate(dateRange.to)
    if (viewMode === 'week') return `${f} 〜 ${t}`
    return `${baseDate.getFullYear()}年${baseDate.getMonth()+1}月`
  })()

  const today = getJstDateString()

  return (
    <div>
      <PageHeader
        title="シフト管理"
        breadcrumb={<Breadcrumb items={[{ label: 'シフト管理' }]} />}
        actions={
          <Link href="/shifts/new">
            <Button><Plus className="h-4 w-4" />シフト追加</Button>
          </Link>
        }
      />

      {/* コントロールバー */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        {/* 日付ナビゲーション */}
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)}
            className="p-2 rounded-[var(--radius)] transition-colors hover:opacity-80"
            style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}30`, color: GOLD }}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold min-w-[180px] text-center"
            style={{ color: 'oklch(0.90 0.008 75)' }}>
            {rangeLabel}
          </span>
          <button onClick={() => navigate(1)}
            className="p-2 rounded-[var(--radius)] transition-colors hover:opacity-80"
            style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}30`, color: GOLD }}>
            <ChevronRight className="h-4 w-4" />
          </button>
          <button onClick={() => setBaseDate(new Date())}
            className="px-3 py-1.5 text-xs rounded-[var(--radius)] transition-colors"
            style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}30`, color: GOLD }}>
            今日
          </button>
        </div>

        {/* ビュー切替 */}
        <div className="flex rounded-[var(--radius)] overflow-hidden"
          style={{ border: `1px solid ${GOLD}26` }}>
          {(['day','week','month'] as ViewMode[]).map(m => (
            <button key={m}
              onClick={() => setViewMode(m)}
              className="px-4 py-2 text-xs font-medium transition-colors"
              style={viewMode === m
                ? { background: `${GOLD}22`, color: GOLD }
                : { color: 'oklch(0.50 0.007 75)' }}>
              {{ day:'日', week:'週', month:'月' }[m]}
            </button>
          ))}
        </div>
      </div>

      {/* シフト一覧 */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="h-6 w-6 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: `${GOLD}60`, borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div className="space-y-4">
          {displayDates.map(date => {
            const dayShifts = grouped[date] ?? []
            const isToday   = date === today
            const dayLabel  = new Date(`${date}T00:00:00+09:00`).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'Asia/Tokyo' })

            return (
              <div key={date}
                className="rounded-[var(--radius-lg)] overflow-hidden"
                style={{
                  border: isToday ? `1px solid ${GOLD}40` : '1px solid oklch(0.15 0.003 260)',
                  background: isToday ? `${GOLD}06` : 'oklch(0.06 0.003 260)',
                }}>
                {/* 日付ヘッダー */}
                <div className="flex items-center gap-3 px-4 py-2.5"
                  style={{ borderBottom: `1px solid oklch(0.13 0.003 260 / 0.8)` }}>
                  <span className="text-sm font-bold"
                    style={{ color: isToday ? GOLD : 'oklch(0.70 0.008 75)' }}>
                    {dayLabel}
                  </span>
                  {isToday && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: `${GOLD}22`, color: GOLD }}>TODAY</span>
                  )}
                  <span className="text-xs ml-auto" style={{ color: 'oklch(0.45 0.005 75)' }}>
                    {dayShifts.length}件
                  </span>
                  <Link href={`/shifts/new?date=${date}`}>
                    <button className="p-1 rounded hover:opacity-80"
                      style={{ color: `${GOLD}80` }}>
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </Link>
                </div>

                {/* シフトカード */}
                <div className="divide-y" style={{ borderColor: 'oklch(0.11 0.003 260)' }}>
                  {dayShifts.length === 0 ? (
                    <p className="px-4 py-3 text-xs" style={{ color: 'oklch(0.35 0.005 75)' }}>
                      シフトなし
                    </p>
                  ) : dayShifts.map(shift => {
                    const st = STATUS_STYLES[shift.status] ?? STATUS_STYLES.scheduled
                    const assigneeName = shift.assignee_type === 'employee'
                      ? (shift.employees?.name ?? '—')
                      : (shift.partners?.contact_person_name ?? shift.partners?.company_name ?? '—')
                    const proj = shift.projects
                    const ProjIcon = proj ? (TYPE_ICON[proj.project_type] ?? Zap) : Zap

                    return (
                      <div key={shift.id} className="flex items-start gap-4 px-4 py-3">
                        {/* 時間 */}
                        <div className="w-24 shrink-0">
                          <p className="text-xs font-bold tabular-nums" style={{ color: GOLD }}>
                            {shift.start_time.slice(0,5)}
                          </p>
                          <p className="text-[10px] tabular-nums" style={{ color: 'oklch(0.50 0.007 75)' }}>
                            〜{shift.end_time.slice(0,5)}
                          </p>
                        </div>

                        {/* 案件・担当者 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <ProjIcon className="h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} />
                            <span className="text-sm font-semibold truncate"
                              style={{ color: 'oklch(0.92 0.008 75)' }}>
                              {proj?.name ?? '—'}
                            </span>
                          </div>
                          {proj?.location_name && (
                            <div className="flex items-center gap-1 mb-1">
                              <MapPin className="h-3 w-3 shrink-0" style={{ color: 'oklch(0.50 0.007 75)' }} />
                              <span className="text-xs truncate" style={{ color: 'oklch(0.55 0.007 75)' }}>
                                {proj.location_name}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3 shrink-0" style={{ color: 'oklch(0.50 0.007 75)' }} />
                            <span className="text-xs" style={{ color: 'oklch(0.65 0.008 75)' }}>
                              {assigneeName}
                              <span className="ml-1 text-[10px]"
                                style={{ color: 'oklch(0.45 0.005 75)' }}>
                                ({shift.assignee_type === 'employee' ? '従業員' : '協力業者'})
                              </span>
                            </span>
                          </div>
                        </div>

                        {/* ステータス + アクション */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                            style={{ background: `${st.color}18`, color: st.color, border: `1px solid ${st.color}30` }}>
                            {st.label}
                          </span>

                          {/* 確定ボタン */}
                          {shift.status === 'scheduled' && (
                            <button onClick={() => updateStatus(shift.id, 'confirmed')}
                              title="確定する"
                              className="p-1.5 rounded hover:opacity-80 transition-opacity"
                              style={{ background: `${CYAN}18`, border: `1px solid ${CYAN}30`, color: CYAN }}>
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* 削除ボタン */}
                          <button onClick={() => deleteShift(shift.id)}
                            title="削除"
                            className="p-1.5 rounded hover:opacity-80 transition-opacity"
                            style={{ color: 'oklch(0.55 0.18 25)' }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {displayDates.length > 0 && Object.keys(grouped).length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-40 gap-3"
              style={{ color: 'oklch(0.40 0.005 75)' }}>
              <CalendarDays className="h-10 w-10 opacity-30" />
              <p className="text-sm">この期間にシフトはありません</p>
              <Link href="/shifts/new">
                <Button variant="outline" size="sm"><Plus className="h-4 w-4" />シフトを追加</Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
