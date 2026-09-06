// ============================================================
// Review edit routes — static contract tests (Phase U3)
//
// 3 個の新 route (fields PATCH / fk-candidates GET / apply-default POST) が:
//   - Auth pattern (getAuthContext → requireAdmin → getOwnedSession)
//   - Session state guard (review_required)
//   - Row / candidate ownership: .eq('company_id', auth.companyId)
//   - Business tables への write を含まない
//   - PATCH_FORBIDDEN_KEYS / EDITABLE_FIELDS の allowlist を経由する
//   - AI / OpenAI / fetch (外部) を呼ばない
// を守っていることを regex ベースで verify する。
//
// (実サーバ起動なしで契約破壊を CI で検出するため、
//  既存 review-page-contract.test.ts / commit-route-contract.test.ts と同型)
// ============================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const FIELDS_ROUTE     = resolve(__dirname, '../../../app/api/import/sessions/[id]/review/[rowId]/fields/route.ts')
const FK_ROUTE         = resolve(__dirname, '../../../app/api/import/sessions/[id]/fk-candidates/route.ts')
const APPLY_DEFAULT    = resolve(__dirname, '../../../app/api/import/sessions/[id]/review/apply-default/route.ts')

const fieldsSrc  = readFileSync(FIELDS_ROUTE,  'utf8')
const fkSrc      = readFileSync(FK_ROUTE,      'utf8')
const applySrc   = readFileSync(APPLY_DEFAULT, 'utf8')

const allRouteSrcs: Array<[string, string]> = [
  ['fields',        fieldsSrc],
  ['fk-candidates', fkSrc],
  ['apply-default', applySrc],
]

// ---- Auth pattern ----

describe('U3 routes — auth pattern', () => {
  for (const [name, src] of allRouteSrcs) {
    it(`${name}: getAuthContext + requireAdmin + getOwnedSession を経由`, () => {
      expect(src).toMatch(/getAuthContext\s*\(\s*\)/)
      expect(src).toMatch(/requireAdmin\s*\(\s*auth\s*\)/)
      expect(src).toMatch(/getOwnedSession\s*\(\s*auth\s*,\s*sessionId\s*\)/)
    })
    it(`${name}: 401 / 403 / 404 ハンドリング`, () => {
      expect(src).toMatch(/status:\s*401/)
      expect(src).toMatch(/status:\s*403/)
      expect(src).toMatch(/status:\s*404/)
    })
  }
})

describe('U3 routes — session state guard (fields / apply-default)', () => {
  it("fields: session.status !== 'review_required' で 409", () => {
    expect(fieldsSrc).toMatch(/session\.status\s*!==\s*['"]review_required['"]/)
    expect(fieldsSrc).toMatch(/status:\s*409/)
  })
  it("apply-default: session.status !== 'review_required' で 409", () => {
    expect(applySrc).toMatch(/session\.status\s*!==\s*['"]review_required['"]/)
    expect(applySrc).toMatch(/status:\s*409/)
  })
})

// ---- Company_id enforcement ----

describe('U3 routes — company_id scoping', () => {
  for (const [name, src] of allRouteSrcs) {
    it(`${name}: .eq('company_id', auth.companyId) を含む`, () => {
      expect(src).toMatch(/\.eq\(\s*['"]company_id['"]\s*,\s*auth\.companyId\s*\)/)
    })
  }
})

// ---- Business tables read-only ----

describe('U3 routes — no business-table writes', () => {
  const businessTables = ['clients', 'stores', 'employees', 'projects', 'expenses', 'attendance_records', 'shifts', 'partners']
  for (const [name, src] of allRouteSrcs) {
    for (const table of businessTables) {
      it(`${name}: .from('${table}') の insert/update/upsert が無い`, () => {
        // 業務 table への write 系呼び出しが無いことを検証。
        const patterns = [
          new RegExp(`\\.from\\(\\s*['"]${table}['"]\\s*\\)[\\s\\S]{0,200}\\.(insert|update|upsert|delete)\\s*\\(`),
        ]
        for (const p of patterns) expect(src).not.toMatch(p)
      })
    }
  }
})

// ---- Allowlist / normalization / audit ----

describe('U3 fields route — allowlist + normalize + validate + audit', () => {
  it('applyReviewPatch (server-side allowlist + normalize + validate) を呼ぶ', () => {
    expect(fieldsSrc).toMatch(/applyReviewPatch\s*\(/)
  })
  it('getFieldMeta で reference type を server 側で再検証する', () => {
    expect(fieldsSrc).toMatch(/getFieldMeta\s*\(/)
  })
  it('FK candidate ownership: .eq(id) + .eq(company_id) の 2 条件確認', () => {
    // reference field UUID の cross-company チェック
    expect(fieldsSrc).toMatch(/\.eq\(\s*['"]id['"]\s*,\s*chk\.uuid\s*\)/)
    expect(fieldsSrc).toMatch(/FK_CANDIDATE_NOT_OWNED/)
  })
  it('rejected patch あれば 400 で fail-loud (silent drop 禁止)', () => {
    expect(fieldsSrc).toMatch(/PATCH_FIELD_REJECTED/)
    expect(fieldsSrc).toMatch(/rejected\.length\s*>\s*0/)
  })
  it('duplicate stale で review_status を pending にリセットする', () => {
    expect(fieldsSrc).toMatch(/review_status:\s*['"]pending['"]/)
  })
  it("audit log で 'review.field_edited' を non-blocking で記録", () => {
    expect(fieldsSrc).toMatch(/writeAuditLog\(auth,\s*sessionId,\s*['"]review\.field_edited['"]/)
  })
  it('audit 内容は field name のみ (PII 除外) — fields_updated: Object.keys', () => {
    expect(fieldsSrc).toMatch(/fields_updated:\s*Object\.keys\s*\(\s*result\.acceptedPatch\s*\)/)
  })
})

// ---- fk-candidates route ----

describe('U3 fk-candidates route', () => {
  it('type param を 5 種類 (client/store/employee/project/partner) に制限', () => {
    expect(fkSrc).toMatch(/\['client',\s*'store',\s*'employee',\s*'project',\s*'partner'\]/)
    expect(fkSrc).toMatch(/INVALID_TYPE/)
  })
  it("q param は or ilike で 部分一致 (name / code)", () => {
    expect(fkSrc).toMatch(/name\.ilike/)
    expect(fkSrc).toMatch(/code\.ilike/)
  })
  it('limit は 200 で上限クランプ', () => {
    // Math.min(Math.max(1, parseInt(...) || 50), 200) — 空白差異を吸収
    expect(fkSrc).toMatch(/Math\.min\s*\(\s*Math\.max\s*\(\s*1\s*,[\s\S]{0,200}\)\s*,\s*200\s*\)/)
  })
  it('employee 候補は auth_user_id 存在フラグを sub に含める', () => {
    expect(fkSrc).toMatch(/auth 済み/)
    expect(fkSrc).toMatch(/未招待/)
  })
})

// ---- apply-default route ----

describe('U3 apply-default route', () => {
  it('empty-only モード (既存値上書き禁止) を shouldApplyDefault で判定', () => {
    expect(applySrc).toMatch(/shouldApplyDefault\s*\(/)
  })
  it('reference field は column default 禁止 (REFERENCE_DEFAULT_FORBIDDEN)', () => {
    expect(applySrc).toMatch(/REFERENCE_DEFAULT_FORBIDDEN/)
    expect(applySrc).toMatch(/meta\.type\s*===\s*['"]reference['"]/)
  })
  it('field が EDITABLE_FIELDS 外なら FIELD_NOT_EDITABLE (400)', () => {
    expect(applySrc).toMatch(/FIELD_NOT_EDITABLE/)
  })
  it("audit 'review.column_default_applied' + mode='empty_only'", () => {
    expect(applySrc).toMatch(/writeAuditLog\(auth,\s*sessionId,\s*['"]review\.column_default_applied['"]/)
    expect(applySrc).toMatch(/mode:\s*['"]empty_only['"]/)
  })
})

// ---- Safety: no AI / no external fetch / no notification ----

describe('U3 routes — 0 AI / 0 external fetch / 0 notification', () => {
  // NOTE: 判定は「実行可能な call/import 表現」のみを対象にし、コメント (`//` や `/*`)
  // 内の言及 (documentation で "OpenAI calls: 0" と書く等) は許容する。
  function stripComments(s: string): string {
    return s
      .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1') // line comments (URL は残す)
  }

  for (const [name, src] of allRouteSrcs) {
    it(`${name}: OpenAI / anthropic / gemini の import / call 呼び出しなし`, () => {
      const code = stripComments(src)
      // 呼び出し/import 表現に絞る。"OpenAI calls: 0" 等のコメント文言は除外済。
      expect(code).not.toMatch(/from\s*['"](openai|@anthropic-ai\/|@google\/generative-ai)/i)
      expect(code).not.toMatch(/new\s+OpenAI\s*\(/)
      expect(code).not.toMatch(/\.chat\.completions\.create\s*\(|\.messages\.create\s*\(/i)
    })
    it(`${name}: 外部 fetch (URL) なし`, () => {
      const code = stripComments(src)
      expect(code).not.toMatch(/fetch\s*\(\s*['"`]https?:/i)
    })
    it(`${name}: notification / LINE / email API 呼び出しなし`, () => {
      const code = stripComments(src)
      expect(code).not.toMatch(/from\s*['"](@line\/|sendgrid|nodemailer|resend)/i)
      expect(code).not.toMatch(/notification\.push\s*\(|notify\s*\(/i)
    })
    it(`${name}: auth.users / profiles への write なし`, () => {
      expect(src).not.toMatch(/auth\.admin\.createUser|\.from\(\s*['"]auth\.users['"]/)
      expect(src).not.toMatch(/\.from\(\s*['"]profiles['"]\s*\)[\s\S]{0,80}\.(insert|update|upsert|delete)/)
    })
  }
})
