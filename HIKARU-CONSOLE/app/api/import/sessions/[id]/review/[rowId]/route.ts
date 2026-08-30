import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { requireAdmin, getOwnedSession, writeAuditLog } from '@/lib/import/helpers'

// PATCH /api/import/sessions/[id]/review/[rowId]
//
// Human saves their review decision for one staging row.
// Stores the action — does NOT write to business tables (clients/stores).
//
// Allowed actions:
//   CREATE — no duplicates / human confirms it's new
//   UPDATE — human selects an existing record to update (requires candidate_id)
//   SKIP   — human rejects this row (not imported)
//
// Tenant security:
//   - session_id + company_id verified
//   - row_id must belong to same session + company
//   - For UPDATE: candidate_id must belong to same session + company
//     AND existing_record_id must belong to same company (verified by checking candidate ownership)
//
// State machine:
//   Session stays review_required — no automatic transition here.
//   ready_to_commit transition is a separate phase.
//
// Business tables: READ ONLY (zero INSERT/UPDATE/DELETE on clients/stores)
// OpenAI calls: 0
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; rowId: string }> },
) {
  const { id: sessionId, rowId } = await params

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

  if (session.status !== 'review_required') {
    return NextResponse.json(
      { code: 'INVALID_SESSION_STATE', message: `レビューはreview_required状態のセッションのみ可能です (現在: ${session.status})` },
      { status: 409 },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ code: 'INVALID_REQUEST', message: 'リクエストボディが不正です' }, { status: 400 })
  }

  const action      = body.action as string
  const candidateId = body.candidate_id as string | undefined  // required for UPDATE

  const validActions = ['CREATE', 'UPDATE', 'SKIP']
  if (!action || !validActions.includes(action)) {
    return NextResponse.json(
      { code: 'INVALID_ACTION', message: `actionは ${validActions.join(', ')} のいずれかです` },
      { status: 400 },
    )
  }

  if (action === 'UPDATE' && !candidateId) {
    return NextResponse.json(
      { code: 'MISSING_CANDIDATE', message: 'UPDATEにはcandidate_idが必要です' },
      { status: 400 },
    )
  }

  // Verify row ownership: row must belong to this session + company
  const { data: row, error: rowErr } = await auth.adminClient
    .from('import_staging_rows')
    .select('id, review_status, validation_status')
    .eq('id', rowId)
    .eq('session_id', sessionId)
    .eq('company_id', auth.companyId)
    .single()

  if (rowErr || !row) {
    return NextResponse.json(
      { code: 'ROW_NOT_FOUND', message: 'Staging行が見つかりません' },
      { status: 404 },
    )
  }

  const r = row as Record<string, unknown>

  // For UPDATE: verify candidate ownership and existing_record belongs to same company
  let resolvedCandidateId: string | null = null

  if (action === 'UPDATE' && candidateId) {
    const { data: candidate, error: candErr } = await auth.adminClient
      .from('import_duplicate_candidates')
      .select('id, staging_row_id, existing_record_id, existing_record_table, review_status')
      .eq('id', candidateId)
      .eq('session_id', sessionId)
      .eq('company_id', auth.companyId)
      .single()

    if (candErr || !candidate) {
      return NextResponse.json(
        { code: 'CANDIDATE_NOT_FOUND', message: '重複候補が見つかりません' },
        { status: 404 },
      )
    }

    const c = candidate as Record<string, unknown>

    // Verify candidate belongs to this row
    if (c['staging_row_id'] !== rowId) {
      return NextResponse.json(
        { code: 'CANDIDATE_ROW_MISMATCH', message: '指定された重複候補はこのStagingRowのものではありません' },
        { status: 400 },
      )
    }

    resolvedCandidateId = candidateId

    // Update the candidate: mark as resolved (UPDATE action)
    await auth.adminClient
      .from('import_duplicate_candidates')
      .update({
        review_status:   'approved',
        resolved_action: 'update',
        resolved_at:     new Date().toISOString(),
        resolved_by:     auth.userId,
      } as never)
      .eq('id', candidateId)
      .eq('company_id', auth.companyId)
  }

  // Update staging row review_status
  const newReviewStatus = action === 'SKIP' ? 'skipped' : 'approved'

  const { error: updateErr } = await auth.adminClient
    .from('import_staging_rows')
    .update({
      review_status: newReviewStatus,
      updated_at:    new Date().toISOString(),
    } as never)
    .eq('id', rowId)
    .eq('session_id', sessionId)
    .eq('company_id', auth.companyId)

  if (updateErr) {
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Staging行の更新に失敗しました' }, { status: 500 })
  }

  writeAuditLog(auth, sessionId, 'review.action_selected', {
    row_id:        rowId,
    action,
    candidate_id:  resolvedCandidateId,
    // No PII logged — only structural metadata
  })

  return NextResponse.json({
    success: true,
    data: {
      row_id:       rowId,
      action,
      review_status: newReviewStatus,
      candidate_id:  resolvedCandidateId,
    },
  })
}
