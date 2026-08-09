import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// GET /api/projects/[id]/inventory - 案件の使用備品一覧（原価集計含む）
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 案件の存在・所属確認
  const { data: project } = await auth.adminClient
    .from('projects').select('id, company_id').eq('id', id).eq('company_id', auth.companyId).single()
  if (!project) return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 })

  type TxRow = { id: string; quantity: number; reason: string | null; performed_at: string; items: unknown; performer: unknown }

  // 案件に紐付いた出庫履歴を取得
  const { data: transactions, error } = await auth.adminClient
    .from('inventory_transactions')
    .select(`
      *,
      items:item_id (id, name, category, unit, unit_price),
      performer:performed_by (id, name)
    `)
    .eq('project_id', id)
    .eq('company_id', auth.companyId)
    .eq('transaction_type', 'out')
    .order('performed_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const txs = (transactions ?? []) as TxRow[]

  // 商品ごとに集計
  const byItem = new Map<string, {
    item_id: string; name: string; category: string; unit: string
    unit_price: number | null; total_quantity: number; total_cost: number | null
  }>()

  for (const tx of txs) {
    const item = (tx as any).items
    if (!item) continue
    const qty = Math.abs(Number(tx.quantity))
    const existing = byItem.get(item.id) ?? {
      item_id: item.id, name: item.name, category: item.category,
      unit: item.unit, unit_price: item.unit_price ?? null,
      total_quantity: 0, total_cost: null,
    }
    existing.total_quantity += qty
    if (item.unit_price != null) {
      existing.total_cost = (existing.total_cost ?? 0) + qty * Number(item.unit_price)
    }
    byItem.set(item.id, existing)
  }

  const summary = Array.from(byItem.values())
  const totalCost = summary.reduce((s, i) => s + (i.total_cost ?? 0), 0)

  return NextResponse.json({ transactions: txs, summary, total_cost: totalCost })
}
