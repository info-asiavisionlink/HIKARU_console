import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

export async function GET(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { companyId, adminClient } = auth
  const admin = adminClient as AnyClient

  const search    = req.nextUrl.searchParams.get('search') ?? ''
  const type      = req.nextUrl.searchParams.get('type') ?? ''
  const category  = req.nextUrl.searchParams.get('category') ?? ''
  const template  = req.nextUrl.searchParams.get('template') // 'true' | 'false' | null

  let query = admin
    .from('manuals')
    .select('id, title, type, content, category, is_template, project_id, order_num, created_at, projects(id, name)')
    .eq('company_id', companyId)
    .order('category', { ascending: true })
    .order('order_num', { ascending: true })

  if (search)   query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`)
  if (type)     query = query.eq('type', type)
  if (category) query = query.eq('category', category)
  if (template === 'true')  query = query.eq('is_template', true)
  if (template === 'false') query = query.eq('is_template', false)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { companyId, adminClient } = auth
  const admin = adminClient as AnyClient

  const body = await req.json()
  const { title, type, content, category, is_template, project_id } = body
  if (!title || !type) return NextResponse.json({ error: 'title and type are required' }, { status: 400 })

  const { data: last } = await admin
    .from('manuals')
    .select('order_num')
    .eq('company_id', companyId)
    .order('order_num', { ascending: false })
    .limit(1)
    .single()

  const { data, error } = await admin
    .from('manuals')
    .insert({
      company_id: companyId,
      project_id: project_id ?? null,
      title,
      type,
      content: content ?? null,
      category: category ?? null,
      is_template: is_template ?? false,
      order_num: ((last as { order_num: number } | null)?.order_num ?? -1) + 1,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
