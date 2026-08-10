import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// GET /api/clients/:id
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data, error } = await auth.adminClient
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

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

  // company_id / id / created_at はサーバー側で決定し、Body から除外してテナント改ざんを防止
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { company_id: _cid, id: _clientId, created_at: _ca, updated_at: _ua, ...safeBody } = await req.json()

  const { data, error } = await auth.adminClient
    .from('clients')
    .update({ ...safeBody, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', auth.companyId)  // サーバー側 company_id で対象を限定
    .select()
    .single()

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500
    return NextResponse.json({ error: error.message }, { status })
  }
  return NextResponse.json({ data })
}
