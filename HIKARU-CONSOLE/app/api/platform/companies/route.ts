// ============================================================
// HIKARU Platform API — POST /api/platform/companies
//
// Trusted Company + First Admin Provisioning.
// Only callable by verified Platform Operator.
//
// Flow:
//   1. verifyPlatformOperator (Supabase Auth cryptographic verify + DB check)
//   2. Idempotency-Key header 検証 (UUID) + payload validation
//   3. Idempotency record 参照 (完了なら replay、processingなら 409、
//      failed なら明示要拒否、別 payloadなら 409、無ければ INSERT processing)
//   4. companies INSERT (name)
//   5. auth.admin.inviteUserByEmail (redirectTo: /auth/callback?next=/set-password)
//   6. profiles UPDATE (company_id + role='admin' + name) → verify
//   7. Compensation on failure at each step
//   8. Audit each event
//   9. Idempotency record UPDATE completed + response保存
//
// Security invariants:
//   - hk_c_uid / hk_c_role を authority に使わない
//   - company_id / role / user_id を body から受け取らない
//   - user_metadata を authority に使わない
//   - password / token / URL を audit log に出さない
// ============================================================

import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyPlatformOperator } from '@/lib/auth/verified-platform-operator'
import { writePlatformAudit } from '@/lib/audit/platform-audit'
import type { AuthContext } from '@/lib/supabase/server-admin'
import {
  validateProvisioningInput,
  isValidIdempotencyKey,
  computeRequestHash,
  resolveSiteUrl,
  buildInvitationRedirectUrl,
  hashEmail,
  type NormalizedProvisioningInput,
} from '@/lib/provisioning/company-provisioning'

const IDEMPOTENCY_HEADER = 'Idempotency-Key'
const IDEMPOTENCY_TABLE  = 'platform_provisioning_idempotency'
const COMPANIES_TABLE    = 'companies'
const PROFILES_TABLE     = 'profiles'

// ---- Helper: build AuthContext-shaped adapter for P2 audit ----

function buildAuditAuth(admin: ReturnType<typeof createAdminClient>, operatorUserId: string): AuthContext {
  // P2 writePlatformAudit は AuthContext を必要とする。
  // Platform API は Tenant scoped ではないので companyId はダミー。
  // adminClient と userId (=verified operator) だけが実際に使われる。
  return {
    userId:      operatorUserId,
    companyId:   '',
    rlsClient:   null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adminClient: admin as any,
  } as AuthContext
}

// ---- Compensation ----

async function deleteCompanySafe(admin: ReturnType<typeof createAdminClient>, companyId: string): Promise<void> {
  try {
    const { error } = await admin.from(COMPANIES_TABLE).delete().eq('id', companyId)
    if (error) console.error('[provisioning] company cleanup failed:', error.code, error.message)
  } catch (e) {
    console.error('[provisioning] company cleanup threw:', e instanceof Error ? e.message : 'unknown')
  }
}

async function deleteAuthUserSafe(admin: ReturnType<typeof createAdminClient>, authUserId: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (admin as any).auth.admin.deleteUser(authUserId)
    if (res?.error) console.error('[provisioning] auth user cleanup failed:', res.error.message)
  } catch (e) {
    console.error('[provisioning] auth user cleanup threw:', e instanceof Error ? e.message : 'unknown')
  }
}

// ---- POST handler ----

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ---- 1. Verified Platform Operator ----
  const opResult = await verifyPlatformOperator()
  if (opResult.status === 'unauthorized') {
    return NextResponse.json({ error: 'authentication required', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  if (opResult.status !== 'operator') {
    return NextResponse.json({ error: 'platform operator required', code: 'FORBIDDEN' }, { status: 403 })
  }
  const operatorUserId = opResult.userId

  // ---- 2. Idempotency-Key + payload validation ----
  const idempotencyKey = req.headers.get(IDEMPOTENCY_HEADER)
  if (!isValidIdempotencyKey(idempotencyKey)) {
    return NextResponse.json(
      { error: 'Idempotency-Key header (UUID) is required', code: 'IDEMPOTENCY_KEY_REQUIRED' },
      { status: 400 },
    )
  }

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const validation = validateProvisioningInput(rawBody as Record<string, unknown>)
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.error, code: 'INVALID_INPUT', field: validation.field },
      { status: 400 },
    )
  }

  // client-supplied values (company_id / role / user_id / password) は完全無視
  const input: NormalizedProvisioningInput = validation.value
  const requestHash = computeRequestHash(input)

  // ---- 3. Console URL configuration ----
  const siteUrl = resolveSiteUrl()
  if (!siteUrl) {
    console.error('[provisioning] NEXT_PUBLIC_CONSOLE_URL is missing or invalid')
    return NextResponse.json(
      { error: 'server configuration error', code: 'CONFIGURATION_MISSING' },
      { status: 503 },
    )
  }
  const invitationRedirectUrl = buildInvitationRedirectUrl(siteUrl)

  // ---- 4. Idempotency lookup ----
  const admin = createAdminClient()
  const auditAuth = buildAuditAuth(admin, operatorUserId)

  const { data: existing, error: existingErr } = await admin
    .from(IDEMPOTENCY_TABLE)
    .select('id, status, request_hash, response, company_id, admin_user_id')
    .eq('operator_user_id', operatorUserId)
    .eq('idempotency_key', idempotencyKey!)
    .maybeSingle()

  if (existingErr) {
    console.error('[provisioning] idempotency lookup failed:', existingErr.code, existingErr.message)
    return NextResponse.json({ error: 'internal error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }

  if (existing) {
    const rec = existing as {
      id: string
      status: string
      request_hash: string
      response: unknown
      company_id: string | null
      admin_user_id: string | null
    }
    // Same key, different payload → 409
    if (rec.request_hash !== requestHash) {
      return NextResponse.json(
        { error: 'Idempotency-Key already used with a different request', code: 'IDEMPOTENCY_CONFLICT' },
        { status: 409 },
      )
    }
    if (rec.status === 'completed') {
      const body = (rec.response ?? { ok: true }) as Record<string, unknown>
      return NextResponse.json({ ...body, replayed: true }, { status: 200 })
    }
    if (rec.status === 'processing') {
      return NextResponse.json(
        { error: 'request is currently in progress', code: 'PROVISIONING_IN_PROGRESS' },
        { status: 409 },
      )
    }
    // failed → 明示的な新しい key を要求 (自動再実行しない)
    return NextResponse.json(
      { error: 'previous request failed; use a new Idempotency-Key', code: 'IDEMPOTENCY_FAILED_LOCKED' },
      { status: 409 },
    )
  }

  // ---- 5. INSERT idempotency record (processing) ----
  const { data: idempRow, error: idempInsertErr } = await admin
    .from(IDEMPOTENCY_TABLE)
    .insert({
      operator_user_id: operatorUserId,
      idempotency_key:  idempotencyKey,
      request_hash:     requestHash,
      status:           'processing',
    } as never)
    .select('id')
    .single()

  if (idempInsertErr || !idempRow) {
    // 競合 (別 request が同時に INSERT) の可能性 → 409 として扱う
    console.error('[provisioning] idempotency insert failed:', idempInsertErr?.code, idempInsertErr?.message)
    return NextResponse.json(
      { error: 'concurrent request detected', code: 'IDEMPOTENCY_CONFLICT' },
      { status: 409 },
    )
  }
  const idempId = (idempRow as { id: string }).id

  // ---- 6. Audit: started ----
  await writePlatformAudit(auditAuth, {
    action:     'company.provisioning.started',
    status:     'started',
    requestId:  idempotencyKey!,
    metadata:   { admin_email_hash: hashEmail(input.adminEmail) },
  })

  // 便利: idempotency status を更新するローカルヘルパー
  const setIdempotencyFailed = async () => {
    await admin
      .from(IDEMPOTENCY_TABLE)
      .update({ status: 'failed', updated_at: new Date().toISOString() } as never)
      .eq('id', idempId)
  }

  // ---- 7. Pre-check: adminEmail が既存 auth user と衝突しないか ----
  // 既存 API (client-accounts / employees) と同様、実行前に軽く確認して失敗を早めに返す。
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listRes = await (admin as any).auth.admin.listUsers({ page: 1, perPage: 1000 })
    const users = (listRes?.data?.users ?? []) as Array<{ email?: string }>
    const collision = users.some(u => (u.email ?? '').toLowerCase() === input.adminEmail)
    if (collision) {
      await setIdempotencyFailed()
      await writePlatformAudit(auditAuth, {
        action:    'company.provisioning.failed',
        status:    'failure',
        requestId: idempotencyKey!,
        metadata:  { reason: 'admin_email_already_exists', admin_email_hash: hashEmail(input.adminEmail) },
      })
      return NextResponse.json(
        { error: 'admin email already registered', code: 'ADMIN_EMAIL_ALREADY_EXISTS' },
        { status: 409 },
      )
    }
  } catch (e) {
    // listUsers 自体が使えない環境は稀。inviteUserByEmail の error で最終的にはハンドリングされる。
    console.error('[provisioning] listUsers pre-check failed:', e instanceof Error ? e.message : 'unknown')
  }

  // ---- 8. Company INSERT ----
  const { data: company, error: companyErr } = await admin
    .from(COMPANIES_TABLE)
    .insert({ name: input.companyName } as never)
    .select('id, name')
    .single()

  if (companyErr || !company) {
    await setIdempotencyFailed()
    await writePlatformAudit(auditAuth, {
      action:    'company.provisioning.failed',
      status:    'failure',
      requestId: idempotencyKey!,
      metadata:  { reason: 'company_insert_failed' },
    })
    return NextResponse.json({ error: 'failed to create company', code: 'INTERNAL_ERROR' }, { status: 500 })
  }

  const companyId = (company as { id: string }).id

  await writePlatformAudit(auditAuth, {
    action:     'company.provisioning.company_created',
    status:     'success',
    targetType: 'company',
    targetId:   companyId,
    requestId:  idempotencyKey!,
  })

  // ---- 9. Invitation ----
  let invitedAuthUserId: string
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inviteRes = await (admin as any).auth.admin.inviteUserByEmail(input.adminEmail, {
      data: { name: input.adminName },   // role / company_id を metadata に入れない
      redirectTo: invitationRedirectUrl,
    })

    if (inviteRes?.error || !inviteRes?.data?.user?.id) {
      // Compensation: company delete
      await deleteCompanySafe(admin, companyId)
      await setIdempotencyFailed()
      await writePlatformAudit(auditAuth, {
        action:    'company.provisioning.admin_invited',
        status:    'failure',
        requestId: idempotencyKey!,
        metadata:  { reason: 'invite_failed' },
      })
      return NextResponse.json({ error: 'failed to send invitation', code: 'INVITATION_FAILED' }, { status: 500 })
    }

    invitedAuthUserId = inviteRes.data.user.id as string
  } catch (e) {
    console.error('[provisioning] invite threw:', e instanceof Error ? e.message : 'unknown')
    await deleteCompanySafe(admin, companyId)
    await setIdempotencyFailed()
    await writePlatformAudit(auditAuth, {
      action:    'company.provisioning.admin_invited',
      status:    'failure',
      requestId: idempotencyKey!,
      metadata:  { reason: 'invite_threw' },
    })
    return NextResponse.json({ error: 'failed to send invitation', code: 'INVITATION_FAILED' }, { status: 500 })
  }

  await writePlatformAudit(auditAuth, {
    action:     'company.provisioning.admin_invited',
    status:     'success',
    targetType: 'auth_user',
    targetId:   invitedAuthUserId,
    requestId:  idempotencyKey!,
    metadata:   { admin_email_hash: hashEmail(input.adminEmail) },
  })

  // ---- 10. Profile link (Server が authority を確定) ----
  const { error: profileUpdateErr } = await admin
    .from(PROFILES_TABLE)
    .update({
      company_id: companyId,
      role:       'admin',
      name:       input.adminName,
    } as never)
    .eq('id', invitedAuthUserId)

  if (profileUpdateErr) {
    // Compensation
    await deleteAuthUserSafe(admin, invitedAuthUserId)
    await deleteCompanySafe(admin, companyId)
    await setIdempotencyFailed()
    await writePlatformAudit(auditAuth, {
      action:    'company.provisioning.profile_linked',
      status:    'failure',
      requestId: idempotencyKey!,
      metadata:  { reason: 'profile_update_failed' },
    })
    return NextResponse.json({ error: 'failed to link profile', code: 'PROFILE_LINK_FAILED' }, { status: 500 })
  }

  // ---- 11. Profile verify ----
  const { data: verifiedProfile, error: verifyErr } = await admin
    .from(PROFILES_TABLE)
    .select('id, role, company_id')
    .eq('id', invitedAuthUserId)
    .single()

  const vp = verifiedProfile as { id?: string; role?: string; company_id?: string | null } | null

  if (
    verifyErr ||
    !vp ||
    vp.id !== invitedAuthUserId ||
    vp.role !== 'admin' ||
    vp.company_id !== companyId
  ) {
    await deleteAuthUserSafe(admin, invitedAuthUserId)
    await deleteCompanySafe(admin, companyId)
    await setIdempotencyFailed()
    await writePlatformAudit(auditAuth, {
      action:    'company.provisioning.profile_linked',
      status:    'failure',
      requestId: idempotencyKey!,
      metadata:  { reason: 'profile_verify_mismatch' },
    })
    return NextResponse.json({ error: 'profile verification failed', code: 'PROFILE_LINK_FAILED' }, { status: 500 })
  }

  await writePlatformAudit(auditAuth, {
    action:     'company.provisioning.profile_linked',
    status:     'success',
    targetType: 'profile',
    targetId:   invitedAuthUserId,
    requestId:  idempotencyKey!,
  })

  // ---- 12. Complete ----
  const responseBody = {
    ok: true,
    company: {
      id:   companyId,
      name: input.companyName,
    },
    admin: {
      id:    invitedAuthUserId,
      name:  input.adminName,
      email: input.adminEmail,
    },
    invitation: {
      sent: true,
    },
  }

  await admin
    .from(IDEMPOTENCY_TABLE)
    .update({
      status:        'completed',
      company_id:    companyId,
      admin_user_id: invitedAuthUserId,
      response:      responseBody,
      updated_at:    new Date().toISOString(),
    } as never)
    .eq('id', idempId)

  await writePlatformAudit(auditAuth, {
    action:     'company.provisioning.completed',
    status:     'success',
    targetType: 'company',
    targetId:   companyId,
    requestId:  idempotencyKey!,
    metadata:   { admin_user_id: invitedAuthUserId },
  })

  return NextResponse.json(responseBody, { status: 201 })
}
