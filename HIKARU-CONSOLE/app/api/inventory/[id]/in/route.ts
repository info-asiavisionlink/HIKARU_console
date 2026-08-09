import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { calculateStockStatus, shouldNotifyLowStock } from '@/lib/inventory/service'
import { sendNotification } from '@/lib/line/notification.service'

// POST /api/inventory/[id]/in - 入庫
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { quantity, supplier_name, notes, performed_at } = body

  if (!quantity || Number(quantity) <= 0) {
    return NextResponse.json({ error: '数量は正の値を入力してください' }, { status: 400 })
  }

  // アトミックRPCで入庫処理
  const { data: result, error } = await (auth.adminClient as any)
    .rpc('record_stock_transaction', {
      p_item_id:          id,
      p_company_id:       auth.companyId,
      p_transaction_type: 'in',
      p_quantity:         Number(quantity),
      p_performed_by:     auth.userId,
      p_supplier_name:    supplier_name || null,
      p_notes:            notes || null,
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rpcResult = result as { success: boolean; error?: string; new_stock?: number }
  if (!rpcResult.success) {
    return NextResponse.json({ error: rpcResult.error }, { status: 400 })
  }

  // 入庫後に在庫不足チェック（在庫が回復したかもしれないので通知不要）
  return NextResponse.json({ ok: true, new_stock: rpcResult.new_stock })
}
