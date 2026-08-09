import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AC = any

// GET: worker_proposals 一覧 (コンソール管理者用)
export async function GET(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { companyId, adminClient: admin } = auth as { companyId: string; adminClient: AC }

  const status   = req.nextUrl.searchParams.get('status') ?? ''
  const countOnly = req.nextUrl.searchParams.get('count') === 'true'

  if (countOnly) {
    const { count } = await admin
      .from('worker_proposals')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'pending')
    return NextResponse.json({ count: count ?? 0 })
  }

  let query = admin
    .from('worker_proposals')
    .select('*, profiles(id, name, employee_number), project_documents(id, doc_type, name, url, spot_name)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

// PATCH: 承認・却下
export async function PATCH(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { companyId, adminClient: admin } = auth as { companyId: string; adminClient: AC }

  const { id, status, admin_note } = await req.json()
  if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 })

  // 提案を更新
  const { data: proposal, error } = await admin
    .from('worker_proposals')
    .update({ status, admin_note: admin_note ?? null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', companyId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 承認の場合は案件を自動作成
  if (status === 'approved' && proposal) {
    const { data: project } = await admin
      .from('projects')
      .insert({
        company_id:     companyId,
        name:           proposal.project_name,
        project_type:   proposal.project_type ?? 'spot',
        location_name:  proposal.location_name ?? proposal.project_name,
        location_address: proposal.location_address ?? null,
        phone:          proposal.client_phone ?? null,
        notes:          proposal.work_description ?? null,
        status:         'active',
      })
      .select('id')
      .single()

    if (project) {
      // 提案に承認済みプロジェクトIDを紐付け
      await admin.from('worker_proposals').update({ approved_project_id: project.id }).eq('id', id)
      // 添付ドキュメントをprojectに紐付け
      await admin.from('project_documents')
        .update({ project_id: project.id })
        .eq('proposal_id', id)
      // 案件の獲得者（営業担当者）をセット
      await admin.from('projects')
        .update({ acquired_by: proposal.worker_id })
        .eq('id', project.id)
    }
  }

  return NextResponse.json({ data: proposal })
}
