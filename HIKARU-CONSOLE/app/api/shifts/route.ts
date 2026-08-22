import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { fireShiftNotification } from '@/lib/line/shift-notifier'
import { fireShiftSystemNotification } from '@/lib/notifications/shift-system'

// GET /api/shifts
export async function GET(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const p = req.nextUrl.searchParams
  const dateFrom   = p.get('date_from')
  const dateTo     = p.get('date_to')
  const projectId  = p.get('project_id')
  const status     = p.get('status')
  const employeeId = p.get('employee_id')
  const partnerId  = p.get('partner_id')

  let query = auth.adminClient
    .from('shifts')
    .select(`
      *,
      projects:project_id (id, name, location_name, address, project_type),
      employees:employee_id (id, name, name_kana, phone),
      partners:partner_id (id, company_name, contact_person_name, phone)
    `)
    .eq('company_id', auth.companyId)
    .order('shift_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (dateFrom)   query = query.gte('shift_date', dateFrom)
  if (dateTo)     query = query.lte('shift_date', dateTo)
  if (projectId)  query = query.eq('project_id', projectId)
  if (status)     query = query.eq('status', status)
  if (employeeId) query = query.eq('employee_id', employeeId)
  if (partnerId)  query = query.eq('partner_id', partnerId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ shifts: data ?? [] })
}

// POST /api/shifts
export async function POST(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    project_id, assignee_type, employee_id, partner_id,
    shift_date, start_time, end_time, notes, status = 'scheduled',
  } = body

  if (!project_id || !assignee_type || !shift_date || !start_time || !end_time) {
    return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
  }
  if (assignee_type === 'employee' && !employee_id) {
    return NextResponse.json({ error: '従業員を選択してください' }, { status: 400 })
  }
  if (assignee_type === 'partner' && !partner_id) {
    return NextResponse.json({ error: '協力業者を選択してください' }, { status: 400 })
  }

  // project_idが現在のcompany_idに属することを確認（cross-tenant防止）
  const { data: project } = await auth.adminClient
    .from('projects').select('id').eq('id', project_id).eq('company_id', auth.companyId).single()
  if (!project) return NextResponse.json({ error: 'project not found in this company' }, { status: 400 })

  // employee_id/partner_idが現在のcompany_idに属することを確認
  if (assignee_type === 'employee' && employee_id) {
    const { data: emp } = await auth.adminClient
      .from('employees').select('id').eq('id', employee_id).eq('company_id', auth.companyId).single()
    if (!emp) return NextResponse.json({ error: 'employee not found in this company' }, { status: 400 })
  }
  if (assignee_type === 'partner' && partner_id) {
    const { data: ptr } = await auth.adminClient
      .from('partners').select('id').eq('id', partner_id).eq('company_id', auth.companyId).single()
    if (!ptr) return NextResponse.json({ error: 'partner not found in this company' }, { status: 400 })
  }

  const { data, error } = await auth.adminClient
    .from('shifts')
    .insert({
      company_id: auth.companyId,
      project_id,
      assignee_type,
      employee_id:  assignee_type === 'employee' ? employee_id : null,
      partner_id:   assignee_type === 'partner'  ? partner_id  : null,
      shift_date,
      start_time,
      end_time,
      notes,
      status,
      created_by: auth.userId,
    })
    .select(`
      *,
      projects:project_id (id, name, location_name, address, project_type),
      employees:employee_id (id, name, name_kana, phone),
      partners:partner_id (id, company_name, contact_person_name, phone)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // System内通知 + LINE通知: いずれも業務処理とは独立して実行
  void fireShiftSystemNotification(auth.adminClient, data, 'shift_created')
  void fireShiftNotification(data, auth.companyId, 'shift_created')

  return NextResponse.json({ shift: data }, { status: 201 })
}
