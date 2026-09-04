// ============================================================
// /api/import/sessions/[id]/commit — Route Contract Tests
//
// route.ts は Supabase client / auth に強く依存するため、実挙動 unit test は
// 難しい。ここでは静的 contract を守ることを保証する:
//   - Admin 権限チェック
//   - Session ownership 検証
//   - RPC 呼び出し前の pre-check gate
//   - 認証 context (auth.companyId / auth.userId) を RPC へ渡している
//   - request body から company_id / user_id を受け入れない
//   - RPC 名が正しい
//   - 成功 response が API 契約 shape に沿う
// ============================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROUTE_PATH = resolve(__dirname, '../../../app/api/import/sessions/[id]/commit/route.ts')
const source = readFileSync(ROUTE_PATH, 'utf8')

describe('commit route — auth / admin / ownership', () => {
  it('requires getAuthContext', () => {
    expect(source).toMatch(/import\s*{[^}]*getAuthContext[^}]*}\s*from\s*['"]@\/lib\/supabase\/server-admin['"]/)
    expect(source).toMatch(/const\s+auth\s*=\s*await\s+getAuthContext\s*\(\s*\)/)
  })

  it('returns 401 for unauthenticated', () => {
    expect(source).toMatch(/if\s*\(\s*!\s*auth\s*\)\s*\{[\s\S]*?status:\s*401/)
  })

  it('requires admin role via requireAdmin helper', () => {
    expect(source).toMatch(/requireAdmin\s*\(\s*auth\s*\)/)
    expect(source).toMatch(/status:\s*403/)
  })

  it('verifies session ownership via getOwnedSession', () => {
    expect(source).toMatch(/getOwnedSession\s*\(\s*auth\s*,\s*sessionId\s*\)/)
    expect(source).toMatch(/status:\s*404/)
  })
})

describe('commit route — eligibility gate', () => {
  it('uses evaluateCommitEligibility before RPC call', () => {
    expect(source).toMatch(/import\s*{[^}]*evaluateCommitEligibility[^}]*}\s*from\s*['"]@\/lib\/import\/commit-eligibility['"]/)

    // gate 呼び出しが実際の RPC dispatch (RPC_BY_ENTITY table) より前であることを構造で確認。
    // (route 冒頭の JSDoc comment 内 mention は除く)
    const rpcIdx  = source.search(/const\s+RPC_BY_ENTITY/)
    const gateIdx = source.search(/evaluateCommitEligibility\s*\(/)
    expect(gateIdx).toBeGreaterThan(-1)
    expect(rpcIdx).toBeGreaterThan(-1)
    expect(gateIdx).toBeLessThan(rpcIdx)
  })

  it('returns 409 on gate reject (business rule violation, not auth)', () => {
    expect(source).toMatch(/status:\s*409/)
  })
})

describe('commit route — RPC invocation', () => {
  it('dispatches to entity-specific RPC via RPC_BY_ENTITY map', () => {
    // Entity → RPC name dispatch table を含み、
    // client / store / employee 全て network up 済 RPC 名を参照する。
    expect(source).toMatch(/commit_client_import_session/)
    expect(source).toMatch(/commit_store_import_session/)
    expect(source).toMatch(/commit_employee_import_session/)
    // 実際の rpc() 呼び出しは変数 (rpcName) 経由
    expect(source).toMatch(/rpc[\s\S]{0,60}\(\s*rpcName\s*,/)
  })

  it('passes auth-context companyId to RPC (never from request body)', () => {
    expect(source).toMatch(/p_company_id:\s*auth\.companyId/)
  })

  it('passes auth-context userId to RPC (never from request body)', () => {
    expect(source).toMatch(/p_actor_id:\s*auth\.userId/)
  })

  it('passes sessionId from URL param (never from request body)', () => {
    expect(source).toMatch(/const\s*\{\s*id:\s*sessionId\s*\}\s*=\s*await\s+params/)
    expect(source).toMatch(/p_session_id:\s*sessionId/)
  })

  it('does not read companyId / userId / sessionId from request body', () => {
    // request body 依存の company/user/session 指定が無いこと
    expect(source).not.toMatch(/req\.json\(\)[\s\S]{0,200}company/i)
    expect(source).not.toMatch(/body\.\s*company_?id/)
    expect(source).not.toMatch(/body\.\s*user_?id/)
    expect(source).not.toMatch(/body\.\s*session_?id/)
  })
})

describe('commit route — idempotency', () => {
  it('recognizes commit_already_exists error as 409 ALREADY_COMMITTED', () => {
    expect(source).toMatch(/commit_already_exists/)
    expect(source).toMatch(/ALREADY_COMMITTED/)
  })

  it('recognizes PostgreSQL UNIQUE violation (23505) as commit-exists case', () => {
    expect(source).toMatch(/23505/)
  })
})

describe('commit route — audit + response shape', () => {
  it('writes audit log on commit.applied', () => {
    expect(source).toMatch(/writeAuditLog[\s\S]{0,200}commit\.applied/)
  })

  it('writes audit log on failure (session.failed)', () => {
    expect(source).toMatch(/session\.failed/)
  })

  it('does not leak raw RPC error message to user response', () => {
    // rpcErr.message を直接 response に流していないこと
    expect(source).not.toMatch(/message:\s*rpcErr\.message/)
    expect(source).not.toMatch(/error:\s*rpcErr\.message/)
  })

  it('response includes inserted_count / updated_count / skipped_count', () => {
    expect(source).toMatch(/inserted_count:/)
    expect(source).toMatch(/updated_count:/)
    expect(source).toMatch(/skipped_count:/)
  })

  it('response marks session_status: completed only after successful RPC', () => {
    expect(source).toMatch(/session_status:\s*['"]completed['"]/)
  })
})
