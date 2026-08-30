import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { requireAdmin, getOwnedSession } from '@/lib/import/helpers'

const DEFAULT_LIMIT = 50
const MAX_LIMIT     = 100

// GET /api/import/sessions/[id]/review
//
// Paginated list of staging rows with their duplicate candidates.
// Designed for the Human Review UI — never returns all rows at once.
//
// Query params:
//   limit       number   default 50, max 100
//   offset      number   default 0
//   filter      string   'all' | 'needs_review' | 'clean' | 'invalid' | 'warning'
//
// Each row includes:
//   id, row_index, raw_data, normalized_data, mapped_data,
//   validation_status, validation_errors, review_status,
//   duplicate_candidates [], recommended_action
//
// recommended_action (derived, not stored):
//   'CREATE'  — valid, no pending duplicates
//   'REVIEW'  — has pending duplicate candidates
//   null      — invalid or already reviewed
//
// Tenant security:
//   session_id + company_id verified on every call.
//   Duplicate candidates filtered by company_id.
//
// Business tables: READ ONLY
// OpenAI calls: 0
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

  const session = await getOwnedSession(auth, sessionId)
  if (!session) {
    return NextResponse.json(
      { code: 'IMPORT_SESSION_NOT_FOUND', message: 'インポートセッションが見つかりません' },
      { status: 404 },
    )
  }

  // Parse query params
  const url    = new URL(req.url)
  const limit  = Math.min(Math.max(1, parseInt(url.searchParams.get('limit')  ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT), MAX_LIMIT)
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') ?? '0', 10) || 0)
  const filter = url.searchParams.get('filter') ?? 'all'

  const validFilters = ['all', 'needs_review', 'clean', 'invalid', 'warning']
  if (!validFilters.includes(filter)) {
    return NextResponse.json(
      { code: 'INVALID_FILTER', message: `filterは ${validFilters.join(', ')} のいずれかです` },
      { status: 400 },
    )
  }

  // Build staging row query
  let query = auth.adminClient
    .from('import_staging_rows')
    .select('id, row_index, raw_data, normalized_data, mapped_data, validation_status, validation_errors, review_status', { count: 'exact' })
    .eq('session_id', sessionId)
    .eq('company_id', auth.companyId)
    .order('row_index', { ascending: true })

  if (filter === 'invalid') {
    query = query.eq('validation_status', 'invalid')
  } else if (filter === 'clean') {
    query = query.eq('validation_status', 'valid').eq('review_status', 'pending')
  } else if (filter === 'warning') {
    query = query.eq('validation_status', 'warning')
  }
  // 'needs_review' and 'all' filters are applied after fetching duplicate candidates

  const { data: stagingRows, error: stagingErr, count } = await query
    .range(offset, offset + limit - 1)

  if (stagingErr) {
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Staging行の取得に失敗しました' }, { status: 500 })
  }

  const rows = (stagingRows ?? []) as Array<Record<string, unknown>>

  if (rows.length === 0) {
    return NextResponse.json({
      success: true,
      data:    [],
      meta:    { total: count ?? 0, limit, offset, filter },
    })
  }

  // Fetch duplicate candidates for these staging rows
  const rowIds = rows.map(r => r['id'] as string)

  const { data: candidates, error: candErr } = await auth.adminClient
    .from('import_duplicate_candidates')
    .select('id, staging_row_id, existing_record_id, existing_record_table, similarity_score, match_reasons, review_status, resolved_action')
    .eq('session_id', sessionId)
    .eq('company_id', auth.companyId)
    .in('staging_row_id', rowIds)

  if (candErr) {
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: '重複候補の取得に失敗しました' }, { status: 500 })
  }

  // Group candidates by staging_row_id
  const candsByRow = new Map<string, Array<Record<string, unknown>>>()
  for (const c of (candidates ?? []) as Array<Record<string, unknown>>) {
    const rid = c['staging_row_id'] as string
    if (!candsByRow.has(rid)) candsByRow.set(rid, [])
    candsByRow.get(rid)!.push(c)
  }

  // Build response rows with recommended_action
  let responseRows = rows.map(row => {
    const rowId     = row['id'] as string
    const rowCands  = candsByRow.get(rowId) ?? []
    const pendingCands = rowCands.filter(c => c['review_status'] === 'pending')

    let recommended_action: 'CREATE' | 'REVIEW' | null = null
    if (row['validation_status'] === 'valid' && pendingCands.length === 0) {
      recommended_action = 'CREATE'
    } else if (pendingCands.length > 0) {
      recommended_action = 'REVIEW'
    }

    return {
      ...row,
      duplicate_candidates: rowCands,
      recommended_action,
    }
  })

  // Apply needs_review filter post-fetch
  if (filter === 'needs_review') {
    responseRows = responseRows.filter(r => r.recommended_action === 'REVIEW')
  }

  return NextResponse.json({
    success: true,
    data:    responseRows,
    meta:    {
      total:  count ?? 0,
      limit,
      offset,
      filter,
    },
  })
}
