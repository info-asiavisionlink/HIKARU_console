import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import {
  diffAssignments,
  diffRemoved,
  detectDetailChanges,
  fireProjectAssignedNotifications,
  fireProjectUnassignedNotifications,
  fireProjectStatusNotifications,
  fireProjectDetailsChangedNotifications,
  type ProjectStatusEventType,
} from '@/lib/notifications/project-system'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const [projectRes, schedulesRes, assignmentsRes] = await Promise.all([
    auth.adminClient.from('projects')
      .select(`*, recurring_project_details(*), clients(id, name)`)
      .eq('id', id).eq('company_id', auth.companyId).single(),
    auth.adminClient.from('recurring_monthly_schedules')
      .select('*').eq('project_id', id).order('month'),
    auth.adminClient.from('project_assignments').select('*').eq('project_id', id),
  ])

  if (projectRes.error) return NextResponse.json({ error: projectRes.error.message }, { status: 404 })

  return NextResponse.json({
    data: {
      ...projectRes.data,
      monthly_schedules: schedulesRes.data ?? [],
      assignments: assignmentsRes.data ?? [],
    },
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // company_id / id / created_at はサーバー側で決定し Body を信頼しない
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { recurring_details, monthly_schedules, assignments, company_id: _cid, id: _pid, created_at: _ca, updated_at: _ua, ...projectFields } = await req.json()
  const client = auth.adminClient

  // status・詳細変更通知のため更新前データを取得
  const { data: beforeProject } = await client
    .from('projects')
    .select('status, location_name, address, start_date, end_date, work_start_time, work_end_time')
    .eq('id', id).eq('company_id', auth.companyId).single()
  const beforeStatus = beforeProject?.status ?? null

  const { data, error } = await client
    .from('projects')
    .update({ ...projectFields, updated_at: new Date().toISOString() })
    .eq('id', id).eq('company_id', auth.companyId)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (recurring_details) {
    await client.from('recurring_project_details')
      .upsert({ project_id: id, ...recurring_details }, { onConflict: 'project_id' })
  }

  if (monthly_schedules !== undefined) {
    await client.from('recurring_monthly_schedules').delete().eq('project_id', id)
    if (monthly_schedules.length) {
      await client.from('recurring_monthly_schedules').insert(
        monthly_schedules.map((s: any) => ({ project_id: id, ...s }))
      )
    }
  }

  const projectName = (data as any)?.name ?? ''

  if (assignments !== undefined) {
    // 差分比較のため更新前 assignments を取得（二重通知防止）
    const { data: beforeRows } = await client
      .from('project_assignments')
      .select('assignee_type, assignee_id')
      .eq('project_id', id)
    const before = (beforeRows ?? []) as { assignee_type: 'employee' | 'partner'; assignee_id: string }[]

    const removed = diffRemoved(before, assignments)
    if (removed.length > 0) {
      void fireProjectUnassignedNotifications(client, id, projectName, auth.companyId, removed)
    }

    await client.from('project_assignments').delete().eq('project_id', id)
    if (assignments.length) {
      const { error: aErr } = await client.from('project_assignments').insert(
        assignments.map((a: any) => ({ project_id: id, assignee_type: a.assignee_type, assignee_id: a.assignee_id }))
      )
      if (aErr) {
        console.error('assignments insert error:', aErr.message)
      } else {
        const newlyAdded = diffAssignments(before, assignments)
        if (newlyAdded.length > 0) {
          void fireProjectAssignedNotifications(client, id, projectName, auth.companyId, newlyAdded)
        }
      }
    }
  }

  const afterStatus = (data as any)?.status
  if (
    (projectFields as any)?.status !== undefined &&
    beforeStatus !== afterStatus &&
    (afterStatus === 'cancelled' || afterStatus === 'paused' || afterStatus === 'completed')
  ) {
    void fireProjectStatusNotifications(
      client, id, projectName, auth.companyId,
      afterStatus as ProjectStatusEventType
    )
  }

  if (beforeProject && data) {
    const detailChanges = detectDetailChanges(
      beforeProject as Record<string, unknown>,
      data as Record<string, unknown>
    )
    if (detailChanges.length > 0) {
      void fireProjectDetailsChangedNotifications(client, id, projectName, auth.companyId, detailChanges)
    }
  }

  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const client = auth.adminClient

  // project_assignments は polymorphic FK のため手動削除
  await client.from('project_assignments').delete().eq('project_id', id)

  // projects を物理削除（CASCADE で関連テーブルも自動削除）
  const { error } = await client
    .from('projects')
    .delete()
    .eq('id', id).eq('company_id', auth.companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
