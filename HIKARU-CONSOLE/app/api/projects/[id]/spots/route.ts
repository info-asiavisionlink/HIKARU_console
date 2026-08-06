import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// POST /api/projects/:id/spots  ← 作業箇所を一括登録
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { spots } = await req.json()  // [{ name: string, description?: string }]
  if (!Array.isArray(spots) || spots.length === 0) {
    return NextResponse.json({ error: 'spots is required' }, { status: 400 })
  }

  const records = spots
    .filter((s: any) => s.name?.trim())
    .map((s: any, i: number) => ({
      project_id:  id,
      name:        s.name.trim(),
      description: s.description?.trim() || null,
      order_num:   i,
      is_required: true,
    }))

  if (records.length === 0) {
    return NextResponse.json({ data: [] })
  }

  const { data, error } = await auth.adminClient
    .from('photo_spots')
    .insert(records)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

// GET /api/projects/:id/spots
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data, error } = await auth.adminClient
    .from('photo_spots')
    .select('id, name, description, order_num, is_required')
    .eq('project_id', id)
    .order('order_num', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

// DELETE /api/projects/:id/spots  ← 全削除（再登録用）
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { error } = await auth.adminClient
    .from('photo_spots')
    .delete()
    .eq('project_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
