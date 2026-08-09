import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// POST /api/contracts/[id]/publish - 顧客ポータル公開切り替え
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const { data: existing } = await auth.adminClient
    .from('contracts' as never)
    .select('id, published_to_portal, title, company_id')
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .single() as { data: any }

  if (!existing) return NextResponse.json({ error: '契約が見つかりません' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const newPublished = body.published !== undefined ? Boolean(body.published) : !existing.published_to_portal

  const { data, error } = await auth.adminClient
    .from('contracts' as never)
    .update({
      published_to_portal: newPublished,
      published_at:        newPublished ? new Date().toISOString() : null,
      published_by:        newPublished ? auth.userId : null,
      updated_at:          new Date().toISOString(),
    } as never)
    .eq('id', id)
    .select()
    .single() as { data: any; error: unknown }

  if (error) return NextResponse.json({ error: String(error) }, { status: 500 })

  await auth.adminClient.from('contract_events' as never).insert({
    contract_id:  id,
    company_id:   auth.companyId,
    actor_id:     auth.userId,
    event_type:   'published',
    new_value:    { published_to_portal: newPublished },
    description:  newPublished ? '顧客ポータルへ公開しました' : '顧客ポータルの公開を取り消しました',
  } as never)

  return NextResponse.json({ contract: data })
}
