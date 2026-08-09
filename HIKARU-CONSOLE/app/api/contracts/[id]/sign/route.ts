import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// POST /api/contracts/[id]/sign - 契約締結記録
// 将来的に CloudSign / DocuSign API と連携する拡張ポイント
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const { data: existing } = await auth.adminClient
    .from('contracts' as never)
    .select('id, status, company_id')
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .single() as { data: any }

  if (!existing) return NextResponse.json({ error: '契約が見つかりません' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const {
    sign_provider = 'manual',
    sign_request_id,
    // 将来の拡張: CloudSign / DocuSign の request ID を保存
  } = body

  const now = new Date().toISOString()

  const { data, error } = await auth.adminClient
    .from('contracts' as never)
    .update({
      status:           'signed',
      signed_at:        now,
      signed_by:        auth.userId,
      sign_provider:    sign_provider,
      sign_request_id:  sign_request_id || null,
      updated_at:       now,
    } as never)
    .eq('id', id)
    .select()
    .single() as { data: any; error: unknown }

  if (error) return NextResponse.json({ error: String(error) }, { status: 500 })

  await auth.adminClient.from('contract_events' as never).insert({
    contract_id:  id,
    company_id:   auth.companyId,
    actor_id:     auth.userId,
    event_type:   'signed',
    old_value:    { status: existing.status },
    new_value:    { status: 'signed', sign_provider, signed_at: now },
    description:  `契約を締結しました（${sign_provider === 'manual' ? '手動' : sign_provider}）`,
  } as never)

  return NextResponse.json({ contract: data })
}
