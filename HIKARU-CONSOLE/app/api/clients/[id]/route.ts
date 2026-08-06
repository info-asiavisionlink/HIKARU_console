import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// DELETE /api/clients/:id
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { error } = await auth.adminClient
    .from('clients')
    .delete()
    .eq('id', id)
    .eq('company_id', auth.companyId)

  if (error) {
    // 外部キー制約エラー
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'この顧客に紐づく店舗・案件データが残っているため削除できません。先にデータを削除してください。' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// PATCH /api/clients/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data, error } = await auth.adminClient
    .from('clients')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
