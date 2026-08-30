import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { requireAdmin, getOwnedSession } from '@/lib/import/helpers'

// GET /api/import/sessions/[id]/review/summary
//
// Returns aggregate counts for the review dashboard.
// Human reviewers focus only on rows that need action — this endpoint
// provides the counts to route them efficiently.
//
// Response shape:
//   total           — all staging rows
//   clean           — valid, no duplicates → recommended CREATE (human can approve in bulk)
//   needs_review    — has at least one pending duplicate candidate
//   invalid         — validation_status = invalid (missing required fields)
//   warning         — validation_status = warning (formula risk, empty row, etc.) with no duplicates
//   duplicate_candidates — total pending candidate records
//
// Business tables: READ ONLY
// OpenAI calls: 0
export async function GET(
  _req: NextRequest,
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

  // Fetch all staging rows (id + statuses only — lightweight)
  const { data: stagingRows, error: stagingErr } = await auth.adminClient
    .from('import_staging_rows')
    .select('id, validation_status, review_status')
    .eq('session_id', sessionId)
    .eq('company_id', auth.companyId)

  if (stagingErr) {
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Staging行の取得に失敗しました' }, { status: 500 })
  }

  const rows = (stagingRows ?? []) as Array<{
    id: string
    validation_status: string
    review_status: string
  }>

  // Fetch staging row IDs that have at least one pending duplicate candidate
  const { data: dupRows, error: dupErr } = await auth.adminClient
    .from('import_duplicate_candidates')
    .select('staging_row_id, review_status')
    .eq('session_id', sessionId)
    .eq('company_id', auth.companyId)

  if (dupErr) {
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: '重複候補の取得に失敗しました' }, { status: 500 })
  }

  const dups = (dupRows ?? []) as Array<{ staging_row_id: string; review_status: string }>

  // Staging row IDs with at least one pending candidate
  const rowsWithPendingDup = new Set(
    dups.filter(d => d.review_status === 'pending').map(d => d.staging_row_id),
  )

  const total              = rows.length
  let   invalid            = 0
  let   needs_review       = 0
  let   clean              = 0
  let   warning_no_dup     = 0

  for (const row of rows) {
    if (row.validation_status === 'invalid') {
      invalid++
    } else if (rowsWithPendingDup.has(row.id)) {
      needs_review++
    } else if (row.validation_status === 'valid' && row.review_status === 'pending') {
      clean++
    } else if (row.validation_status === 'warning' && row.review_status === 'pending') {
      warning_no_dup++
    }
    // already reviewed rows (approved/rejected/skipped) not counted in above buckets
  }

  const reviewed = rows.filter(r => r.review_status !== 'pending').length

  return NextResponse.json({
    success: true,
    data: {
      session_id:            sessionId,
      total,
      clean,
      needs_review,
      invalid,
      warning_no_duplicate:  warning_no_dup,
      reviewed,
      duplicate_candidates:  dups.length,
      pending_candidates:    dups.filter(d => d.review_status === 'pending').length,
    },
  })
}
