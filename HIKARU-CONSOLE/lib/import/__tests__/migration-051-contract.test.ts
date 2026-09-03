// ============================================================
// Migration 051 — Data Integrity Contract Tests
//
// Client Import Commit RPC の重要な不変条件を SQL source 上で保証する。
// 実 RPC の runtime 挙動は Supabase 依存で unit test 困難なため、
// contract-style (regex) で防御する。
//
// カバー範囲:
//   G1. SECURITY DEFINER + search_path 固定
//   G2. service_role only の GRANT
//   G3. Session row lock (FOR UPDATE)
//   G4. 全 DML に company_id predicate (cross-tenant leak 防御)
//   G5. Idempotency (EXISTS check + status transition + UNIQUE constraint 利用)
//   G6. Ambiguous update candidate 拒否 (multiple_update_candidates)
//   G7. UPDATE branch は count = 1 のときのみ (LIMIT 1 の non-determinism 撤廃)
//   G8. CREATE branch は count = 0 のとき (ELSE)
//   G9. destructive SQL (DROP/DELETE/TRUNCATE) が実 SQL に無い
// ============================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const MIGRATION_PATH = resolve(__dirname, '../../../../supabase/migrations/051_import_client_commit.sql')
const source = readFileSync(MIGRATION_PATH, 'utf8')

// Strip SQL comments for keyword scanning (both -- line comments and /* */ block comments).
const sourceNoComments = source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .map(line => line.replace(/--.*$/, ''))
  .join('\n')

describe('migration 051 — G1 function security', () => {
  it('is SECURITY DEFINER', () => {
    expect(source).toMatch(/SECURITY DEFINER/)
  })

  it('pins search_path to public, pg_temp (mutable search_path 攻撃対策)', () => {
    expect(source).toMatch(/SET\s+search_path\s*=\s*public\s*,\s*pg_temp/)
  })
})

describe('migration 051 — G2 grants (service_role only)', () => {
  it('revokes execute from PUBLIC / anon / authenticated', () => {
    expect(source).toMatch(/REVOKE ALL[\s\S]{0,200}FROM PUBLIC/)
    expect(source).toMatch(/REVOKE ALL[\s\S]{0,200}FROM anon/)
    expect(source).toMatch(/REVOKE ALL[\s\S]{0,200}FROM authenticated/)
  })

  it('grants execute only to service_role', () => {
    expect(source).toMatch(/GRANT EXECUTE[\s\S]{0,200}TO service_role/)
  })

  it('does not grant execute to non-service_role principals', () => {
    expect(source).not.toMatch(/GRANT EXECUTE[\s\S]{0,200}TO\s+(anon|authenticated|PUBLIC)/)
  })
})

describe('migration 051 — G3 session lock', () => {
  it('locks session row with FOR UPDATE', () => {
    expect(source).toMatch(/FROM\s+import_sessions[\s\S]{0,200}FOR UPDATE/)
  })

  it('locks target client row with FOR UPDATE on UPDATE branch', () => {
    expect(source).toMatch(/FROM\s+clients[\s\S]{0,200}FOR UPDATE/)
  })
})

describe('migration 051 — G4 cross-tenant defense (all DML has company_id predicate)', () => {
  it('every SELECT/UPDATE against import_* / clients scopes company_id', () => {
    // 全 DML statement を切り出して、それぞれ company_id predicate があるか検証
    // ここでは "company_id" 出現回数が最低限 (=DML の数以上) あることをざっくり確認する
    const companyIdOccurrences = (sourceNoComments.match(/\bcompany_id\b/g) ?? []).length
    // 実装上、company_id は 15+ 箇所に登場する (関数引数 + 各 DML predicate + INSERT VALUES)
    expect(companyIdOccurrences).toBeGreaterThanOrEqual(15)
  })

  it('never issues a SELECT/UPDATE against clients without company_id in the same statement', () => {
    // 各 clients statement を semicolon 境界まで取り、company_id predicate があるか確認
    const clientsStatements = sourceNoComments.match(/\b(SELECT|UPDATE|INSERT INTO)\b[^;]*?\bclients\b[^;]*;/gi) ?? []
    expect(clientsStatements.length).toBeGreaterThan(0)
    for (const stmt of clientsStatements) {
      expect(stmt).toMatch(/company_id/)
    }
  })
})

describe('migration 051 — G5 idempotency', () => {
  it('checks EXISTS on import_commit_records before proceeding', () => {
    expect(source).toMatch(/EXISTS\s*\(\s*SELECT[\s\S]{0,200}import_commit_records/)
    expect(source).toMatch(/commit_already_exists/)
  })

  it('transitions session to committing before writes', () => {
    expect(source).toMatch(/UPDATE\s+import_sessions[\s\S]{0,200}'committing'/)
  })

  it('finalizes session status = completed after commit_records insert', () => {
    const commitInsertIdx  = sourceNoComments.search(/INSERT\s+INTO\s+import_commit_records/)
    const finalStatusIdx   = sourceNoComments.search(/UPDATE\s+import_sessions[\s\S]{0,200}'completed'/)
    expect(commitInsertIdx).toBeGreaterThan(-1)
    expect(finalStatusIdx).toBeGreaterThan(-1)
    expect(finalStatusIdx).toBeGreaterThan(commitInsertIdx)
  })
})

describe('migration 051 — G6 ambiguous update candidate rejection', () => {
  it('counts approved update candidates per staging_row', () => {
    // Count query must scope by staging_row_id + session_id + company_id + review + resolved_action
    expect(sourceNoComments).toMatch(
      /SELECT\s+COUNT\(\*\)[\s\S]{0,600}FROM\s+import_duplicate_candidates[\s\S]{0,600}staging_row_id[\s\S]{0,600}session_id[\s\S]{0,600}company_id[\s\S]{0,600}review_status[\s\S]{0,100}'approved'[\s\S]{0,300}resolved_action[\s\S]{0,60}'update'/,
    )
  })

  it('raises multiple_update_candidates when count > 1', () => {
    expect(source).toMatch(/IF\s+v_update_cand_cnt\s*>\s*1\s+THEN[\s\S]{0,300}RAISE\s+EXCEPTION\s+'multiple_update_candidates/)
  })
})

describe('migration 051 — G7/G8 explicit count-based branching (no LIMIT 1 ambiguity)', () => {
  it('takes UPDATE branch only when count = 1', () => {
    expect(source).toMatch(/IF\s+v_update_cand_cnt\s*=\s*1\s+THEN/)
  })

  it('does not use LIMIT 1 for candidate selection (non-determinism removed)', () => {
    // Any LIMIT 1 against import_duplicate_candidates would be a regression.
    const dupCandStatements = sourceNoComments.match(/import_duplicate_candidates[^;]{0,600}/gi) ?? []
    for (const stmt of dupCandStatements) {
      expect(stmt).not.toMatch(/LIMIT\s+1/i)
    }
  })

  it('CREATE branch (ELSE) enforces name required', () => {
    // ELSE 直下 (CREATE 側) に name 必須 check + INSERT INTO clients があること
    expect(source).toMatch(/ELSE[\s\S]{0,400}v_name IS NULL[\s\S]{0,200}create_missing_name_for_row/)
    expect(source).toMatch(/INSERT INTO clients/)
  })
})

describe('migration 051 — G9 no destructive SQL', () => {
  it('has no DROP TABLE / TRUNCATE / DELETE FROM in executable SQL', () => {
    // Comment を除いた本体に destructive statement が無いこと
    expect(sourceNoComments).not.toMatch(/\bDROP\s+TABLE\b/i)
    expect(sourceNoComments).not.toMatch(/\bTRUNCATE\b/i)
    expect(sourceNoComments).not.toMatch(/\bDELETE\s+FROM\b/i)
    expect(sourceNoComments).not.toMatch(/\bDISABLE\s+ROW\s+LEVEL\s+SECURITY\b/i)
  })
})
