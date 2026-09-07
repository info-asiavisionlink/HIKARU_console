import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { sendNotification } from '@/lib/line/notification.service'
import { expenseSettledTemplate } from '@/lib/line/templates'

// ============================================================
// POST /api/expenses/settle-batch — 承認済み経費の一括精算
//
// 単発endpoint /api/expenses/[id]/settle と同じ契約:
//   - Admin auth (getAuthContext)
//   - company_id は server auth から確定（clientから受け取らない）
//   - status='approved' のみ処理
//   - settled_amount は各 expenses.amount を採用（単発 default と同義）
//   - 通知は fire-and-forget（失敗しても精算は取り消さない）
//
// トランザクション方針:
//   PostgREST は 1 statement 内 UPDATE で列間コピー
//   (`SET settled_amount = amount`) をサポートしないため、
//   pre-fetched の amount を用いて 1 回のバルク UPSERT で全 row を書く。
//   1 statement 内で処理されるため部分適用は発生しない
//   (全件成功 or 全件ロールバック = all-or-nothing)。
// ============================================================

const MAX_BATCH_SIZE = 100

const CATEGORY_LABELS: Record<string, string> = {
  transport:   '交通費',
  parking:     '駐車料',
  supplies:    '備品費',
  consumables: '消耗品費',
  other:       'その他',
}

interface BatchSettleResponse {
  requested_count: number
  settled_count:   number
  failed_count:    number
  settled_ids:     string[]
  failed_ids:      string[]
  errors:          Record<string, 'NOT_FOUND' | 'INVALID_STATUS' | 'DB_ERROR'>
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { ids?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  if (!Array.isArray(body.ids)) {
    return NextResponse.json({ error: 'ids array required' }, { status: 400 })
  }

  const rawIds = body.ids.filter((v): v is string => typeof v === 'string' && v.length > 0)
  const ids    = Array.from(new Set(rawIds))

  if (ids.length === 0) {
    return NextResponse.json({ error: 'ids must be non-empty' }, { status: 400 })
  }
  if (ids.length > MAX_BATCH_SIZE) {
    return NextResponse.json(
      { error: `batch size exceeds max (${MAX_BATCH_SIZE})` },
      { status: 400 }
    )
  }

  // ── 1. Fetch existing rows scoped to auth.companyId ───────
  // 別会社の id を混ぜて送っても company scope で弾かれる。
  // UPSERT 用に全列取得（NOT NULL 列を保持するため）。
  const fetchRes = await auth.adminClient
    .from('expenses')
    .select('*')
    .in('id', ids)
    .eq('company_id', auth.companyId) as {
      data:  Array<Record<string, unknown>> | null
      error: { message: string } | null
    }

  if (fetchRes.error) {
    return NextResponse.json({ error: fetchRes.error.message }, { status: 500 })
  }

  const existingRows = fetchRes.data ?? []

  const existingMap = new Map<string, Record<string, unknown>>()
  for (const row of existingRows) {
    existingMap.set(row.id as string, row)
  }

  const errors:      BatchSettleResponse['errors'] = {}
  const eligibleRows: Record<string, unknown>[]    = []

  for (const id of ids) {
    const row = existingMap.get(id)
    if (!row) {
      // 会社スコープ外 or 存在しない → 詳細を漏らさず NOT_FOUND
      errors[id] = 'NOT_FOUND'
      continue
    }
    if (row.status !== 'approved') {
      errors[id] = 'INVALID_STATUS'
      continue
    }
    eligibleRows.push(row)
  }

  if (eligibleRows.length === 0) {
    const failed_ids = Object.keys(errors)
    return NextResponse.json({
      requested_count: ids.length,
      settled_count:   0,
      failed_count:    failed_ids.length,
      settled_ids:     [],
      failed_ids,
      errors,
    } satisfies BatchSettleResponse)
  }

  // ── 2. Bulk UPSERT (id conflict → UPDATE branch) ─────────
  const nowIso = new Date().toISOString()

  const upsertPayload = eligibleRows.map(row => ({
    ...row,
    status:         'settled' as const,
    settled_by:     auth.userId,
    settled_at:     nowIso,
    settled_amount: (row.amount as number | null) ?? null,
  }))

  const upsertRes = await auth.adminClient
    .from('expenses')
    .upsert(upsertPayload as never, { onConflict: 'id' })
    .select('id, worker_id, category, amount, description') as {
      data:  Array<Record<string, unknown>> | null
      error: { message: string } | null
    }

  const updatedRows = upsertRes.data
  const upsertError = upsertRes.error

  if (upsertError) {
    // 1 statement UPSERT の失敗は Postgres が全 row を rollback。
    // 部分適用なし。全 eligibleRows を DB_ERROR で返す。
    for (const row of eligibleRows) errors[row.id as string] = 'DB_ERROR'
    const failed_ids = Object.keys(errors)
    return NextResponse.json({
      requested_count: ids.length,
      settled_count:   0,
      failed_count:    failed_ids.length,
      settled_ids:     [],
      failed_ids,
      errors,
    } satisfies BatchSettleResponse, { status: 500 })
  }

  const settled_ids = (updatedRows ?? []).map(r => r.id as string)

  // ── 3. Fire-and-forget 通知（単発 settle と同一契約） ─────
  for (const row of (updatedRows ?? [])) {
    const original = existingMap.get(row.id as string)
    if (!original) continue

    const finalAmount = (original.amount as number | null) ?? null
    const workerId    = (original.worker_id as string | null) ?? null
    const category    = (original.category as string | null) ?? null
    const description = (original.description as string | null) ?? null

    void insertExpenseSystemNotification(auth.adminClient, {
      expenseId:  row.id as string,
      companyId:  auth.companyId,
      workerId,
      type:       'expense_settled',
      title:      '経費が精算されました',
      body:       buildSettleBody(category, finalAmount),
    })

    void sendNotification({
      companyId:       auth.companyId,
      eventType:       'expense_settled',
      notificationKey: `expense_settled:${row.id as string}`,
      profileId:       workerId ?? undefined,
      message:         expenseSettledTemplate({
        applicantName: '',
        amount:        finalAmount ?? 0,
        description:   description ?? '',
      }),
    })
  }

  const failed_ids = Object.keys(errors)
  return NextResponse.json({
    requested_count: ids.length,
    settled_count:   settled_ids.length,
    failed_count:    failed_ids.length,
    settled_ids,
    failed_ids,
    errors,
  } satisfies BatchSettleResponse)
}

function buildSettleBody(category: string | null, amount: number | null): string {
  const label = CATEGORY_LABELS[category ?? ''] ?? 'その他'
  const yen   = (amount ?? 0).toLocaleString('ja-JP')
  return `${label} ¥${yen} が精算されました。`
}

async function insertExpenseSystemNotification(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any,
  opts: {
    expenseId:  string
    companyId:  string
    workerId:   string | null
    type:       string
    title:      string
    body:       string
  }
) {
  if (!opts.workerId) return
  const { error } = await adminClient
    .from('notifications')
    .insert({
      company_id:           opts.companyId,
      recipient_profile_id: opts.workerId,
      title:                opts.title,
      body:                 opts.body,
      type:                 opts.type,
      target_app:           'worker',
      is_read:              false,
      target_url:           `/expenses/${opts.expenseId}`,
    })
  if (error) {
    console.error(`[System通知] expenses/${opts.expenseId} ${opts.type} 挿入失敗:`, error.message)
  }
}
