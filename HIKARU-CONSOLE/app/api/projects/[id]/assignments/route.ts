import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import {
  diffAssignments,
  diffRemoved,
  fireProjectAssignedNotifications,
  fireProjectUnassignedNotifications,
} from '@/lib/notifications/project-system'

// GET /api/projects/[id]/assignments - 案件の担当者一覧
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // 案件が現在のcompany_idに属することを確認
  const { data: project } = await auth.adminClient
    .from('projects')
    .select('id')
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .single()
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const { data, error } = await auth.adminClient
    .from('project_assignments')
    .select('*')
    .eq('project_id', id)
    .order('assigned_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// PUT /api/projects/[id]/assignments - 担当者を一括更新
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // 案件が現在のcompany_idに属することを確認（cross-tenant防止）
  const { data: project } = await auth.adminClient
    .from('projects')
    .select('id, name')
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .single()
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const { assignments } = await req.json() as {
    assignments: { assignee_type: 'employee' | 'partner'; assignee_id: string }[]
  }

  // assignee_id が全て現在のcompany_idに属することを確認（cross-tenant割当防止）
  for (const a of assignments) {
    const table = a.assignee_type === 'employee' ? 'employees' : 'partners'
    const { data: entity } = await auth.adminClient
      .from(table)
      .select('id')
      .eq('id', a.assignee_id)
      .eq('company_id', auth.companyId)
      .single()
    if (!entity) {
      return NextResponse.json(
        { error: `assignee_id ${a.assignee_id} does not belong to this company` },
        { status: 400 }
      )
    }
  }

  // 差分比較のため更新前 assignments を取得（二重通知防止）
  const { data: beforeRows } = await auth.adminClient
    .from('project_assignments')
    .select('assignee_type, assignee_id')
    .eq('project_id', id)
  const before = (beforeRows ?? []) as { assignee_type: 'employee' | 'partner'; assignee_id: string }[]

  // 既存の割り当てを全削除して再登録
  await auth.adminClient.from('project_assignments').delete().eq('project_id', id)

  if (assignments.length > 0) {
    const rows = assignments.map((a) => ({
      project_id: id,
      assignee_type: a.assignee_type,
      assignee_id: a.assignee_id,
    }))

    const { error } = await auth.adminClient.from('project_assignments').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 新規追加 / 解除されたWorkerへそれぞれ通知
    const newlyAdded = diffAssignments(before, assignments)
    if (newlyAdded.length > 0) {
      void fireProjectAssignedNotifications(
        auth.adminClient, id, project.name ?? '', auth.companyId, newlyAdded
      )
    }
    const removed = diffRemoved(before, assignments)
    if (removed.length > 0) {
      void fireProjectUnassignedNotifications(
        auth.adminClient, id, project.name ?? '', auth.companyId, removed
      )
    }
  } else {
    // assignments が空になった場合（全員解除）
    const removed = diffRemoved(before, [])
    if (removed.length > 0) {
      void fireProjectUnassignedNotifications(
        auth.adminClient, id, project.name ?? '', auth.companyId, removed
      )
    }
  }

  return NextResponse.json({ success: true })
}
