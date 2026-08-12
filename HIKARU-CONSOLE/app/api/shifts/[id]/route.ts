import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { fireShiftNotification } from '@/lib/line/shift-notifier'
import { fireShiftSystemNotification } from '@/lib/notifications/shift-system'

// GET /api/shifts/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const { data, error } = await auth.adminClient
    .from('shifts')
    .select(`
      *,
      projects:project_id (id, name, location_name, address, project_type),
      employees:employee_id (id, name, name_kana, phone),
      partners:partner_id (id, company_name, contact_person_name, phone)
    `)
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ shift: data })
}

// PUT /api/shifts/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const body = await req.json()
  const allowed = ['project_id','assignee_type','employee_id','partner_id','shift_date','start_time','end_time','notes','status']
  const update: Record<string, unknown> = {}
  for (const k of allowed) if (k in body) update[k] = body[k]

  const { data, error } = await auth.adminClient
    .from('shifts')
    .update(update)
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .select(`
      *,
      projects:project_id (id, name, location_name, address, project_type),
      employees:employee_id (id, name, name_kana, phone),
      partners:partner_id (id, company_name, contact_person_name, phone)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ステータスに応じてイベント種別を決定
  const newStatus = body.status
  const eventType =
    newStatus === 'cancelled' ? 'shift_cancelled' as const :
    newStatus === 'confirmed' ? 'shift_confirmed' as const :
    'shift_updated' as const

  // System内通知 + LINE通知: いずれも業務処理とは独立して実行
  void fireShiftSystemNotification(auth.adminClient, data, eventType)
  void fireShiftNotification(data, auth.companyId, eventType)

  return NextResponse.json({ shift: data })
}

// DELETE /api/shifts/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  // 削除前にシフト情報を取得（通知用）
  const { data: existing } = await auth.adminClient
    .from('shifts')
    .select(`
      *,
      projects:project_id (id, name, location_name),
      employees:employee_id (id, name),
      partners:partner_id (id, company_name, contact_person_name)
    `)
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .single()

  const { error } = await auth.adminClient
    .from('shifts')
    .delete()
    .eq('id', id)
    .eq('company_id', auth.companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (existing) {
    // System内通知 + LINE通知: いずれも業務処理とは独立して実行
    void fireShiftSystemNotification(auth.adminClient, existing, 'shift_cancelled')
    void fireShiftNotification(existing, auth.companyId, 'shift_cancelled')
  }

  return NextResponse.json({ ok: true })
}
