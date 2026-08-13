import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AC = any

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

// POST /api/attendance/corrections/[id]/reject
// attendance_records は絶対に変更しない
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { companyId, userId, adminClient: admin } = auth as { companyId: string; userId: string; adminClient: AC }

  const body = await req.json()
  const trimmedReason = (body?.reject_reason ?? '').trim()
  if (!trimmedReason) {
    return NextResponse.json({ error: '却下理由は必須です' }, { status: 400 })
  }

  // --- 修正申請を取得・検証 ---
  const { data: correction, error: corrErr } = await admin
    .from('attendance_correction_requests')
    .select('id, company_id, worker_id, status, attendance_record_id')
    .eq('id', id)
    .single()

  if (corrErr || !correction) return NextResponse.json({ error: '申請が見つかりません' }, { status: 404 })
  if (correction.company_id !== companyId) return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  if (correction.status !== 'submitted') {
    return NextResponse.json({ error: '申請中の修正申請のみ却下できます' }, { status: 400 })
  }

  const now = new Date().toISOString()

  // --- correction_requests のみ更新（attendance_records は変更しない） ---
  const { data: rejectedCorrection, error: updateErr } = await admin
    .from('attendance_correction_requests')
    .update({
      status:         'rejected',
      reviewed_by:    userId,
      reviewed_at:    now,
      review_comment: trimmedReason,
    })
    .eq('id', id)
    .select()
    .single()

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // --- Worker System内通知（fire-and-forget） ---
  const workDate = await getWorkDate(admin, correction.attendance_record_id)
  void insertSystemNotification(admin, {
    companyId,
    workerId:  correction.worker_id,
    type:      'attendance_correction_rejected',
    title:     '勤怠修正申請が却下されました',
    body:      `${workDate} の勤怠修正申請が却下されました。\n理由: ${trimmedReason}`,
    targetUrl: buildAttendanceUrl(workDate),
  })

  return NextResponse.json({ correction: rejectedCorrection })
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
