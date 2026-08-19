import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// POST /api/inventory/[id]/out - 出庫
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { quantity, reason, project_id, notes } = body

  if (!quantity || Number(quantity) <= 0) {
    return NextResponse.json({ error: '数量は正の値を入力してください' }, { status: 400 })
  }

  // RPC は p_quantity を signed で受け取る（負 = 出庫/マイナス）
  const { data: result, error } = await (auth.adminClient as any)
    .rpc('record_stock_transaction', {
      p_item_id:          id,
      p_company_id:       auth.companyId,
      p_transaction_type: 'out',
      p_quantity:         -Number(quantity),
      p_performed_by:     auth.userId,
      p_reason:           reason?.trim() || null,
      p_project_id:       project_id || null,
      p_notes:            notes || null,
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rpcResult = result as { success: boolean; error?: string; new_stock?: number; prev_stock?: number; current_stock?: number; requested?: number }
  if (!rpcResult.success) {
    // 在庫不足の場合は RPC から current_stock と requested が返る
    return NextResponse.json(
      { error: rpcResult.error ?? '出庫に失敗しました', current_stock: rpcResult.current_stock, requested: rpcResult.requested },
      { status: 400 }
    )
  }

  return NextResponse.json({ ok: true, new_stock: rpcResult.new_stock, prev_stock: rpcResult.prev_stock })
}
