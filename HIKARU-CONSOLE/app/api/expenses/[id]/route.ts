import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await auth.adminClient
    .from('expenses')
    .select(`
      *,
      profiles:worker_id (id, name, email, phone, entity_type, entity_id),
      employees:employee_id (id, name, name_kana, department, position),
      partners:partner_id (id, company_name, contact_person_name),
      projects:project_id (id, name, location_name, address, project_type),
      shifts:shift_id (id, shift_date, start_time, end_time, status),
      jobs:job_id (id, work_date, started_at, completed_at, status),
      expense_receipts (id, file_name, mime_type, storage_path, file_size, created_at),
      approver:approved_by (id, name),
      settler:settled_by (id, name)
    `)
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ expense: data })
}
