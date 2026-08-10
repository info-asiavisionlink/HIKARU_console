import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { calculateDeadlineInfo } from '@/lib/contracts/service'

// GET /api/contracts/[id] - 契約詳細
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const { data: contract, error } = await auth.adminClient
    .from('contracts' as never)
    .select(`
      *,
      clients:client_id   (id, name, email, phone, address, contact_name),
      partners:partner_id (id, company_name, email, phone, contact_name),
      projects:project_id (id, name, project_type, status)
    `)
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .single() as { data: any; error: unknown }

  if (error || !contract) return NextResponse.json({ error: '契約が見つかりません' }, { status: 404 })

  // 現在有効なファイル
  const { data: currentFile } = await auth.adminClient
    .from('contract_files' as never)
    .select('*')
    .eq('contract_id', id)
    .eq('is_current', true)
    .single() as { data: any }

  // 全ファイルバージョン
  const { data: allFiles } = await auth.adminClient
    .from('contract_files' as never)
    .select('*')
    .eq('contract_id', id)
    .order('version', { ascending: false }) as { data: any[] | null }

  return NextResponse.json({
    contract: {
      ...contract,
      deadline: calculateDeadlineInfo(contract.end_date),
    },
    current_file: currentFile ?? null,
    files: allFiles ?? [],
  })
}

// PUT /api/contracts/[id] - 契約更新
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  // 既存データ確認
  const { data: existing } = await auth.adminClient
    .from('contracts' as never)
    .select('*')
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .single() as { data: any }

  if (!existing) return NextResponse.json({ error: '契約が見つかりません' }, { status: 404 })

  const body = await req.json()
  const {
    title, contract_number, counterparty_type, client_id, partner_id, project_id,
    contract_type, start_date, end_date, renewal_date, auto_renewal,
    status, notes, internal_memo,
  } = body

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (title             !== undefined) updatePayload.title             = title?.trim()
  if (contract_number   !== undefined) updatePayload.contract_number   = contract_number?.trim() || null
  if (counterparty_type !== undefined) updatePayload.counterparty_type = counterparty_type
  if (client_id         !== undefined) updatePayload.client_id         = client_id  || null
  if (partner_id        !== undefined) updatePayload.partner_id        = partner_id || null
  if (project_id        !== undefined) updatePayload.project_id        = project_id || null
  if (contract_type     !== undefined) updatePayload.contract_type     = contract_type
  if (start_date        !== undefined) updatePayload.start_date        = start_date  || null
  if (end_date          !== undefined) updatePayload.end_date          = end_date    || null
  if (renewal_date      !== undefined) updatePayload.renewal_date      = renewal_date|| null
  if (auto_renewal      !== undefined) updatePayload.auto_renewal      = Boolean(auto_renewal)
  if (notes             !== undefined) updatePayload.notes             = notes        || null
  if (internal_memo     !== undefined) updatePayload.internal_memo     = internal_memo|| null
  if (status            !== undefined) updatePayload.status            = status

  const { data, error } = await auth.adminClient
    .from('contracts' as never)
    .update(updatePayload as never)
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .select()
    .single() as { data: any; error: unknown }

  if (error) return NextResponse.json({ error: String(error) }, { status: 500 })

  // 監査ログ（変更された項目を記録）
  const changedFields: Record<string, unknown> = {}
  const oldValues: Record<string, unknown>     = {}
  for (const key of Object.keys(updatePayload)) {
    if (key === 'updated_at') continue
    if ((existing as any)[key] !== (updatePayload as any)[key]) {
      oldValues[key]    = (existing as any)[key]
      changedFields[key]= (updatePayload as any)[key]
    }
  }

  if (Object.keys(changedFields).length > 0) {
    let eventType = 'updated'
    if (changedFields.status) eventType = 'status_changed'
    if (changedFields.end_date || changedFields.start_date) eventType = 'period_changed'

    await auth.adminClient.from('contract_events' as never).insert({
      contract_id:  id,
      company_id:   auth.companyId,
      actor_id:     auth.userId,
      event_type:   eventType,
      old_value:    oldValues,
      new_value:    changedFields,
      description:  status ? `ステータスを「${existing.status}」→「${status}」に変更` : '契約情報を更新しました',
    } as never)
  }

  return NextResponse.json({ contract: data })
}

// DELETE /api/contracts/[id] - 契約削除（論理削除: terminated に変更）
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const { data: existing } = await auth.adminClient
    .from('contracts' as never)
    .select('id, status, title, company_id')
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .single() as { data: any }

  if (!existing) return NextResponse.json({ error: '契約が見つかりません' }, { status: 404 })

  // 論理削除: terminated に変更（監査ログは残す）
  await auth.adminClient
    .from('contracts' as never)
    .update({ status: 'terminated', updated_at: new Date().toISOString() } as never)
    .eq('id', id)

  await auth.adminClient.from('contract_events' as never).insert({
    contract_id:  id,
    company_id:   auth.companyId,
    actor_id:     auth.userId,
    event_type:   'terminated',
    old_value:    { status: existing.status },
    new_value:    { status: 'terminated' },
    description:  '契約を解約（削除）しました',
  } as never)

  return NextResponse.json({ success: true })
}
