import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AC = any

function calcMinutes(a: string | null, b: string | null): number {
  if (!a || !b) return 0
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000))
}

function toDate(v: string | null | undefined): Date | null {
  if (!v) return null
  const d = new Date(v as string)
  return isNaN(d.getTime()) ? null : d
}

async function insertSystemNotification(
  admin: AC,
  opts: { companyId: string; workerId: string; type: string; title: string; body: string; targetUrl: string }
) {
  try {
    const { error } = await admin.from('notifications').insert({
      company_id:           opts.companyId,
      recipient_profile_id: opts.workerId,
      title:                opts.title,
      body:                 opts.body,
      type:                 opts.type,
      is_read:              false,
      target_url:           opts.targetUrl,
    })
    if (error) console.error(`[System通知] ${opts.type} 挿入失敗:`, error.message)
  } catch (e) {
    console.error('[System通知] 予期しないエラー:', e)
  }
}

// POST /api/attendance/corrections/[id]/approve
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { companyId, userId, adminClient: admin } = auth as { companyId: string; userId: string; adminClient: AC }

  // ボディ（review_commentは任意）
  let review_comment: string | null = null
  try {
    const body = await req.json()
    review_comment = body?.review_comment?.trim() || null
  } catch { /* body optional */ }

  // --- 1. 修正申請を最新状態で再取得 ---
  const { data: correction, error: corrErr } = await admin
    .from('attendance_correction_requests')
    .select('*')
    .eq('id', id)
    .single()

  if (corrErr || !correction) return NextResponse.json({ error: '申請が見つかりません' }, { status: 404 })
  if (correction.company_id !== companyId) return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  if (correction.status !== 'submitted') {
    return NextResponse.json({ error: '申請中の修正申請のみ承認できます' }, { status: 400 })
  }

  // --- 2. 対象 attendance_record を再取得 ---
  const { data: record, error: recErr } = await admin
    .from('attendance_records')
    .select('id, worker_id, company_id, clock_in, clock_out, break_start, break_end, hourly_rate')
    .eq('id', correction.attendance_record_id)
    .single()

  if (recErr || !record) return NextResponse.json({ error: '勤怠記録が見つかりません' }, { status: 404 })
  if (record.company_id !== companyId) return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  if (record.worker_id !== correction.worker_id) return NextResponse.json({ error: '申請データが不整合です' }, { status: 409 })

  // --- 3. original snapshot 競合確認 ---
  // 申請後に attendance_records が変更された場合は 409
  const snapFields: [string, string | null, string | null][] = [
    ['clock_in',    correction.original_clock_in,    record.clock_in],
    ['clock_out',   correction.original_clock_out,   record.clock_out],
    ['break_start', correction.original_break_start, record.break_start],
    ['break_end',   correction.original_break_end,   record.break_end],
  ]

  for (const [field, orig, curr] of snapFields) {
    const origNorm = orig ? new Date(orig).toISOString() : null
    const currNorm = curr ? new Date(curr as string).toISOString() : null
    if (origNorm !== currNorm) {
      return NextResponse.json(
        {
          error: '申請後に勤怠情報が変更されています。内容を再確認してください。',
          field,
          original: origNorm,
          current:  currNorm,
        },
        { status: 409 }
      )
    }
  }

  // --- 4. 承認後の最終値を作成（requested_* が null なら現在値維持） ---
  const final_clock_in    = correction.requested_clock_in    ?? record.clock_in
  const final_clock_out   = correction.requested_clock_out   ?? record.clock_out
  const final_break_start = correction.requested_break_start ?? record.break_start
  const final_break_end   = correction.requested_break_end   ?? record.break_end

  // --- 5. 時刻整合性 validation ---
  const dCi = toDate(final_clock_in)
  const dCo = toDate(final_clock_out)
  const dBs = toDate(final_break_start)
  const dBe = toDate(final_break_end)

  if (dCi && dCo && dCo <= dCi) {
    return NextResponse.json({ error: '退勤時刻は出勤時刻より後にしてください' }, { status: 400 })
  }
  if (dBs && dBe && dBe <= dBs) {
    return NextResponse.json({ error: '休憩終了時刻は休憩開始時刻より後にしてください' }, { status: 400 })
  }
  if (dCi && dBs && dBs < dCi) {
    return NextResponse.json({ error: '休憩開始時刻は出勤時刻より後にしてください' }, { status: 400 })
  }
  if (dCo && dBe && dBe > dCo) {
    return NextResponse.json({ error: '休憩終了時刻は退勤時刻より前にしてください' }, { status: 400 })
  }

  // --- 6. 再計算（attendance_record の hourly_rate を使用） ---
  const hourlyRate = record.hourly_rate ?? 0

  const break_minutes = dBs && dBe ? calcMinutes(final_break_start, final_break_end) : 0
  const work_minutes  = dCi && dCo
    ? Math.max(0, calcMinutes(final_clock_in, final_clock_out) - break_minutes)
    : 0
  const daily_pay = Math.round((work_minutes / 60) * hourlyRate)

  const now = new Date().toISOString()

  // --- 7. attendance_records UPDATE ---
  const { error: recUpdateErr } = await admin
    .from('attendance_records')
    .update({
      clock_in:       final_clock_in,
      clock_out:      final_clock_out,
      break_start:    final_break_start,
      break_end:      final_break_end,
      break_minutes,
      work_minutes,
      daily_pay,
      updated_at:     now,
    })
    .eq('id', correction.attendance_record_id)

  if (recUpdateErr) {
    return NextResponse.json({ error: recUpdateErr.message }, { status: 500 })
  }

  // --- 8. correction_requests status='approved' ---
  const { data: approvedCorrection, error: corrUpdateErr } = await admin
    .from('attendance_correction_requests')
    .update({
      status:         'approved',
      reviewed_by:    userId,
      reviewed_at:    now,
      review_comment: review_comment,
    })
    .eq('id', id)
    .select()
    .single()

  if (corrUpdateErr) {
    console.error('[承認] correction_requests 更新失敗（attendance_records は更新済み）:', corrUpdateErr.message)
    return NextResponse.json({ error: corrUpdateErr.message }, { status: 500 })
  }

  // --- 9. Worker System内通知（fire-and-forget） ---
  const workDate = await getWorkDate(admin, correction.attendance_record_id)
  void insertSystemNotification(admin, {
    companyId,
    workerId:  correction.worker_id,
    type:      'attendance_correction_approved',
    title:     '勤怠修正申請が承認されました',
    body:      `${workDate} の勤怠修正申請が承認されました。`,
    targetUrl: buildAttendanceUrl(workDate),
  })

  return NextResponse.json({ correction: approvedCorrection })
}

async function getWorkDate(admin: AC, attendanceRecordId: string): Promise<string> {
  const { data } = await admin
    .from('attendance_records')
    .select('work_date')
    .eq('id', attendanceRecordId)
    .single()
  return data?.work_date ?? ''
}

function buildAttendanceUrl(workDate: string): string {
  if (!workDate) return '/attendance'
  const [year, month] = workDate.split('-')
  return `/attendance/${year}/${Number(month)}`
}
