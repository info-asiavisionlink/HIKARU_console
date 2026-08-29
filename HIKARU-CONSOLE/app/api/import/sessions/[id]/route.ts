import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { requireAdmin, getOwnedSession } from '@/lib/import/helpers'

// GET /api/import/sessions/[id]
// id + company_id の両方で検索。
// 存在しないSessionと他社SessionはともにNOT FOUNDを返す（情報漏洩防止）。
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const auth = await getAuthContext()
  if (!auth) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: '認証が必要です' }, { status: 401 })
  }
  if (!(await requireAdmin(auth))) {
    return NextResponse.json({ code: 'FORBIDDEN', message: '管理者権限が必要です' }, { status: 403 })
  }

  const session = await getOwnedSession(auth, id)
  if (!session) {
    return NextResponse.json(
      { code: 'IMPORT_SESSION_NOT_FOUND', message: 'インポートセッションが見つかりません' },
      { status: 404 },
    )
  }

  return NextResponse.json({ success: true, data: session })
}
