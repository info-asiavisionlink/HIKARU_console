// ============================================================
// Migration 055 — ENUM<>TEXT operator fix Contract Tests
//
// Root cause of Employee (and Store) commit failure (2026-09):
//   Production Postgres: `42883 operator does not exist: import_entity_type <> text`
//   at Migration 052 _import_commit_pre_check line 49:
//     IF v_session.entity_type <> p_entity_type THEN
//   LHS = ENUM public.import_entity_type, RHS = TEXT parameter → operator absent.
//
// Migration 055 fixes this via CREATE OR REPLACE with same signature:
//   IF v_session.entity_type::TEXT <> p_entity_type THEN
//
// This suite is a STATIC contract test to guarantee:
//   - 055 exists as a NEW migration file
//   - 055 replaces the broken comparison
//   - 055 preserves security model (DEFINER, search_path, grants)
//   - 055 preserves function signature (UUID, UUID, TEXT) → no overload
//   - 049〜054 file SHA256 hashes are frozen (Migration files are immutable
//     once applied to Production; regression prevention)
// ============================================================

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'

const MIG_DIR = resolve(__dirname, '../../../../supabase/migrations')

function readMig(name: string): string {
  const p = resolve(MIG_DIR, name)
  return readFileSync(p, 'utf8')
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

// ---- Frozen SHA256 of Production-applied migrations (049-054) ----
// これらは Production に適用済み。file 差分 = incident。
const FROZEN_HASHES: Record<string, string> = {
  '049_secure_import_foundation.sql':        'd1a16e0d9308f41dbb0bd8264b7de2bc6e7a4deab45bc3c69db3a5ad99a6c32d',
  '050_import_match_reasons.sql':            'cd8c47cf848cdbcad003280f4ba54c756a8254cebae6fa57ec8d5e339f82684b',
  '051_import_client_commit.sql':            '56d46f6aeb75c5f8a28a8dd9d4789b41cb06043605bb0fdcf2b95c84f9a0624b',
  '052_import_commit_common_helper.sql':     'b4b09abb71aaa375bd271d8c103aed02ab0ea98d49345b9023ca474e43c530f2',
  '053_import_store_commit.sql':             '909dbc54a816d1694358c184f755702683882070eb0319df516b87df870e47a1',
  '054_import_employee_commit.sql':          '859343a15fe6c24b3fb0d916c5c783756ff1152a307a742f6a2138ca14f805e4',
}

describe('Migration 049〜054 frozen (Production-applied, never mutate)', () => {
  for (const [name, expected] of Object.entries(FROZEN_HASHES)) {
    it(`${name} SHA256 unchanged`, () => {
      const actual = sha256(readMig(name))
      expect(actual).toBe(expected)
    })
  }
})

describe('Migration 055 file exists and structure', () => {
  const M055_NAME = '055_fix_import_commit_entity_type_comparison.sql'
  const m055Path = resolve(MIG_DIR, M055_NAME)

  it('055 file exists as new migration', () => {
    expect(existsSync(m055Path)).toBe(true)
  })

  const source = existsSync(m055Path) ? readMig(M055_NAME) : ''

  it('055 only replaces _import_commit_pre_check (no other functions touched)', () => {
    // CREATE OR REPLACE FUNCTION は _import_commit_pre_check の 1 個のみ。
    const matches = source.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.([a-zA-Z_]+)/g) ?? []
    expect(matches.length).toBe(1)
    expect(source).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\._import_commit_pre_check/)
  })

  it('055 preserves same function signature (UUID, UUID, TEXT) — no overload risk', () => {
    // signature 変更は別 function 生成につながるため厳格 assert。
    expect(source).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\._import_commit_pre_check\s*\(\s*p_session_id\s+UUID\s*,\s*p_company_id\s+UUID\s*,\s*p_entity_type\s+TEXT\s*\)/,
    )
  })

  it('055 uses ENUM->TEXT cast in entity_type comparison (fix core)', () => {
    // 修正の核。v_session.entity_type::TEXT <> p_entity_type
    expect(source).toMatch(
      /v_session\.entity_type::TEXT\s*<>\s*p_entity_type/,
    )
  })

  it('055 does NOT retain broken ENUM<>TEXT comparison (executable SQL only, comments excluded)', () => {
    // Documentation comments 内には元の broken form を意図的に残しているため
    // SQL line comment (`--` 以降) を除外してから executable SQL 部分を assert。
    const executable = source
      .split(/\r?\n/)
      .map(line => line.replace(/--.*$/, ''))
      .join('\n')
    expect(executable).not.toMatch(
      /v_session\.entity_type\s*<>\s*p_entity_type\b/,
    )
  })

  it('055 preserves SECURITY DEFINER', () => {
    expect(source).toMatch(/SECURITY\s+DEFINER/)
  })

  it('055 preserves SET search_path = public, pg_temp', () => {
    expect(source).toMatch(/SET\s+search_path\s*=\s*public\s*,\s*pg_temp/)
  })

  it('055 preserves session lock (FOR UPDATE) and ownership checks', () => {
    expect(source).toMatch(/FROM\s+import_sessions[\s\S]{0,200}FOR\s+UPDATE/)
    expect(source).toMatch(/WHERE\s+id\s*=\s*p_session_id\s+AND\s+company_id\s*=\s*p_company_id/)
  })

  it('055 preserves all 5 eligibility gates (session, status, idempotency, pending rows, pending cands, invalid approved)', () => {
    expect(source).toMatch(/session_not_found/)
    expect(source).toMatch(/entity_type_mismatch/)
    expect(source).toMatch(/invalid_session_status/)
    expect(source).toMatch(/commit_already_exists/)
    expect(source).toMatch(/pending_rows_remain/)
    expect(source).toMatch(/pending_candidates_remain/)
    expect(source).toMatch(/invalid_row_approved/)
  })

  it('055 preserves transition to committing status', () => {
    expect(source).toMatch(/UPDATE\s+import_sessions[\s\S]{0,120}SET\s+status\s*=\s*['"]committing['"]/)
  })

  it('055 re-issues grants (service_role only, revoke public/anon/authenticated)', () => {
    expect(source).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\._import_commit_pre_check\s*\(\s*UUID\s*,\s*UUID\s*,\s*TEXT\s*\)\s+FROM\s+PUBLIC/)
    expect(source).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\._import_commit_pre_check\s*\(\s*UUID\s*,\s*UUID\s*,\s*TEXT\s*\)\s+FROM\s+anon/)
    expect(source).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\._import_commit_pre_check\s*\(\s*UUID\s*,\s*UUID\s*,\s*TEXT\s*\)\s+FROM\s+authenticated/)
    expect(source).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\._import_commit_pre_check\s*\(\s*UUID\s*,\s*UUID\s*,\s*TEXT\s*\)\s+TO\s+service_role/)
  })

  it('055 does NOT touch _import_commit_resolve_update_candidate / finalize / count_skipped', () => {
    // 052 の他 helper には影響させない (root cause は pre_check の 1 箇所のみ)。
    expect(source).not.toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\._import_commit_resolve_update_candidate/)
    expect(source).not.toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\._import_commit_finalize/)
    expect(source).not.toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\._import_commit_count_skipped/)
  })

  it('055 does NOT touch entity commit RPCs (client/store/employee)', () => {
    // 各 entity RPC (051/053/054) には影響させない。
    expect(source).not.toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.commit_client_import_session/)
    expect(source).not.toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.commit_store_import_session/)
    expect(source).not.toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.commit_employee_import_session/)
  })

  it('055 does NOT alter DB schema / RLS / table structure', () => {
    // Migration 055 は関数の CREATE OR REPLACE のみ。他 DDL は禁止。
    expect(source).not.toMatch(/CREATE\s+TABLE/)
    expect(source).not.toMatch(/ALTER\s+TABLE/)
    expect(source).not.toMatch(/DROP\s+TABLE/)
    expect(source).not.toMatch(/CREATE\s+POLICY/)
    expect(source).not.toMatch(/ALTER\s+POLICY/)
    expect(source).not.toMatch(/DROP\s+POLICY/)
    expect(source).not.toMatch(/CREATE\s+TYPE/)
    expect(source).not.toMatch(/ALTER\s+TYPE/)
    expect(source).not.toMatch(/DROP\s+TYPE/)
  })
})

describe('Migration 053 / 054 callers still pass string literal (unchanged contract)', () => {
  it('053 store caller passes TEXT literal `\'store\'` unchanged', () => {
    const s053 = readMig('053_import_store_commit.sql')
    expect(s053).toMatch(
      /PERFORM\s+public\._import_commit_pre_check\s*\(\s*p_session_id\s*,\s*p_company_id\s*,\s*'store'\s*\)/,
    )
  })

  it('054 employee caller passes TEXT literal `\'employee\'` unchanged', () => {
    const s054 = readMig('054_import_employee_commit.sql')
    expect(s054).toMatch(
      /PERFORM\s+public\._import_commit_pre_check\s*\(\s*p_session_id\s*,\s*p_company_id\s*,\s*'employee'\s*\)/,
    )
  })
})

describe('Migration 049 ENUM definition (source of truth)', () => {
  it('import_entity_type ENUM contains client / store / employee', () => {
    const s049 = readMig('049_secure_import_foundation.sql')
    expect(s049).toMatch(
      /CREATE\s+TYPE\s+public\.import_entity_type\s+AS\s+ENUM[\s\S]{0,300}'client'[\s\S]{0,300}'store'[\s\S]{0,300}'employee'/,
    )
  })

  it('import_sessions.entity_type column is public.import_entity_type ENUM', () => {
    const s049 = readMig('049_secure_import_foundation.sql')
    expect(s049).toMatch(
      /entity_type\s+public\.import_entity_type\s+NOT\s+NULL/,
    )
  })
})
