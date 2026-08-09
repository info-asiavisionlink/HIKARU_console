import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// POST /api/inventory/usage - 作業者使用報告（在庫マスタは変更不可、出庫記録のみ）
// HIKARU-System / Partner から呼び出す
export async function POST(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { usages, job_id, project_id, shift_id } = body

  // usages: [{ item_id, quantity, notes }, ...]
  if (!Array.isArray(usages) || usages.length === 0) {
    return NextResponse.json({ error: '使用備品リストを入力してください' }, { status: 400 })
  }

  const results: { item_id: string; ok: boolean; error?: string; new_stock?: number }[] = []

  for (const usage of usages) {
    const { item_id, quantity, notes } = usage
    if (!item_id || !quantity || Number(quantity) <= 0) continue

    try {
      const { data, error } = await (auth.adminClient as any)
        .rpc('record_stock_transaction', {
          p_item_id:          item_id,
          p_company_id:       auth.companyId,
          p_transaction_type: 'out',
          p_quantity:         -Number(quantity),
          p_job_id:           job_id     || null,
          p_project_id:       project_id || null,
          p_shift_id:         shift_id   || null,
          p_performed_by:     auth.userId,
          p_reason:           '作業使用',
          p_notes:            notes || null,
        })

      const res = (data ?? {}) as { success: boolean; error?: string; new_stock?: number }
      results.push({
        item_id,
        ok:        res.success,
        error:     res.success ? undefined : res.error,
        new_stock: res.new_stock,
      })
    } catch (err) {
      results.push({ item_id, ok: false, error: String(err) })
    }
  }

  const allOk = results.every(r => r.ok)
  return NextResponse.json({ ok: allOk, results }, { status: allOk ? 200 : 207 })
}

// GET /api/inventory/usage - 作業者向け: 利用可能商品一覧（在庫数あり）
export async function GET(_req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type ItemRow = { id: string; name: string; category: string; unit: string; stock_quantity: number }

  const { data, error } = await auth.adminClient
    .from('inventory_items' as never)
    .select('id, name, category, unit, stock_quantity')
    .eq('company_id', auth.companyId)
    .eq('is_active', true)
    .gt('stock_quantity', 0)
    .order('category')
    .order('name') as { data: ItemRow[] | null; error: unknown }

  if (error) return NextResponse.json({ error: String(error) }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}
