import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// GET /api/contracts/[id]/events - 監査ログ一覧
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  // 契約が自社のものか確認
  const { data: contract } = await auth.adminClient
    .from('contracts' as never)
    .select('id, company_id')
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .single() as { data: any }

  if (!contract) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

  const limit  = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 50), 200)
  const offset = Number(req.nextUrl.searchParams.get('offset') ?? 0)

  const { data: events, error, count } = await auth.adminClient
    .from('contract_events' as never)
    .select(`
      id, event_type, old_value, new_value, description, created_at,
      actor:actor_id (id, name, role)
    `, { count: 'exact' })
    .eq('contract_id', id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1) as { data: any[] | null; error: unknown; count: number | null }

  if (error) return NextResponse.json({ error: String(error) }, { status: 500 })

  return NextResponse.json({ events: events ?? [], total: count ?? 0 })
}
