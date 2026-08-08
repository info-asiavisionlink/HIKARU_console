import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { companyId, adminClient: admin } = auth

  const { data: company } = await admin
    .from('companies')
    .select('id, name, created_at')
    .eq('id', companyId)
    .single()

  return NextResponse.json({ data: company })
}

export async function PATCH(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { companyId, adminClient: admin } = auth

  const body = await req.json()
  const { name } = body
  if (!name?.trim()) return NextResponse.json({ error: '会社名を入力してください' }, { status: 400 })

  const { data, error } = await admin
    .from('companies')
    .update({ name: name.trim() })
    .eq('id', companyId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
