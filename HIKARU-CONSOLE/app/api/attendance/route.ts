import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AC = any

export async function GET(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { companyId, adminClient: admin } = auth as { companyId: string; adminClient: AC }

  const year  = req.nextUrl.searchParams.get('year')  ?? new Date().getFullYear().toString()
  const month = req.nextUrl.searchParams.get('month') ?? (new Date().getMonth() + 1).toString()
  const workerId = req.nextUrl.searchParams.get('worker_id') ?? null

  const from = `${year}-${month.padStart(2, '0')}-01`
  const lastDay = new Date(Number(year), Number(month), 0).getDate()
  const to = `${year}-${month.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  // 対象期間の全勤怠記録
  let query = admin
    .from('attendance_records')
    .select('*, profiles(id, name, employee_number, hourly_rate, contract_type)')
    .eq('company_id', companyId)
    .gte('work_date', from)
    .lte('work_date', to)
    .order('work_date', { ascending: true })

  if (workerId) query = query.eq('worker_id', workerId)

  const { data: records, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 従業員ごとに集計
  const workerMap: Record<string, {
    worker_id: string; name: string; employee_number: string | null
    hourly_rate: number; contract_type: string | null
    workDays: number; totalWorkMins: number; totalPay: number
    records: any[]
  }> = {}

  for (const r of (records ?? [])) {
    const wid = r.worker_id
    if (!workerMap[wid]) {
      workerMap[wid] = {
        worker_id: wid,
        name: r.profiles?.name ?? '—',
        employee_number: r.profiles?.employee_number ?? null,
        hourly_rate: r.profiles?.hourly_rate ?? 0,
        contract_type: r.profiles?.contract_type ?? null,
        workDays: 0, totalWorkMins: 0, totalPay: 0, records: [],
      }
    }
    workerMap[wid].records.push(r)
    if (r.clock_out) workerMap[wid].workDays++
    workerMap[wid].totalWorkMins += r.work_minutes ?? 0
    workerMap[wid].totalPay     += r.daily_pay    ?? 0
  }

  return NextResponse.json({
    data: records ?? [],
    summary: Object.values(workerMap),
    year, month,
  })
}
