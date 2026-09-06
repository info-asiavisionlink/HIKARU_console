import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { requireAdmin, getOwnedSession, writeAuditLog } from '@/lib/import/helpers'

// POST /api/import/sessions/[id]/review/rows/batch
//
// Review 画面から複数 row の action を bulk で確定させる (Phase U4)。
// - CREATE / SKIP のみ対応 (UPDATE は candidate 選択が必要なため per-row のまま)
// - Server 側で各 row の eligibility を再検証:
//     CREATE:
//       - row.session_id === current session
//       - row.company_id === auth.companyId
//       - row.review_status === 'pending'
//       - row.validation_status === 'valid' (invalid / warning は reject)
//       - row の未解決 duplicate_candidates が無い
//         (pending duplicate 有り → 「勝手に CREATE」は絶対禁止)
//     SKIP:
//       - row.session_id === current session
//       - row.company_id === auth.companyId
//       - row.review_status === 'pending' (既 approved/skipped は idempotent skip)
//
// Response:
//   {
//     success: true,
//     data: {
//       requested: N,
//       applied:   M,   // 実際に status を書き換えた row 数
//       skipped:   K,   // 既に処理済等で no-op になった row 数
//       rejected:  [ { row_id, reason } ]   // eligibility 落ちた row
//     }
//   }
//
// Business tables: read-only (import_staging_rows のみ update)
// AI/OpenAI: 0. External API: 0.
export async function POST(
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
    return NextResponse.json({ code: 'IMPORT_SESSION_NOT_FOUND', message: 'インポートセッションが見つかりません' }, { status: 404 })
  }
  if (session.status !== 'review_required') {
    return NextResponse.json(
      { code: 'INVALID_SESSION_STATE', message: `一括処理は review_required 状態のみ可能です (現在: ${session.status})` },
      { status: 409 },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ code: 'INVALID_REQUEST', message: 'リクエストボディが不正です' }, { status: 400 })
  }

  const action = body.action as string
  const rowIds = body.row_ids

  const validActions = ['CREATE', 'SKIP']
  if (!validActions.includes(action)) {
    return NextResponse.json({ code: 'INVALID_ACTION', message: `action は ${validActions.join(' / ')} のみ許可されます` }, { status: 400 })
  }
  if (!Array.isArray(rowIds) || rowIds.length === 0) {
    return NextResponse.json({ code: 'INVALID_REQUEST', message: 'row_ids は非空配列で指定してください' }, { status: 400 })
  }

  // UUID 形式チェック + 上限
  const MAX_BATCH = 500
  if (rowIds.length > MAX_BATCH) {
    return NextResponse.json(
      { code: 'BATCH_TOO_LARGE', message: `一度に処理できる行数は ${MAX_BATCH} 件までです` },
      { status: 400 },
    )
  }
  const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
  const ids: string[] = []
  for (const r of rowIds) {
    if (typeof r !== 'string' || !UUID_RE.test(r)) {
      return NextResponse.json({ code: 'INVALID_ROW_ID', message: '不正な row_id が含まれています' }, { status: 400 })
    }
    ids.push(r)
  }

  // Fetch rows scoped to (session_id, company_id) — RLS + explicit filter で
  // cross-company / cross-session row を完全に除外する。
  const { data: rowsData, error: rowsErr } = await auth.adminClient
    .from('import_staging_rows')
    .select('id, review_status, validation_status')
    .eq('session_id', sessionId)
    .eq('company_id', auth.companyId)
    .in('id', ids)

  if (rowsErr) {
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Staging行の取得に失敗しました' }, { status: 500 })
  }

  const rows = (rowsData ?? []) as Array<Record<string, unknown>>
  const foundIds = new Set(rows.map(r => r.id as string))

  // 存在しない (cross-company / 別 session / 削除済) row_id を rejected として記録
  const rejected: Array<{ row_id: string; reason: string }> = []
  for (const rid of ids) {
    if (!foundIds.has(rid)) {
      rejected.push({ row_id: rid, reason: 'not_found_or_not_owned' })
    }
  }

  // duplicate candidate: CREATE の場合のみ pending 有無を確認
  const pendingDupSet = new Set<string>()
  if (action === 'CREATE' && rows.length > 0) {
    const { data: candData, error: candErr } = await auth.adminClient
      .from('import_duplicate_candidates')
      .select('staging_row_id, review_status')
      .eq('session_id', sessionId)
      .eq('company_id', auth.companyId)
      .in('staging_row_id', Array.from(foundIds))
      .eq('review_status', 'pending')
    if (candErr) {
      return NextResponse.json({ code: 'INTERNAL_ERROR', message: '重複候補の取得に失敗しました' }, { status: 500 })
    }
    for (const c of (candData ?? []) as Array<Record<string, unknown>>) {
      pendingDupSet.add(c.staging_row_id as string)
    }
  }

  // Eligibility 判定 → 実 update 対象を分類
  const toApply: string[]  = []
  let skippedCount = 0

  for (const row of rows) {
    const id            = row.id as string
    const reviewStatus  = row.review_status as string
    const validStatus   = row.validation_status as string

    if (action === 'CREATE') {
      if (reviewStatus !== 'pending') {
        // 既 approved / skipped → idempotent no-op
        skippedCount++
        continue
      }
      if (validStatus !== 'valid') {
        rejected.push({ row_id: id, reason: 'validation_not_valid' })
        continue
      }
      if (pendingDupSet.has(id)) {
        rejected.push({ row_id: id, reason: 'duplicate_unresolved' })
        continue
      }
      toApply.push(id)
    } else {
      // SKIP: pending のみ処理、それ以外は idempotent
      if (reviewStatus !== 'pending') {
        skippedCount++
        continue
      }
      toApply.push(id)
    }
  }

  // Bulk update — chunk で company_id + session_id filter 付き .in('id', chunk)
  const CHUNK = 100
  const nowIso = new Date().toISOString()
  const newReviewStatus = action === 'SKIP' ? 'skipped' : 'approved'

  let appliedCount = 0
  for (let i = 0; i < toApply.length; i += CHUNK) {
    const chunk = toApply.slice(i, i + CHUNK)
    const { error: updErr } = await auth.adminClient
      .from('import_staging_rows')
      .update({ review_status: newReviewStatus, updated_at: nowIso } as never)
      .eq('session_id', sessionId)
      .eq('company_id', auth.companyId)
      .in('id', chunk)
    if (updErr) {
      return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Staging行の更新に失敗しました' }, { status: 500 })
    }
    appliedCount += chunk.length
  }

  writeAuditLog(auth, sessionId, 'review.bulk_action', {
    action,
    requested_count: ids.length,
    applied_count:   appliedCount,
    skipped_count:   skippedCount,
    rejected_count:  rejected.length,
    // Individual row_id / reason は audit に含めるが PII 除外
    rejected_reasons: aggregateReasons(rejected),
  })

  return NextResponse.json({
    success: true,
    data: {
      action,
      requested: ids.length,
      applied:   appliedCount,
      skipped:   skippedCount,
      rejected,
    },
  })
}

function aggregateReasons(rejected: Array<{ row_id: string; reason: string }>): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const r of rejected) acc[r.reason] = (acc[r.reason] ?? 0) + 1
  return acc
}
