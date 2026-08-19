import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

// ============================================================
// Global Manual判定
// HIKARU_GLOBAL_ADMIN_COMPANY_ID 環境変数で制御。
// 未設定の場合は全リクエストを403。
// 通常Company adminは403。
// ============================================================
function isGlobalAdmin(companyId: string): boolean {
  const adminCompanyId = process.env.HIKARU_GLOBAL_ADMIN_COMPANY_ID
  if (!adminCompanyId) return false
  return companyId === adminCompanyId
}

function globalForbidden() {
  return NextResponse.json(
    { error: 'HIKARU標準マニュアルの管理権限がありません' },
    { status: 403 }
  )
}

// ============================================================
// GET /api/manuals/global — Global Manual一覧
// company_id IS NULL AND project_id IS NULL のみ返す
// ============================================================
export async function GET(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!isGlobalAdmin(auth.companyId)) return globalForbidden()

  const admin = auth.adminClient as AnyClient
  const search   = req.nextUrl.searchParams.get('search')   ?? ''
  const type     = req.nextUrl.searchParams.get('type')     ?? ''
  const category = req.nextUrl.searchParams.get('category') ?? ''

  let query = admin
    .from('manuals')
    .select('id, title, type, content, category, is_template, project_id, order_num, created_at')
    .is('company_id', null)
    .is('project_id', null)
    .order('category', { ascending: true })
    .order('order_num', { ascending: true })

  if (search)   query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`)
  if (type)     query = query.eq('type', type)
  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// ============================================================
// POST /api/manuals/global — Global Manual作成
// company_id = NULL, project_id = NULL をサーバー側で強制
// ============================================================
export async function POST(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!isGlobalAdmin(auth.companyId)) return globalForbidden()

  const admin = auth.adminClient as AnyClient
  const body  = await req.json()
  const { title, type, content, category } = body
  if (!title || !type) {
    return NextResponse.json({ error: 'title and type are required' }, { status: 400 })
  }

  // Global既存のorder_num最大値を取得
  const { data: last } = await admin
    .from('manuals')
    .select('order_num')
    .is('company_id', null)
    .is('project_id', null)
    .order('order_num', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await admin
    .from('manuals')
    .insert({
      company_id:  null,   // サーバー側でGlobal強制
      project_id:  null,   // サーバー側でGlobal強制
      is_template: true,
      title,
      type,
      content:  content  ?? null,
      category: category ?? null,
      order_num: ((last as { order_num: number } | null)?.order_num ?? -1) + 1,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
