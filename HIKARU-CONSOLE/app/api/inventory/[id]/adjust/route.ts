import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// POST /api/inventory/[id]/adjust - 在庫調整（棚卸し等）
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { adjustment_quantity, reason, notes } = body

  // 調整量（±）は0以外が必須、reason必須
  if (adjustment_quantity === undefined || adjustment_quantity === null || adjustment_quantity === 0) {
    return NextResponse.json({ error: '調整量を入力してください（例: -2 または +3）' }, { status: 400 })
  }
  if (!reason?.trim()) {
    return NextResponse.json({ error: '調整理由は必須です' }, { status: 400 })
  }

  // 調整後の在庫を確認（マイナスになる場合も調整は許可）
  const { data: result, error } = await (auth.adminClient as any)
    .rpc('record_stock_transaction', {
      p_item_id:          id,
      p_company_id:       auth.companyId,
      p_transaction_type: 'adjustment',
      p_quantity:         Number(adjustment_quantity),
      p_performed_by:     auth.userId,
      p_reason:           reason.trim(),
      p_notes:            notes || null,
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rpcResult = result as { success: boolean; error?: string; new_stock?: number; prev_stock?: number }
  if (!rpcResult.success) {
    return NextResponse.json({ error: rpcResult.error }, { status: 400 })
  }

  return NextResponse.json({
    ok:        true,
    new_stock: rpcResult.new_stock,
    prev_stock: rpcResult.prev_stock,
  })
}
