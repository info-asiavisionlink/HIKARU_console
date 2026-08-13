import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// GET /api/reports/[id]
// 管理者向け報告書詳細取得。
// company_id で他社報告書へのIDORを防止。
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { data, error } = await auth.adminClient
      .from('reports')
      .select('*')
      .eq('id', id)
      .eq('company_id', auth.companyId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (e) {
    console.error('[api/reports/[id]]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
