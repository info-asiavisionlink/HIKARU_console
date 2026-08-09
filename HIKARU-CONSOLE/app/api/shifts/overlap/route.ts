import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// GET /api/shifts/overlap?assignee_type=employee&assignee_id=xxx&date=2026-08-10&start=09:00&end=12:00&exclude_id=xxx
export async function GET(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const p = req.nextUrl.searchParams
  const assigneeType = p.get('assignee_type') as 'employee' | 'partner'
  const assigneeId   = p.get('assignee_id')
  const date         = p.get('date')
  const start        = p.get('start')
  const end          = p.get('end')
  const excludeId    = p.get('exclude_id')

  if (!assigneeType || !assigneeId || !date || !start || !end) {
    return NextResponse.json({ overlaps: [] })
  }

  const { data, error } = await auth.adminClient.rpc('check_shift_overlap', {
    p_employee_id:   assigneeType === 'employee' ? assigneeId : null,
    p_partner_id:    assigneeType === 'partner'  ? assigneeId : null,
    p_assignee_type: assigneeType,
    p_shift_date:    date,
    p_start_time:    start,
    p_end_time:      end,
    p_exclude_id:    excludeId ?? null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ overlaps: data ?? [] })
}
