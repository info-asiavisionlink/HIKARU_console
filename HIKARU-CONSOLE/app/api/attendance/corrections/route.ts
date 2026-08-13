import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AC = any

// GET /api/attendance/corrections
// 管理者: 自社の修正申請一覧（2クエリ方式）
export async function GET(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { companyId, adminClient: admin } = auth as { companyId: string; adminClient: AC }

  const statusFilter = req.nextUrl.searchParams.get('status') // optional

  let query = admin
    .from('attendance_correction_requests')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (statusFilter) query = query.eq('status', statusFilter)

  const { data: corrections, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!corrections || corrections.length === 0) {
    return NextResponse.json({ corrections: [] })
  }

  // workerプロフィールを別クエリで取得（JOIN不安定のため2クエリ方式）
  const workerIds = [...new Set(corrections.map((c: AC) => c.worker_id as string))]
  const profilesMap: Record<string, AC> = {}
  if (workerIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, name')
      .in('id', workerIds)
    for (const p of (profiles ?? [])) profilesMap[p.id] = p
  }

  // attendance_records を別クエリで取得
  const recordIds = [...new Set(corrections.map((c: AC) => c.attendance_record_id as string))]
  const recordsMap: Record<string, AC> = {}
  if (recordIds.length > 0) {
    const { data: records } = await admin
      .from('attendance_records')
      .select('id, work_date, clock_in, clock_out, break_start, break_end, work_minutes, daily_pay')
      .in('id', recordIds)
    for (const r of (records ?? [])) recordsMap[r.id] = r
  }

  const enriched = corrections.map((c: AC) => ({
    ...c,
    worker:           profilesMap[c.worker_id]      ?? null,
    attendance_record: recordsMap[c.attendance_record_id] ?? null,
  }))

  return NextResponse.json({ corrections: enriched })
}
