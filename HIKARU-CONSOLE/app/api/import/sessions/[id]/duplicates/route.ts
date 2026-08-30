import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { requireAdmin, getOwnedSession, writeAuditLog } from '@/lib/import/helpers'
import {
  detectClientDuplicates,
  detectStoreDuplicates,
  type ExistingClient,
  type ExistingStore,
  type StagedRowForDuplicate,
} from '@/lib/import/duplicate-engine'

// Batch sizes for DB operations
const STAGING_BATCH    = 500   // rows per staging SELECT page
const EXISTING_LIMIT   = 20_000 // max existing records loaded per entity
const CANDIDATE_BATCH  = 250   // rows per candidate INSERT batch

// POST /api/import/sessions/[id]/duplicates
//
// Runs deterministic duplicate detection against existing clients/stores.
// Session must be in review_required state.
//
// Design:
//   - Business tables: SELECT ONLY (clients, stores)
//   - Zero OpenAI calls
//   - Zero auto-merge
//   - Idempotent: deletes existing candidates for this session before re-inserting
//   - N+1: NO — staging rows fetched in pages; existing records loaded once per entity
//   - match_reasons: returned in response but NOT stored (schema gap — no column in 049)
//   - Session state: remains review_required throughout
export async function POST(
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

  if (session.status !== 'review_required') {
    return NextResponse.json(
      { code: 'INVALID_SESSION_STATE', message: `重複検出はreview_required状態のセッションのみ可能です (現在: ${session.status})` },
      { status: 409 },
    )
  }

  const entityType = session.entity_type as string
  if (entityType !== 'client' && entityType !== 'store') {
    return NextResponse.json(
      { code: 'UNSUPPORTED_ENTITY_TYPE', message: `重複検出はclient/storeのみサポートしています (entity_type: ${entityType})` },
      { status: 422 },
    )
  }

  writeAuditLog(auth, sessionId, 'duplicate_scan.started', { entity_type: entityType })

  // ---- Load staging rows (all, no filter on validation_status) ----
  // Fetched in pages to avoid memory spike on large sessions.
  const allStagingRows: StagedRowForDuplicate[] = []
  let   offset = 0
  let   keepFetching = true

  while (keepFetching) {
    const { data: page, error } = await auth.adminClient
      .from('import_staging_rows')
      .select('id, mapped_data')
      .eq('session_id', sessionId)
      .eq('company_id', auth.companyId)
      .order('row_index', { ascending: true })
      .range(offset, offset + STAGING_BATCH - 1)

    if (error) {
      writeAuditLog(auth, sessionId, 'duplicate_scan.failed', { reason: 'staging_fetch_error', error: error.code })
      return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Staging行の取得に失敗しました' }, { status: 500 })
    }

    const rows = (page ?? []) as StagedRowForDuplicate[]
    allStagingRows.push(...rows)

    if (rows.length < STAGING_BATCH) {
      keepFetching = false
    } else {
      offset += STAGING_BATCH
    }
  }

  // ---- Load existing records (READ ONLY — no INSERT/UPDATE/DELETE) ----
  let existingClients: ExistingClient[] = []
  let existingStores:  ExistingStore[]  = []

  if (entityType === 'client') {
    const { data, error } = await auth.adminClient
      .from('clients')
      .select('id, name, email, phone, address')
      .eq('company_id', auth.companyId)
      .eq('is_active', true)
      .limit(EXISTING_LIMIT)

    if (error) {
      writeAuditLog(auth, sessionId, 'duplicate_scan.failed', { reason: 'existing_clients_fetch_error' })
      return NextResponse.json({ code: 'INTERNAL_ERROR', message: '既存クライアントの取得に失敗しました' }, { status: 500 })
    }
    existingClients = (data ?? []) as ExistingClient[]
  } else {
    const { data, error } = await auth.adminClient
      .from('stores')
      .select('id, name, phone, address, client_id')
      .eq('company_id', auth.companyId)
      .eq('is_active', true)
      .limit(EXISTING_LIMIT)

    if (error) {
      writeAuditLog(auth, sessionId, 'duplicate_scan.failed', { reason: 'existing_stores_fetch_error' })
      return NextResponse.json({ code: 'INTERNAL_ERROR', message: '既存店舗の取得に失敗しました' }, { status: 500 })
    }
    existingStores = (data ?? []) as ExistingStore[]
  }

  // ---- Run duplicate engine (pure in-memory, zero AI) ----
  const matches = entityType === 'client'
    ? detectClientDuplicates(allStagingRows, existingClients)
    : detectStoreDuplicates(allStagingRows, existingStores)

  // ---- Idempotency: delete existing candidates for this session only ----
  const { error: deleteError } = await auth.adminClient
    .from('import_duplicate_candidates')
    .delete()
    .eq('session_id', sessionId)
    .eq('company_id', auth.companyId)

  if (deleteError) {
    writeAuditLog(auth, sessionId, 'duplicate_scan.failed', { reason: 'candidate_delete_error' })
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: '既存候補の削除に失敗しました' }, { status: 500 })
  }

  // ---- Batch INSERT candidates ----
  let insertedCount = 0

  if (matches.length > 0) {
    const batches = Math.ceil(matches.length / CANDIDATE_BATCH)

    for (let i = 0; i < batches; i++) {
      const batch = matches.slice(i * CANDIDATE_BATCH, (i + 1) * CANDIDATE_BATCH)

      const rows = batch.map(m => ({
        session_id:            sessionId,
        company_id:            auth.companyId,
        staging_row_id:        m.stagingRowId,
        existing_record_id:    m.existingRecordId,
        existing_record_table: m.existingRecordTable,
        similarity_score:      m.score,
        match_reasons:         m.matchReasons,   // stored since migration 050
        review_status:         'pending',
      }))

      const { error: insertError } = await auth.adminClient
        .from('import_duplicate_candidates')
        .insert(rows as never)

      if (insertError) {
        writeAuditLog(auth, sessionId, 'duplicate_scan.failed', {
          reason:      'candidate_insert_error',
          batch:       i,
          inserted:    insertedCount,
          error:       insertError.code,
        })
        return NextResponse.json(
          { code: 'INTERNAL_ERROR', message: '重複候補の保存に失敗しました' },
          { status: 500 },
        )
      }

      insertedCount += batch.length
    }
  }

  // ---- Update session duplicate_rows count ----
  // Count distinct staging rows that have at least one candidate
  const affectedStagingRowIds = new Set(matches.map(m => m.stagingRowId))

  await auth.adminClient
    .from('import_sessions')
    .update({
      duplicate_rows: affectedStagingRowIds.size,
      updated_at:     new Date().toISOString(),
    } as never)
    .eq('id', sessionId)
    .eq('company_id', auth.companyId)

  writeAuditLog(auth, sessionId, 'duplicate_scan.completed', {
    entity_type:          entityType,
    staging_rows_scanned: allStagingRows.length,
    existing_records:     entityType === 'client' ? existingClients.length : existingStores.length,
    candidates_created:   insertedCount,
    staging_rows_flagged: affectedStagingRowIds.size,
  })

  // match_reasons returned in response (also stored in DB since migration 050)
  const matchSummary = matches.map(m => ({
    stagingRowId:        m.stagingRowId,
    existingRecordId:    m.existingRecordId,
    existingRecordTable: m.existingRecordTable,
    score:               m.score,
    matchReasons:        m.matchReasons,
  }))

  return NextResponse.json({
    success: true,
    data: {
      session:              { id: sessionId, status: session.status },
      entity_type:          entityType,
      staging_rows_scanned: allStagingRows.length,
      existing_records:     entityType === 'client' ? existingClients.length : existingStores.length,
      candidates_created:   insertedCount,
      staging_rows_flagged: affectedStagingRowIds.size,
      // match_reasons included here but not persisted (schema gap — see migration 050 requirement)
      matches:              matchSummary,
    },
  })
}
