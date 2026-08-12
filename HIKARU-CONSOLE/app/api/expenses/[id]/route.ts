import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: expense, error } = await auth.adminClient
    .from('expenses')
    .select(`
      *,
      employees:employee_id (id, name, name_kana, department, position),
      partners:partner_id (id, company_name, contact_person_name),
      projects:project_id (id, name, location_name, address, project_type),
      shifts:shift_id (id, shift_date, start_time, end_time, status),
      jobs:job_id (id, work_date, started_at, completed_at, status),
      expense_receipts (id, file_name, mime_type, storage_path, file_size, created_at)
    `)
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .single()

  if (error || !expense) return NextResponse.json({ error: '経費が見つかりません' }, { status: 404 })

  // profiles は worker_id FK がキャッシュ未登録のため別途取得
  // approved_by / settled_by も同様に別クエリで取得
  const profileIds = [expense.worker_id, expense.approved_by, expense.settled_by].filter(Boolean) as string[]
  const profilesMap: Record<string, { id: string; name: string; email: string }> = {}

  if (profileIds.length > 0) {
    const { data: profileRows } = await auth.adminClient
      .from('profiles')
      .select('id, name, email')
      .in('id', profileIds)

    for (const prof of profileRows ?? []) {
      profilesMap[prof.id] = prof
    }
  }

  return NextResponse.json({
    expense: {
      ...expense,
      profiles: expense.worker_id   ? (profilesMap[expense.worker_id]   ?? null) : null,
      approver: expense.approved_by ? (profilesMap[expense.approved_by] ?? null) : null,
      settler:  expense.settled_by  ? (profilesMap[expense.settled_by]  ?? null) : null,
    },
  })
}
