import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { requireAdmin, getOwnedSession, writeAuditLog } from '@/lib/import/helpers'
import { evaluateCommitEligibility } from '@/lib/import/commit-eligibility'

// POST /api/import/sessions/[id]/commit
//
// PHASE 2 STEP A — Client Bulk Import Commit
//
// Flow:
//   1. Auth (admin) + session ownership (same company)
//   2. entity_type = 'client' 限定 (Store/Employee/Project は STEP D 以降)
//   3. Session status = review_required | ready_to_commit
//   4. Pre-check eligibility via review counts (early 400 応答)
//   5. RPC commit_client_import_session に委譲 (Postgres transaction、all-or-nothing)
//   6. RPC 内でも同 gate + row lock + snapshot 作成 + commit record insert + session=completed
//
// Idempotency:
//   - import_commit_records に UNIQUE(session_id) → concurrent double POST は片方だけ成功
//   - RPC 冒頭で明示 EXISTS check + session status で二重弾き
//
// Security:
//   - company_id / actor_id は auth context から (Browser 供給不可)
//   - service_role client 経由で RPC 呼び出し、RPC は SECURITY DEFINER
//
// Business tables: clients INSERT / UPDATE (allowlist columns only, partial merge on UPDATE)
// OpenAI calls: 0
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params

  const auth = await getAuthContext()
  if (!auth) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '認証が必要です' },
      { status: 401 },
    )
  }
  if (!(await requireAdmin(auth))) {
    return NextResponse.json(
      { code: 'FORBIDDEN', message: '管理者権限が必要です' },
      { status: 403 },
    )
  }

  const session = await getOwnedSession(auth, sessionId)
  if (!session) {
    return NextResponse.json(
      { code: 'IMPORT_SESSION_NOT_FOUND', message: 'インポートセッションが見つかりません' },
      { status: 404 },
    )
  }

  const sessionStatus = String(session['status'] ?? '')
  const entityType    = String(session['entity_type'] ?? '')

  // Fetch review counts for eligibility gate
  const [stagingRes, candidatesRes] = await Promise.all([
    auth.adminClient
      .from('import_staging_rows')
      .select('validation_status, review_status')
      .eq('session_id', sessionId)
      .eq('company_id', auth.companyId),
    auth.adminClient
      .from('import_duplicate_candidates')
      .select('review_status')
      .eq('session_id', sessionId)
      .eq('company_id', auth.companyId),
  ])

  if (stagingRes.error || candidatesRes.error) {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Review 状態の取得に失敗しました' },
      { status: 500 },
    )
  }

  const rows = (stagingRes.data ?? []) as Array<{
    validation_status: string
    review_status: string
  }>
  const cands = (candidatesRes.data ?? []) as Array<{ review_status: string }>

  const totalRows         = rows.length
  const pendingRows       = rows.filter(r => r.review_status === 'pending').length
  const invalidRows       = rows.filter(r => r.validation_status === 'invalid').length
  const pendingCandidates = cands.filter(c => c.review_status === 'pending').length

  const gate = evaluateCommitEligibility({
    sessionStatus,
    entityType,
    pendingRows,
    pendingCandidates,
    totalRows,
    invalidRows,
  })

  if (!gate.canCommit) {
    const messageMap: Record<string, string> = {
      ENTITY_NOT_SUPPORTED:      `この種類のデータはまだ一括登録に対応していません (entity_type: ${entityType})`,
      INVALID_SESSION_STATUS:    `このセッションは現在登録できません (状態: ${sessionStatus})`,
      PENDING_ROWS_REMAIN:       `未確認の行が ${pendingRows} 件あります。全ての行に対して選択を完了してください`,
      PENDING_CANDIDATES_REMAIN: `未確認の重複候補が ${pendingCandidates} 件あります`,
      EMPTY_SESSION:             '登録対象の行がありません',
    }
    return NextResponse.json(
      {
        code:    gate.reason,
        message: messageMap[gate.reason ?? ''] ?? '登録できない状態です',
      },
      { status: 409 },
    )
  }

  // Entity type → RPC name dispatch
  // eligibility gate と SUPPORTED_COMMIT_ENTITIES で 事前 gate 済のため、
  // ここに到達する entityType は必ず RPC を持つ。
  const RPC_BY_ENTITY: Record<string, string> = {
    client:   'commit_client_import_session',
    store:    'commit_store_import_session',
    employee: 'commit_employee_import_session',
  }
  const rpcName = RPC_BY_ENTITY[entityType]
  if (!rpcName) {
    return NextResponse.json(
      { code: 'ENTITY_NOT_SUPPORTED', message: '未対応の entity_type です' },
      { status: 409 },
    )
  }

  // RPC call — all-or-nothing Postgres transaction inside.
  // Supabase generated types に RPC は未登録なので明示 cast (Migration 051/053/054 と契約一致)。
  interface CommitRpcRow {
    inserted_count:   number
    updated_count:    number
    skipped_count:    number
    commit_record_id: string | null
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rpcData, error: rpcErr } = await (auth.adminClient.rpc as any)(
    rpcName,
    {
      p_session_id: sessionId,
      p_company_id: auth.companyId,
      p_actor_id:   auth.userId,
    },
  ) as { data: CommitRpcRow[] | CommitRpcRow | null; error: { code?: string; message?: string } | null }

  if (rpcErr) {
    // RPC EXCEPTION は message 内に理由コード (session_not_found / pending_rows_remain 等)
    // 生 message は Ops log 用、User には安全な要約のみ返す
    console.error('[import-commit] RPC failed:', rpcErr.code, rpcErr.message)

    writeAuditLog(auth, sessionId, 'session.failed', {
      phase:  'commit',
      reason: 'rpc_error',
      code:   rpcErr.code ?? null,
    })

    // Idempotency: UNIQUE(session_id) 違反 → 既に commit 済み
    if (rpcErr.message?.includes('commit_already_exists') ||
        rpcErr.code === '23505') {
      return NextResponse.json(
        { code: 'ALREADY_COMMITTED', message: 'このセッションは既に登録済みです' },
        { status: 409 },
      )
    }

    return NextResponse.json(
      { code: 'COMMIT_FAILED', message: '登録処理に失敗しました。管理者にお問い合わせください' },
      { status: 500 },
    )
  }

  // rpc returns TABLE — supabase-js unwraps as array
  const row = Array.isArray(rpcData) ? rpcData[0] : rpcData
  const insertedCount = Number(row?.inserted_count ?? 0)
  const updatedCount  = Number(row?.updated_count  ?? 0)
  const skippedCount  = Number(row?.skipped_count  ?? 0)
  const commitRecordId = row?.commit_record_id ?? null

  writeAuditLog(auth, sessionId, 'commit.applied', {
    inserted_count:    insertedCount,
    updated_count:     updatedCount,
    skipped_count:     skippedCount,
    commit_record_id:  commitRecordId,
  })

  return NextResponse.json({
    success: true,
    data: {
      session_id:      sessionId,
      session_status:  'completed',
      inserted_count:  insertedCount,
      updated_count:   updatedCount,
      skipped_count:   skippedCount,
    },
  })
}
