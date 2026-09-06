import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { requireAdmin, getOwnedSession } from '@/lib/import/helpers'

// GET /api/import/sessions/[id]/fk-candidates?type=client|store|employee|project|partner&q=...&limit=...
//
// Review UI の Reference dropdown で使う candidate 一覧を返す。
// company_id scope 必須 (RLS の防御に加え、明示的な .eq('company_id') check)。
//
// 検索方式:
//   - q が指定されていれば name / code prefix ilike (単純部分一致)
//   - q 無しなら name 昇順で最初の limit 件を返す
//   - deterministic ordering: name → id (安定 sort)
//
// レスポンス:
//   { candidates: [{ id, name, code, sub? }] }
//
// employee / partner は追加 metadata (employee_number, partner_code, auth 済み or not) を含む。
// AI/OpenAI: 0. External API: 0. Business table writes: 0. Read-only.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params

  const auth = await getAuthContext()
  if (!auth) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: '認証が必要です' }, { status: 401 })
  }
  if (!(await requireAdmin(auth))) {
    return NextResponse.json({ code: 'FORBIDDEN', message: '管理者権限が必要です' }, { status: 403 })
  }

  // Session ownership check (even though we don't touch session data,
  // this endpoint is intended to be called only in review context)
  const session = await getOwnedSession(auth, sessionId)
  if (!session) {
    return NextResponse.json({ code: 'IMPORT_SESSION_NOT_FOUND', message: 'インポートセッションが見つかりません' }, { status: 404 })
  }

  const url    = new URL(req.url)
  const type   = url.searchParams.get('type') ?? ''
  const q      = (url.searchParams.get('q') ?? '').trim()
  const limit  = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10) || 50), 200)

  const validTypes = ['client', 'store', 'employee', 'project', 'partner']
  if (!validTypes.includes(type)) {
    return NextResponse.json({ code: 'INVALID_TYPE', message: `type は ${validTypes.join(' / ')} のいずれかです` }, { status: 400 })
  }

  const { table, selectCols, extractCandidate } = spec(type)

  let query = auth.adminClient
    .from(table as never)
    .select(selectCols)
    .eq('company_id', auth.companyId)
    .order('name', { ascending: true })
    .limit(limit)

  if (q.length > 0) {
    // Safe ilike (escape %/_/\)
    const esc = q.replace(/([\\%_])/g, '\\$1')
    query = query.or(`name.ilike.%${esc}%,code.ilike.%${esc}%`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: '候補一覧の取得に失敗しました' }, { status: 500 })
  }

  const candidates = ((data ?? []) as unknown as Array<Record<string, unknown>>).map(extractCandidate)

  return NextResponse.json({
    success: true,
    data: {
      type,
      q,
      candidates,
    },
  })
}

// ---- Per-reference-type query spec ----

interface RefSpec {
  table:            string
  selectCols:       string
  extractCandidate: (row: Record<string, unknown>) => { id: string; name: string; code: string | null; sub?: string | null }
}

function spec(type: string): RefSpec {
  switch (type) {
    case 'client':
      return {
        table:      'clients',
        selectCols: 'id, name, code',
        extractCandidate: r => ({
          id:   r.id as string,
          name: (r.name as string) ?? '',
          code: (r.code as string | null) ?? null,
        }),
      }
    case 'store':
      return {
        table:      'stores',
        selectCols: 'id, name, code',
        extractCandidate: r => ({
          id:   r.id as string,
          name: (r.name as string) ?? '',
          code: (r.code as string | null) ?? null,
        }),
      }
    case 'employee':
      // Include employee_number + auth_user_id existence flag
      // (Historical Import: expense/attendance rely on employees.auth_user_id being non-null)
      return {
        table:      'employees',
        selectCols: 'id, name, employee_number, auth_user_id',
        extractCandidate: r => ({
          id:   r.id as string,
          name: (r.name as string) ?? '',
          code: (r.employee_number as string | null) ?? null,
          sub:  r.auth_user_id ? 'auth 済み' : '未招待',
        }),
      }
    case 'project':
      return {
        table:      'projects',
        selectCols: 'id, name, code',
        extractCandidate: r => ({
          id:   r.id as string,
          name: (r.name as string) ?? '',
          code: (r.code as string | null) ?? null,
        }),
      }
    case 'partner':
      // partners.partner_code (not `code`) — expose as `code` for UI uniformity
      return {
        table:      'partners',
        selectCols: 'id, name, partner_code',
        extractCandidate: r => ({
          id:   r.id as string,
          name: (r.name as string) ?? '',
          code: (r.partner_code as string | null) ?? null,
        }),
      }
    default:
      // 到達不能 (上流で validTypes check 済み)。防御的に client を返す。
      return {
        table:      'clients',
        selectCols: 'id, name, code',
        extractCandidate: r => ({
          id:   r.id as string,
          name: (r.name as string) ?? '',
          code: (r.code as string | null) ?? null,
        }),
      }
  }
}
