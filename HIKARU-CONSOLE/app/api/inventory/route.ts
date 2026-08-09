import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { calculateStockStatus, calculateInventoryValue } from '@/lib/inventory/service'

type ItemRow = {
  id: string; company_id: string; name: string; category: string; unit: string
  unit_price: number | null; stock_quantity: number; min_stock: number
  storage_location: string | null; supplier_name: string | null; supplier_contact: string | null
  supplier_email: string | null; barcode: string | null; notes: string | null
  is_active: boolean; created_at: string; updated_at: string
}

// GET /api/inventory - 在庫一覧（管理者）
export async function GET(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const p        = req.nextUrl.searchParams
  const category = p.get('category')
  const status   = p.get('status')   // 'low_stock' | 'out_of_stock' | 'normal'
  const search   = p.get('search')
  const activeOnly = p.get('active') !== 'false'

  let query = auth.adminClient
    .from('inventory_items' as never)
    .select('*')
    .eq('company_id', auth.companyId)
    .order('category', { ascending: true })
    .order('name',     { ascending: true })

  if (activeOnly) (query as any) = (query as any).eq('is_active', true)
  if (category)   (query as any) = (query as any).eq('category', category)
  if (search)     (query as any) = (query as any).ilike('name', `%${search}%`)

  const { data, error } = await query as { data: ItemRow[] | null; error: unknown }
  if (error) return NextResponse.json({ error: String(error) }, { status: 500 })

  // ステータスを計算して付加
  let items = (data ?? []).map(item => ({
    ...item,
    stock_status:    calculateStockStatus(item.stock_quantity, item.min_stock, item.is_active),
    inventory_value: calculateInventoryValue(item.stock_quantity, item.unit_price),
  }))

  // ステータスフィルター
  if (status) items = items.filter(i => i.stock_status === status)

  // サマリーKPI
  const kpi = {
    total:         items.length,
    low_stock:     items.filter(i => i.stock_status === 'low_stock').length,
    out_of_stock:  items.filter(i => i.stock_status === 'out_of_stock').length,
    total_value:   items.reduce((s, i) => s + (i.inventory_value ?? 0), 0),
  }

  return NextResponse.json({ items, kpi })
}

// POST /api/inventory - 商品登録
export async function POST(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    name, category = 'other', unit = '個',
    unit_price, min_stock = 0,
    storage_location, supplier_name, supplier_contact, supplier_email,
    barcode, notes,
  } = body

  if (!name?.trim()) return NextResponse.json({ error: '商品名は必須です' }, { status: 400 })

  const insertPayload = {
    company_id:       auth.companyId,
    name:             name.trim(),
    category,
    unit,
    unit_price:       unit_price ?? null,
    stock_quantity:   0,
    min_stock:        Number(min_stock),
    storage_location: storage_location || null,
    supplier_name:    supplier_name    || null,
    supplier_contact: supplier_contact || null,
    supplier_email:   supplier_email   || null,
    barcode:          barcode          || null,
    notes:            notes            || null,
  }

  const { data, error } = await auth.adminClient
    .from('inventory_items' as never)
    .insert(insertPayload as never)
    .select()
    .single() as { data: ItemRow | null; error: unknown }

  if (error) return NextResponse.json({ error: String(error) }, { status: 500 })
  return NextResponse.json({ item: data }, { status: 201 })
}
