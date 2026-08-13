import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AC = any

// GET /api/attendance/corrections/[id]
// 管理者: 修正申請詳細（他社閲覧不可）
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { companyId, adminClient: admin } = auth as { companyId: string; adminClient: AC }

  const { data: correction, error } = await admin
    .from('attendance_correction_requests')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !correction) return NextResponse.json({ error: '申請が見つかりません' }, { status: 404 })
  if (correction.company_id !== companyId) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

  // 申請者プロフィール
  const { data: worker } = await admin
    .from('profiles')
    .select('id, name')
    .eq('id', correction.worker_id)
    .single()

  // 現在の attendance_record（最新値）
  const { data: attendanceRecord } = await admin
    .from('attendance_records')
    .select('id, work_date, clock_in, clock_out, break_start, break_end, work_minutes, break_minutes, daily_pay, hourly_rate')
    .eq('id', correction.attendance_record_id)
    .single()

  // 承認者プロフィール（あれば）
  let reviewer = null
  if (correction.reviewed_by) {
    const { data: rev } = await admin
      .from('profiles')
      .select('id, name')
      .eq('id', correction.reviewed_by)
      .single()
    reviewer = rev
  }

  return NextResponse.json({
    correction: { ...correction, worker, attendance_record: attendanceRecord, reviewer },
  })
}
