import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import {
  diffAssignments,
  fireProjectAssignedNotifications,
  fireProjectStatusNotifications,
  type ProjectStatusEventType,
} from '@/lib/notifications/project-system'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data, error } = await auth.adminClient
    .from('projects')
    .select(`*, spot_project_details(*), clients(id, name), project_assignments(*)`)
    .eq('id', id).eq('company_id', auth.companyId).eq('project_type', 'spot').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // company_id / id / created_at はサーバー側で決定し Body を信頼しない
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { spot_details, assignments, company_id: _cid, id: _pid, created_at: _ca, updated_at: _ua, ...projectFields } = await req.json()
  const client = auth.adminClient

  // status変更通知のため更新前 status を取得
  const { data: beforeProject } = await client
    .from('projects').select('status').eq('id', id).eq('company_id', auth.companyId).single()
  const beforeStatus = beforeProject?.status ?? null

  const { data, error } = await client
    .from('projects')
    .update({ ...projectFields, updated_at: new Date().toISOString() })
    .eq('id', id).eq('company_id', auth.companyId)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (spot_details) {
    await client.from('spot_project_details')
      .upsert({ project_id: id, ...spot_details }, { onConflict: 'project_id' })
  }

  if (assignments !== undefined) {
    // 差分比較のため更新前 assignments を取得（二重通知防止）
    const { data: beforeRows } = await client
      .from('project_assignments')
      .select('assignee_type, assignee_id')
      .eq('project_id', id)
    const before = (beforeRows ?? []) as { assignee_type: 'employee' | 'partner'; assignee_id: string }[]

    await client.from('project_assignments').delete().eq('project_id', id)
    if (assignments.length) {
      const { error: aErr } = await client.from('project_assignments').insert(
        assignments.map((a: any) => ({ project_id: id, assignee_type: a.assignee_type, assignee_id: a.assignee_id }))
      )
      if (aErr) {
        console.error('assignments insert error:', aErr.message)
      } else {
        // 新規追加されたWorkerのみ通知（既存 assignee への再通知を防ぐ）
        const newlyAdded = diffAssignments(before, assignments)
        if (newlyAdded.length > 0) {
          void fireProjectAssignedNotifications(
            client, id, (data as any)?.name ?? '', auth.companyId, newlyAdded
          )
        }
      }
    }
  }

  // status変更通知: before ≠ after かつ cancelled/paused の時のみ全担当Workerへ通知
  // assignments ブロック完了後に呼ぶことで、最新の担当者リストへ通知できる
  const afterStatus = (data as any)?.status
  if (
    (projectFields as any)?.status !== undefined &&
    beforeStatus !== afterStatus &&
    (afterStatus === 'cancelled' || afterStatus === 'paused')
  ) {
    void fireProjectStatusNotifications(
      client, id, (data as any)?.name ?? '', auth.companyId,
      afterStatus as ProjectStatusEventType
    )
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
