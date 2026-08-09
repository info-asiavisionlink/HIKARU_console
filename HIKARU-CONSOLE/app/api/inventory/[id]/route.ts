import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { calculateStockStatus, calculateInventoryValue } from '@/lib/inventory/service'

type ItemRow = { id: string; company_id: string; name: string; stock_quantity: number; min_stock: number; is_active: boolean; unit_price: number | null; [key: string]: unknown }

// GET /api/inventory/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await auth.adminClient
    .from('inventory_items' as never)
    .select('*')
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .single() as { data: ItemRow | null; error: unknown }

  if (error || !data) return NextResponse.json({ error: '商品が見つかりません' }, { status: 404 })

  return NextResponse.json({
    item: {
      ...data,
      stock_status:    calculateStockStatus(data.stock_quantity, data.min_stock, data.is_active),
      inventory_value: calculateInventoryValue(data.stock_quantity, data.unit_price),
    },
  })
}

// PUT /api/inventory/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowed = ['name','category','unit','unit_price','min_stock','storage_location',
    'supplier_name','supplier_contact','supplier_email','barcode','notes','is_active']
  const update: Record<string, unknown> = {}
  for (const k of allowed) if (k in body) update[k] = body[k]

  const { data, error } = await auth.adminClient
    .from('inventory_items' as never)
    .update(update as never)
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .select()
    .single() as { data: ItemRow | null; error: unknown }

  if (error || !data) return NextResponse.json({ error: String(error) }, { status: 500 })
  return NextResponse.json({ item: data })
}

// DELETE /api/inventory/[id] - 論理削除（is_active = false）
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await auth.adminClient
    .from('inventory_items' as never)
    .update({ is_active: false } as never)
    .eq('id', id)
    .eq('company_id', auth.companyId)

  if (error) return NextResponse.json({ error: String(error) }, { status: 500 })
  return NextResponse.json({ ok: true })
}
