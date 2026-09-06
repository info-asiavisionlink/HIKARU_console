import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { requireAdmin, getOwnedSession, writeAuditLog } from '@/lib/import/helpers'
import { buildHeaderMapping, applyRowMapping, validateMappedRow } from '@/lib/import/mapper'
import { buildFkIndex, resolveFk, type FkIndex } from '@/lib/import/fk-resolver'
import type { ImportEntityType } from '@/types/import'

const BATCH_SIZE = 250  // rows per upsert batch

// POST /api/import/sessions/[id]/map
//
// Staging Rowsに対してDeterministic Header Mappingを実行し、
// mapped_data / validation_status を更新する。
//
// 遷移: mapping → validating → review_required
//
// 設計:
//   - Header Mappingはファイル単位で1回のみ決定 (N×推測禁止)
//   - 全Rowへ同一Mapping Ruleを適用
//   - Batch UPSERT (BATCH_SIZE行/回)
//   - OpenAI calls: 0
//   - Business Tableへの書き込みなし (import_staging_rowsのみ)
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params

  // 1. Authentication
  const auth = await getAuthContext()
  if (!auth) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: '認証が必要です' }, { status: 401 })
  }

  // 2. Admin authorization
  if (!(await requireAdmin(auth))) {
    return NextResponse.json({ code: 'FORBIDDEN', message: '管理者権限が必要です' }, { status: 403 })
  }

  // 3. Session ownership + state validation
  const session = await getOwnedSession(auth, sessionId)
  if (!session) {
    return NextResponse.json(
      { code: 'IMPORT_SESSION_NOT_FOUND', message: 'インポートセッションが見つかりません' },
      { status: 404 },
    )
  }

  if (session.status !== 'mapping') {
    return NextResponse.json(
      { code: 'INVALID_SESSION_STATE', message: `Mappingはmapping状態のセッションのみ可能です (現在: ${session.status})` },
      { status: 409 },
    )
  }

  const entityType = session.entity_type as ImportEntityType

  // 4. Get import_files to retrieve normalized_headers from extraction metadata
  const { data: fileRecord, error: fileErr } = await auth.adminClient
    .from('import_files')
    .select('id, validation_errors')
    .eq('session_id', sessionId)
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (fileErr || !fileRecord) {
    return NextResponse.json({ code: 'FILE_NOT_FOUND', message: 'ファイルレコードが見つかりません' }, { status: 404 })
  }

  const fr = fileRecord as Record<string, unknown>
  const extractMeta = fr.validation_errors as Record<string, unknown> | null
  const normalizedHeaders: string[] = Array.isArray(extractMeta?.['normalized_headers'])
    ? (extractMeta!['normalized_headers'] as string[])
    : []

  if (normalizedHeaders.length === 0) {
    return NextResponse.json(
      { code: 'MAPPING_FAILED', message: 'ヘッダー情報が取得できません。Extractionが完了しているか確認してください' },
      { status: 422 },
    )
  }

  // 5. Build header mapping ONCE for this file (not per row)
  const mappingResult = buildHeaderMapping(normalizedHeaders, entityType)

  // Session → validating
  await auth.adminClient
    .from('import_sessions')
    .update({ status: 'validating', updated_at: new Date().toISOString() } as never)
    .eq('id', sessionId)
    .eq('company_id', auth.companyId)

  writeAuditLog(auth, sessionId, 'mapping.started', {
    entity_type:      entityType,
    header_mapping:   mappingResult.headerMapping,
    unmapped_headers: mappingResult.unmappedHeaders,
  })

  // 6. Fetch all staging rows for this session
  const { data: stagingRows, error: fetchErr } = await auth.adminClient
    .from('import_staging_rows')
    .select('id, session_id, file_id, company_id, row_index, raw_data, normalized_data, review_status, created_at')
    .eq('session_id', sessionId)
    .eq('company_id', auth.companyId)
    .order('row_index', { ascending: true })

  if (fetchErr || !stagingRows) {
    return NextResponse.json({ code: 'STAGING_FAILED', message: 'Staging行の取得に失敗しました' }, { status: 500 })
  }

  // 6.5. FK Resolution pre-load (entity 依存、pre-loaded index で N+1 完全防止)
  // Store   : client_id を CSV 上の client_code / client_name から resolve
  // Project : client_id + store_id
  // Expense : employees + projects (worker_id は employees.auth_user_id 経由で解決)
  // Attendance: employees (worker_id は auth_user_id 経由、missing_auth_user 判定)
  // Shift   : projects + employees + partners
  let storeClientIndex:  FkIndex<{ id: string; code: string | null; name: string | null }> | null = null
  let projectStoreIndex: FkIndex<{ id: string; code: string | null; name: string | null }> | null = null
  let projectsIndex:     FkIndex<{ id: string; code: string | null; name: string | null }> | null = null
  // Employee has (id, employee_number, name, auth_user_id) — auth_user_id needed to resolve worker_id.
  let employeesRaw: Array<{ id: string; employee_number: string | null; name: string | null; auth_user_id: string | null }> | null = null
  let employeesByCode: Map<string, Array<{ id: string; auth_user_id: string | null }>> | null = null
  let employeesByName: Map<string, Array<{ id: string; auth_user_id: string | null }>> | null = null
  let partnersIndex:  FkIndex<{ id: string; code: string | null; name: string | null }> | null = null

  const needsClient  = entityType === 'store' || entityType === 'project'
  const needsStore   = entityType === 'project'
  const needsProject = entityType === 'expense' || entityType === 'shift'
  const needsEmployee = entityType === 'expense' || entityType === 'attendance' || entityType === 'shift'
  const needsPartner = entityType === 'shift'

  if (needsClient) {
    const { data, error: err } = await auth.adminClient
      .from('clients').select('id, code, name')
      .eq('company_id', auth.companyId).eq('is_active', true).limit(10000)
    if (err) return NextResponse.json({ code: 'STAGING_FAILED', message: 'FK resolve 用の顧客一覧取得に失敗しました' }, { status: 500 })
    storeClientIndex = buildFkIndex((data ?? []) as { id: string; code: string | null; name: string | null }[])
  }
  if (needsStore) {
    const { data, error: err } = await auth.adminClient
      .from('stores').select('id, code, name')
      .eq('company_id', auth.companyId).limit(10000)
    if (err) return NextResponse.json({ code: 'STAGING_FAILED', message: 'FK resolve 用の店舗一覧取得に失敗しました' }, { status: 500 })
    projectStoreIndex = buildFkIndex((data ?? []) as { id: string; code: string | null; name: string | null }[])
  }
  if (needsProject) {
    const { data, error: err } = await auth.adminClient
      .from('projects').select('id, code, name')
      .eq('company_id', auth.companyId).limit(10000)
    if (err) return NextResponse.json({ code: 'STAGING_FAILED', message: 'FK resolve 用の案件一覧取得に失敗しました' }, { status: 500 })
    projectsIndex = buildFkIndex((data ?? []) as { id: string; code: string | null; name: string | null }[])
  }
  if (needsEmployee) {
    const { data, error: err } = await auth.adminClient
      .from('employees').select('id, employee_number, name, auth_user_id')
      .eq('company_id', auth.companyId).limit(10000)
    if (err) return NextResponse.json({ code: 'STAGING_FAILED', message: 'FK resolve 用の従業員一覧取得に失敗しました' }, { status: 500 })
    // Supabase generated types が employees を never にしているため cast (Migration 011 準拠の実 shape)
    employeesRaw = (data ?? []) as unknown as typeof employeesRaw
    employeesByCode = new Map(); employeesByName = new Map()
    for (const e of employeesRaw!) {
      const codeKey = (e.employee_number ?? '').trim().toLowerCase()
      const nameKey = (e.name ?? '').trim().toLowerCase()
      if (codeKey) {
        const arr = employeesByCode.get(codeKey) ?? []; arr.push({ id: e.id, auth_user_id: e.auth_user_id }); employeesByCode.set(codeKey, arr)
      }
      if (nameKey) {
        const arr = employeesByName.get(nameKey) ?? []; arr.push({ id: e.id, auth_user_id: e.auth_user_id }); employeesByName.set(nameKey, arr)
      }
    }
  }
  if (needsPartner) {
    const { data, error: err } = await auth.adminClient
      .from('partners').select('id, code:partner_code, name')
      .eq('company_id', auth.companyId).limit(10000)
    if (err) return NextResponse.json({ code: 'STAGING_FAILED', message: 'FK resolve 用の協力業者一覧取得に失敗しました' }, { status: 500 })
    partnersIndex = buildFkIndex((data ?? []) as { id: string; code: string | null; name: string | null }[])
  }

  // Employee resolver: 同時に auth_user_id 存在も確定する (Attendance / Expense の worker_id 用)。
  function resolveEmployee(code: string | null, name: string | null):
    { status: 'resolved' | 'missing_auth_user' | 'not_found' | 'ambiguous';
      employee_id: string | null; auth_user_id: string | null }
  {
    if (!employeesByCode || !employeesByName) return { status: 'not_found', employee_id: null, auth_user_id: null }
    const codeKey = (code ?? '').trim().toLowerCase()
    const nameKey = (name ?? '').trim().toLowerCase()

    let matches: Array<{ id: string; auth_user_id: string | null }> = []
    if (codeKey) matches = employeesByCode.get(codeKey) ?? []
    if (matches.length === 0 && !codeKey && nameKey) matches = employeesByName.get(nameKey) ?? []

    if (matches.length === 0) return { status: 'not_found',  employee_id: null, auth_user_id: null }
    if (matches.length > 1)   return { status: 'ambiguous',  employee_id: null, auth_user_id: null }

    const m = matches[0]
    if (m.auth_user_id === null) return { status: 'missing_auth_user', employee_id: m.id, auth_user_id: null }
    return { status: 'resolved', employee_id: m.id, auth_user_id: m.auth_user_id }
  }

  // 7. Apply mapping + validation to each row (in memory)
  let validCount   = 0
  let invalidCount = 0
  let warningCount = 0

  const processedRows = (stagingRows as Record<string, unknown>[]).map(row => {
    const normalizedData = (row['normalized_data'] as Record<string, string | null>) ?? {}

    const { mappedData, unmappedHeaders: rowUnmapped } = applyRowMapping(normalizedData, mappingResult, entityType)

    // FK Resolution: Store の場合 client_code / client_name → client_id 変換
    if (entityType === 'store' && storeClientIndex) {
      const fkResult = resolveFk(storeClientIndex, {
        code: mappedData['client_code'] ?? null,
        name: mappedData['client_name'] ?? null,
      })
      if (fkResult.status === 'resolved' && fkResult.id) {
        mappedData['client_id']       = fkResult.id
        mappedData['client_fk_status'] = 'resolved'
      } else if (fkResult.status === 'ambiguous') {
        mappedData['client_id']       = null
        mappedData['client_fk_status'] = 'ambiguous'
      } else {
        mappedData['client_id']       = null
        mappedData['client_fk_status'] = 'not_found'
      }
    }

    // Project: client_id + store_id 両方 optional (両者無指定でも合格)
    if (entityType === 'project') {
      if (storeClientIndex && (mappedData['client_code'] || mappedData['client_name'])) {
        const r = resolveFk(storeClientIndex, { code: mappedData['client_code'] ?? null, name: mappedData['client_name'] ?? null })
        if (r.status === 'resolved' && r.id) { mappedData['client_id'] = r.id; mappedData['client_fk_status'] = 'resolved' }
        else { mappedData['client_id'] = null; mappedData['client_fk_status'] = r.status }
      }
      if (projectStoreIndex && (mappedData['store_code'] || mappedData['store_name'])) {
        const r = resolveFk(projectStoreIndex, { code: mappedData['store_code'] ?? null, name: mappedData['store_name'] ?? null })
        if (r.status === 'resolved' && r.id) { mappedData['store_id'] = r.id; mappedData['store_fk_status'] = 'resolved' }
        else { mappedData['store_id'] = null; mappedData['store_fk_status'] = r.status }
      }
    }

    // Expense: employee → worker_id (auth_user_id 必須) + project_id
    if (entityType === 'expense') {
      const empCode = mappedData['employee_number'] ?? null
      const empName = mappedData['employee_name'] ?? null
      if (empCode || empName) {
        const er = resolveEmployee(empCode, empName)
        mappedData['employee_id']       = er.employee_id ?? null
        mappedData['worker_id']         = er.auth_user_id ?? null
        mappedData['worker_fk_status']  = er.status
      }
      if (projectsIndex && (mappedData['project_code'] || mappedData['project_name'])) {
        const r = resolveFk(projectsIndex, { code: mappedData['project_code'] ?? null, name: mappedData['project_name'] ?? null })
        if (r.status === 'resolved' && r.id) { mappedData['project_id'] = r.id; mappedData['project_fk_status'] = 'resolved' }
        else { mappedData['project_id'] = null; mappedData['project_fk_status'] = r.status }
      }
    }

    // Attendance: employee → worker_id のみ (auth_user_id 必須)
    if (entityType === 'attendance') {
      const empCode = mappedData['employee_number'] ?? null
      const empName = mappedData['employee_name'] ?? null
      const er = resolveEmployee(empCode, empName)
      mappedData['employee_id']      = er.employee_id ?? null
      mappedData['worker_id']        = er.auth_user_id ?? null
      mappedData['worker_fk_status'] = er.status
    }

    // Shift: project_id + assignee (employee or partner)
    if (entityType === 'shift') {
      if (projectsIndex) {
        const r = resolveFk(projectsIndex, { code: mappedData['project_code'] ?? null, name: mappedData['project_name'] ?? null })
        if (r.status === 'resolved' && r.id) { mappedData['project_id'] = r.id; mappedData['project_fk_status'] = 'resolved' }
        else { mappedData['project_id'] = null; mappedData['project_fk_status'] = r.status }
      }
      const assigneeType = mappedData['assignee_type']
      if (assigneeType === 'employee') {
        const er = resolveEmployee(mappedData['employee_number'] ?? null, mappedData['employee_name'] ?? null)
        // Shift.employee_id は employees.id (Employee ログイン ID/auth_user_id は不要)
        mappedData['employee_id']         = er.employee_id ?? null
        mappedData['employee_fk_status']  = er.status === 'missing_auth_user' ? 'resolved' : er.status
        mappedData['partner_id']          = null
      } else if (assigneeType === 'partner' && partnersIndex) {
        const r = resolveFk(partnersIndex, { code: mappedData['partner_code'] ?? null, name: mappedData['partner_name'] ?? null })
        if (r.status === 'resolved' && r.id) { mappedData['partner_id'] = r.id; mappedData['partner_fk_status'] = 'resolved' }
        else { mappedData['partner_id'] = null; mappedData['partner_fk_status'] = r.status }
        mappedData['employee_id'] = null
      }
    }

    const validation = validateMappedRow(mappedData, entityType, rowUnmapped)

    if (validation.status === 'valid')    validCount++
    else if (validation.status === 'invalid') invalidCount++
    else                                      warningCount++

    const validationErrors = buildRowValidationErrors(validation, rowUnmapped)

    return {
      id:                row['id'] as string,
      session_id:        sessionId,
      file_id:           row['file_id'] as string,
      company_id:        auth.companyId,
      row_index:         row['row_index'] as number,
      raw_data:          row['raw_data'],          // untouched
      normalized_data:   row['normalized_data'],    // untouched
      mapped_data:       mappedData,
      validation_status: validation.status,
      validation_errors: validationErrors,
      review_status:     row['review_status'] as string,
      created_at:        row['created_at'] as string,
      updated_at:        new Date().toISOString(),
    }
  })

  // 8. Batch upsert staging rows (mapped_data + validation updates)
  const totalRows  = processedRows.length
  const batchCount = Math.ceil(totalRows / BATCH_SIZE)

  for (let i = 0; i < batchCount; i++) {
    const batch = processedRows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)

    const { error: upsertErr } = await auth.adminClient
      .from('import_staging_rows')
      .upsert(batch as never, { onConflict: 'id' })

    if (upsertErr) {
      console.error('[map] Batch upsert failed (batch', i, '):', upsertErr.message)
      // Restore session to mapping state for retry
      await auth.adminClient
        .from('import_sessions')
        .update({ status: 'mapping', updated_at: new Date().toISOString() } as never)
        .eq('id', sessionId)
        .eq('company_id', auth.companyId)

      writeAuditLog(auth, sessionId, 'mapping.failed', { failed_batch: i, error: upsertErr.code })
      return NextResponse.json(
        { code: 'MAPPING_FAILED', message: 'Mappingデータの保存に失敗しました。再試行できます。' },
        { status: 500 },
      )
    }
  }

  // 9. Update session counters + status → review_required
  await auth.adminClient
    .from('import_sessions')
    .update({
      status:       'review_required',
      valid_rows:   validCount,
      invalid_rows: invalidCount,
      updated_at:   new Date().toISOString(),
    } as never)
    .eq('id', sessionId)
    .eq('company_id', auth.companyId)

  // 10. Audit (non-blocking)
  writeAuditLog(auth, sessionId, 'mapping.completed', {
    entity_type:       entityType,
    total_rows:        totalRows,
    valid_rows:        validCount,
    invalid_rows:      invalidCount,
    warning_rows:      warningCount,
    unmapped_headers:  mappingResult.unmappedHeaders,
    batch_count:       batchCount,
  })

  return NextResponse.json({
    success: true,
    data: {
      session: { id: sessionId, status: 'review_required' },
      mapping: {
        entity_type:      entityType,
        header_mapping:   mappingResult.headerMapping,
        unmapped_headers: mappingResult.unmappedHeaders,
        total_rows:       totalRows,
        valid_rows:       validCount,
        invalid_rows:     invalidCount,
        warning_rows:     warningCount,
      },
    },
  })
}

// ---- Helper ----

function buildRowValidationErrors(
  validation: { missingRequired: string[]; invalidFields: Array<{ field: string; reason: string }> },
  unmappedHeaders: string[],
): Record<string, unknown> | null {
  if (
    validation.missingRequired.length === 0 &&
    validation.invalidFields.length === 0 &&
    unmappedHeaders.length === 0
  ) {
    return null
  }
  const obj: Record<string, unknown> = {}
  if (validation.missingRequired.length > 0) obj['missing_required'] = validation.missingRequired
  if (validation.invalidFields.length > 0)   obj['invalid_fields']   = validation.invalidFields
  if (unmappedHeaders.length > 0)            obj['unmapped_headers']  = unmappedHeaders
  return obj
}
