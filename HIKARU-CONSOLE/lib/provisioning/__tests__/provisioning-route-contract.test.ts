// ============================================================
// Platform Companies Route — Contract Tests (P6)
//
// 実 API route は Supabase Auth + Admin API + DB 依存で unit test には重すぎる。
// P3/P4/P5 と同様の source-static pattern で security 契約を保証する:
//
//   - Verified Platform Operator ONLY (hk_c_uid authority禁止)
//   - Idempotency-Key header 必須
//   - client-supplied company_id / role / user_id を認めない
//   - Company作成前に Console URL 検証
//   - Invitation redirectTo は /auth/callback?next=/set-password
//   - Invitation metadata に role/company_id を入れない (Server authority)
//   - profiles.role='admin' + company_id server-set + verify
//   - Compensation: company delete / auth user delete
//   - Audit: platform_audit_logs 使用、password/token/URL を metadata に入れない
//   - Return: token / invite URL / service key 露出しない
// ============================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROUTE_PATH = resolve(__dirname, '../../../app/api/platform/companies/route.ts')
const source     = readFileSync(ROUTE_PATH, 'utf8')

// comment-strip (property access assertions)
const codeOnly = source
  .split('\n')
  .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*'))
  .join('\n')

// ============================================================
// Verified Platform Operator authority
// ============================================================

describe('platform/companies route — verified operator authority', () => {
  it('imports verifyPlatformOperator (Supabase-verified path)', () => {
    expect(source).toMatch(/import\s*{[^}]*verifyPlatformOperator[^}]*}\s*from\s*['"]@\/lib\/auth\/verified-platform-operator['"]/)
  })

  it('calls verifyPlatformOperator', () => {
    expect(source).toMatch(/verifyPlatformOperator\(\)/)
  })

  it('does NOT read hk_c_uid / hk_c_role directly as authority', () => {
    // Route内で cookies.get('hk_c_uid') / hk_c_role の直接 authority 参照禁止
    expect(codeOnly).not.toMatch(/cookies?\(\)\.[a-z]+\(\s*['"]hk_c_uid['"]/)
    expect(codeOnly).not.toMatch(/cookies?\(\)\.[a-z]+\(\s*['"]hk_c_role['"]/)
    expect(codeOnly).not.toMatch(/cookieStore\.get\(\s*['"]hk_c_uid['"]/)
    expect(codeOnly).not.toMatch(/cookieStore\.get\(\s*['"]hk_c_role['"]/)
  })

  it('returns 401 for unauthorized (unauthenticated)', () => {
    expect(source).toMatch(/status:\s*401/)
    expect(source).toMatch(/'UNAUTHORIZED'/)
  })

  it('returns 403 for non-operator (Customer Admin cannot provision)', () => {
    expect(source).toMatch(/status:\s*403/)
    expect(source).toMatch(/'FORBIDDEN'/)
  })

  it('does NOT read profiles.role as authority for Platform Operator', () => {
    // Route内で profiles.role をpre-check的に使わないこと
    // (verifyPlatformOperator が platform_operators 単独判定するため不要)
    // profile UPDATE (link) は role='admin' に固定するが、Platform Operator判定用ではない
    // codeOnly検査:
    expect(codeOnly).not.toMatch(/select\(\s*['"]role['"][^)]*\)[\s\S]*platform_operator/i)
  })
})

// ============================================================
// Input contract
// ============================================================

describe('platform/companies route — input contract', () => {
  it('uses validateProvisioningInput', () => {
    expect(source).toMatch(/validateProvisioningInput/)
  })

  it('does NOT read client-supplied company_id / role / user_id / password', () => {
    // req.json() を経由するが、それを直接 role/company_id 判定に使わない
    // validation.value は NormalizedProvisioningInput 型 (companyName/adminName/adminEmail 3項目のみ)
    expect(codeOnly).not.toMatch(/rawBody\.company_id/)
    expect(codeOnly).not.toMatch(/rawBody\.role/)
    expect(codeOnly).not.toMatch(/rawBody\.user_id/)
    expect(codeOnly).not.toMatch(/rawBody\.password/)
    expect(codeOnly).not.toMatch(/rawBody\.companyId/)
    expect(codeOnly).not.toMatch(/rawBody\.userId/)
    expect(codeOnly).not.toMatch(/rawBody\.auth_user_id/)
    expect(codeOnly).not.toMatch(/rawBody\.status/)
    expect(codeOnly).not.toMatch(/rawBody\.service_role/)
  })
})

// ============================================================
// Idempotency
// ============================================================

describe('platform/companies route — idempotency', () => {
  it('requires Idempotency-Key header', () => {
    expect(source).toMatch(/Idempotency-Key/)
    expect(source).toMatch(/isValidIdempotencyKey/)
    expect(source).toMatch(/'IDEMPOTENCY_KEY_REQUIRED'/)
  })

  it('uses durable table platform_provisioning_idempotency', () => {
    expect(source).toMatch(/['"]platform_provisioning_idempotency['"]/)
  })

  it('detects conflict for same key + different payload (409)', () => {
    expect(source).toMatch(/'IDEMPOTENCY_CONFLICT'/)
    expect(source).toMatch(/request_hash\s*!==\s*requestHash/)
  })

  it('replays completed record (200)', () => {
    expect(source).toMatch(/replayed:\s*true/)
    expect(source).toMatch(/status:\s*200/)
  })

  it('rejects failed record (do not auto-retry)', () => {
    expect(source).toMatch(/'IDEMPOTENCY_FAILED_LOCKED'/)
  })

  it('rejects processing (409)', () => {
    expect(source).toMatch(/'PROVISIONING_IN_PROGRESS'/)
  })

  it('does NOT use in-memory Map / global for idempotency', () => {
    expect(codeOnly).not.toMatch(/new Map\(\)/)
    expect(codeOnly).not.toMatch(/global\.[A-Za-z]+\s*=/)
    // sessionStorage/localStorage は client 側専用で server では使えないが念のため
    expect(codeOnly).not.toMatch(/sessionStorage/)
    expect(codeOnly).not.toMatch(/localStorage/)
  })
})

// ============================================================
// Site URL configuration
// ============================================================

describe('platform/companies route — site url configuration', () => {
  it('uses resolveSiteUrl helper (no hardcoded URL)', () => {
    expect(source).toMatch(/resolveSiteUrl/)
  })

  it('returns 503 CONFIGURATION_MISSING when Console URL is missing', () => {
    expect(source).toMatch(/'CONFIGURATION_MISSING'/)
    expect(source).toMatch(/status:\s*503/)
  })

  it('does NOT hardcode production URL', () => {
    // hardcoded https://console.* / *.vercel.app 禁止
    expect(codeOnly).not.toMatch(/['"]https:\/\/[a-z0-9-]+\.vercel\.app/)
    expect(codeOnly).not.toMatch(/['"]https:\/\/console\.hikaru/)
  })
})

// ============================================================
// Invitation
// ============================================================

describe('platform/companies route — invitation', () => {
  it('uses supabase auth.admin.inviteUserByEmail', () => {
    expect(source).toMatch(/inviteUserByEmail/)
  })

  it('passes redirectTo built from safe helper', () => {
    expect(source).toMatch(/invitationRedirectUrl/)
    expect(source).toMatch(/buildInvitationRedirectUrl/)
    expect(source).toMatch(/redirectTo:\s*invitationRedirectUrl/)
  })

  it('invitation metadata contains only name (no role/company_id)', () => {
    // data: { name: input.adminName } のみ
    expect(source).toMatch(/data:\s*{\s*name:\s*input\.adminName\s*}/)
    // metadata に role / company_id を入れない
    const inviteBlock = source.match(/inviteUserByEmail[\s\S]*?}\)/)?.[0] ?? ''
    expect(inviteBlock).not.toMatch(/role:/)
    expect(inviteBlock).not.toMatch(/company_id:/)
  })

  it('does NOT set Operator-chosen password on First Admin', () => {
    // inviteUserByEmail() call は password を渡さない
    const inviteBlock = source.match(/inviteUserByEmail[\s\S]*?}\)/)?.[0] ?? ''
    expect(inviteBlock).not.toMatch(/password:/)
  })
})

// ============================================================
// Profile link — Server authority
// ============================================================

describe('platform/companies route — profile link (server authority)', () => {
  it('updates profiles with company_id = companyId (server generated)', () => {
    expect(source).toMatch(/company_id:\s*companyId/)
  })

  it('updates profiles.role = "admin" (server literal)', () => {
    expect(source).toMatch(/role:\s*['"]admin['"]/)
  })

  it('verifies profile after update (SELECT again)', () => {
    // profile UPDATE 後の SELECT verify
    const matches = source.match(/from\(\s*PROFILES_TABLE\s*\)/g) ?? source.match(/from\(\s*['"]profiles['"]\s*\)/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(2)
    expect(source).toMatch(/vp\.role\s*!==\s*['"]admin['"]/)
    expect(source).toMatch(/vp\.company_id\s*!==\s*companyId/)
  })
})

// ============================================================
// Compensation
// ============================================================

describe('platform/companies route — compensation (saga)', () => {
  it('has deleteCompanySafe cleanup', () => {
    expect(source).toMatch(/deleteCompanySafe/)
  })

  it('has deleteAuthUserSafe cleanup', () => {
    expect(source).toMatch(/deleteAuthUserSafe/)
  })

  it('cleanup uses auth.admin.deleteUser', () => {
    expect(source).toMatch(/auth\.admin\.deleteUser/)
  })

  it('marks idempotency record failed on any error step', () => {
    expect(source).toMatch(/setIdempotencyFailed/)
    expect(source).toMatch(/status:\s*['"]failed['"]/)
  })
})

// ============================================================
// Audit
// ============================================================

describe('platform/companies route — audit', () => {
  it('imports writePlatformAudit', () => {
    expect(source).toMatch(/import\s*{[^}]*writePlatformAudit[^}]*}\s*from\s*['"]@\/lib\/audit\/platform-audit['"]/)
  })

  it('actor_user_id (audit auth) is Verified Operator, not hk_c_uid', () => {
    // buildAuditAuth passes operatorUserId (from verifyPlatformOperator)
    expect(source).toMatch(/buildAuditAuth\(admin,\s*operatorUserId\)/)
  })

  it('emits started / company_created / admin_invited / profile_linked / completed events', () => {
    expect(source).toMatch(/'company\.provisioning\.started'/)
    expect(source).toMatch(/'company\.provisioning\.company_created'/)
    expect(source).toMatch(/'company\.provisioning\.admin_invited'/)
    expect(source).toMatch(/'company\.provisioning\.profile_linked'/)
    expect(source).toMatch(/'company\.provisioning\.completed'/)
    expect(source).toMatch(/'company\.provisioning\.failed'/)
  })

  it('audit metadata uses hashEmail (not raw email)', () => {
    expect(source).toMatch(/admin_email_hash:\s*hashEmail/)
    // raw email を audit metadata に直接入れないこと
    const auditBlocks = source.match(/writePlatformAudit[\s\S]*?\)/g) ?? []
    for (const b of auditBlocks) {
      // input.adminEmail が metadata: { ... admin_email: ... } のように raw で入っていない
      // (email_hash: hashEmail(...) は許可)
      expect(b).not.toMatch(/admin_email:\s*input\.adminEmail/)
    }
  })
})

// ============================================================
// Response body
// ============================================================

describe('platform/companies route — response', () => {
  it('success returns 201', () => {
    expect(source).toMatch(/status:\s*201/)
  })

  it('does NOT return invitation URL / token / access_token', () => {
    // responseBody 定義部分 (return NextResponse.json でクライアントへ返す) だけをスコープに
    // invitation URL/token/access_token が含まれないことを検証。
    // (route 内部変数として invitationRedirectUrl は Supabase invite の redirectTo に使うため許可)
    const responseBlockMatch = source.match(/const\s+responseBody\s*=\s*({[\s\S]*?})\s*\n\s*await\s+admin/)
    expect(responseBlockMatch).not.toBeNull()
    const responseBlock = responseBlockMatch![1]
    expect(responseBlock).not.toMatch(/invitationRedirectUrl/)
    expect(responseBlock).not.toMatch(/access_token/)
    expect(responseBlock).not.toMatch(/refresh_token/)
    expect(responseBlock).not.toMatch(/redirectTo/)
    // invitation.sent : true のみを含む
    expect(responseBlock).toMatch(/invitation:\s*{\s*sent:\s*true/)
  })

  it('does NOT return service role key', () => {
    expect(codeOnly).not.toMatch(/service_role/)
    expect(codeOnly).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/)
  })
})

// ============================================================
// Duplicate admin email pre-check
// ============================================================

describe('platform/companies route — duplicate admin email', () => {
  it('checks existing auth users before invite', () => {
    expect(source).toMatch(/listUsers/)
    expect(source).toMatch(/'ADMIN_EMAIL_ALREADY_EXISTS'/)
  })
})

// ============================================================
// HTTP method
// ============================================================

describe('platform/companies route — HTTP method', () => {
  it('exports POST handler only (not GET/PUT/DELETE)', () => {
    expect(source).toMatch(/export\s+async\s+function\s+POST\s*\(/)
    expect(source).not.toMatch(/export\s+async\s+function\s+GET\s*\(/)
    expect(source).not.toMatch(/export\s+async\s+function\s+DELETE\s*\(/)
  })
})

// ============================================================
// verified-platform-operator helper contract
// ============================================================

describe('verifyPlatformOperator helper — security contract', () => {
  const helperPath = resolve(__dirname, '../../auth/verified-platform-operator.ts')
  const helperSrc  = readFileSync(helperPath, 'utf8')
  const helperCode = helperSrc
    .split('\n')
    .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*'))
    .join('\n')

  it('uses supabase.auth.getUser (cryptographic verify)', () => {
    expect(helperSrc).toMatch(/supabase\.auth\.getUser\(\)/)
  })

  it('does NOT read hk_c_uid / hk_c_role for authority', () => {
    expect(helperCode).not.toMatch(/hk_c_uid/)
    expect(helperCode).not.toMatch(/hk_c_role/)
  })

  it('does NOT read profiles.role for Platform Operator judgment', () => {
    expect(helperCode).not.toMatch(/from\(\s*['"]profiles['"]/)
  })

  it('queries platform_operators table with verified user.id', () => {
    expect(helperSrc).toMatch(/from\(\s*['"]platform_operators['"]/)
    expect(helperSrc).toMatch(/\.eq\(\s*['"]auth_user_id['"]\s*,\s*verifiedUserId/)
  })

  it('does NOT use user_metadata as authority (comments excluded)', () => {
    expect(helperCode).not.toMatch(/\.user_metadata\b/)
    expect(helperCode).not.toMatch(/\.raw_user_meta_data\b/)
  })
})
