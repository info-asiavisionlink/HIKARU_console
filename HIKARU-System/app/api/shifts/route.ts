import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/shifts?date_from=2026-08-01&date_to=2026-08-31
// 自分に割り当てられたシフトのみ返す（RLSで強制）
export async function GET(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const p        = req.nextUrl.searchParams
  const dateFrom = p.get('date_from')
  const dateTo   = p.get('date_to')

  const supabase = await createClient()

  // entity_type / entity_id を取得
  const { data: profile } = await supabase
    .from('profiles')
    .select('entity_type, entity_id')
    .eq('id', uid)
    .single()

  if (!profile?.entity_type || !profile?.entity_id) {
    return NextResponse.json({ shifts: [] })
  }

  // employee_id または partner_id でフィルタ
  const idColumn = profile.entity_type === 'employee' ? 'employee_id' : 'partner_id'

  let query = supabase
    .from('shifts')
    .select(`
      id, shift_date, start_time, end_time, status, notes,
      assignee_type,
      projects:project_id (id, name, location_name, address, project_type)
    `)
    .eq(idColumn, profile.entity_id)
    .neq('status', 'cancelled')
    .order('shift_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (dateFrom) query = query.gte('shift_date', dateFrom)
  if (dateTo)   query = query.lte('shift_date', dateTo)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ shifts: data ?? [] })
}
