// ============================================================
// Phase U4 route contract tests — static verification
//
// 3 個の新/変更 route:
//   - GET  /api/import/sessions/[id]/sheets                  (new, U4)
//   - POST /api/import/sessions/[id]/extract                 (modified, U4: sheet body)
//   - POST /api/import/sessions/[id]/review/rows/batch       (new, U4)
//
// 検証項目:
//   - Auth pattern (getAuthContext → requireAdmin → getOwnedSession)
//   - Session state guard
//   - company_id scoping
//   - Business tables read-only (bulk endpoint は staging_rows のみ update)
//   - Bulk endpoint の eligibility 判定 (validation_status / duplicate_pending)
//   - Sheet endpoint は download しても業務データを返さない
//   - AI / OpenAI / 外部 fetch / notification 0
// ============================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SHEETS_ROUTE  = resolve(__dirname, '../../../app/api/import/sessions/[id]/sheets/route.ts')
const EXTRACT_ROUTE = resolve(__dirname, '../../../app/api/import/sessions/[id]/extract/route.ts')
const BATCH_ROUTE   = resolve(__dirname, '../../../app/api/import/sessions/[id]/review/rows/batch/route.ts')

const sheetsSrc  = readFileSync(SHEETS_ROUTE,  'utf8')
const extractSrc = readFileSync(EXTRACT_ROUTE, 'utf8')
const batchSrc   = readFileSync(BATCH_ROUTE,   'utf8')

const allRoutes: Array<[string, string]> = [
  ['sheets',  sheetsSrc],
  ['extract', extractSrc],
  ['batch',   batchSrc],
]

// ---- Auth pattern ----

describe('U4 routes — auth pattern', () => {
  for (const [name, src] of allRoutes) {
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

// ---- Session state guard ----

describe('U4 routes — session state guard', () => {
  it('sheets: uploaded 状態必須 (extract 前)', () => {
    expect(sheetsSrc).toMatch(/session\.status\s*!==\s*['"]uploaded['"]/)
    expect(sheetsSrc).toMatch(/status:\s*409/)
  })
  it('extract: uploaded 状態必須 (既存契約維持)', () => {
    expect(extractSrc).toMatch(/session\.status\s*!==\s*['"]uploaded['"]/)
  })
  it('batch: review_required 状態必須', () => {
    expect(batchSrc).toMatch(/session\.status\s*!==\s*['"]review_required['"]/)
    expect(batchSrc).toMatch(/status:\s*409/)
  })
})

// ---- Company_id scoping ----

describe('U4 routes — company_id scoping', () => {
  for (const [name, src] of allRoutes) {
    it(`${name}: .eq('company_id', auth.companyId) を含む`, () => {
      expect(src).toMatch(/\.eq\(\s*['"]company_id['"]\s*,\s*auth\.companyId\s*\)/)
    })
  }
})

// ---- Business tables read-only ----

describe('U4 routes — no business-table writes', () => {
  const businessTables = ['clients', 'stores', 'employees', 'projects', 'expenses', 'attendance_records', 'shifts', 'partners']
  for (const [name, src] of allRoutes) {
    for (const table of businessTables) {
      it(`${name}: .from('${table}') の write 系呼び出し無し`, () => {
        const p = new RegExp(`\\.from\\(\\s*['"]${table}['"]\\s*\\)[\\s\\S]{0,200}\\.(insert|update|upsert|delete)\\s*\\(`)
        expect(src).not.toMatch(p)
      })
    }
  }
})

// ---- Bulk endpoint contract ----

describe('U4 batch route contract', () => {
  it('action は CREATE / SKIP のみ許可', () => {
    expect(batchSrc).toMatch(/\['CREATE',\s*'SKIP'\]/)
    expect(batchSrc).toMatch(/INVALID_ACTION/)
  })
  it('row_ids は非空配列 + UUID 形式 + 上限 500', () => {
    expect(batchSrc).toMatch(/rowIds\.length\s*===\s*0/)
    expect(batchSrc).toMatch(/MAX_BATCH\s*=\s*500/)
    expect(batchSrc).toMatch(/INVALID_ROW_ID/)
    expect(batchSrc).toMatch(/BATCH_TOO_LARGE/)
  })
  it('cross-company / 別 session の row_id は not_found_or_not_owned で reject', () => {
    expect(batchSrc).toMatch(/not_found_or_not_owned/)
    // fetch 時に .eq('session_id') + .eq('company_id') + .in('id', ids)
    expect(batchSrc).toMatch(/\.eq\(\s*['"]session_id['"]\s*,\s*sessionId\s*\)/)
  })
  it('CREATE: validation_status="valid" 必須 (validation_not_valid で reject)', () => {
    expect(batchSrc).toMatch(/validStatus\s*!==\s*['"]valid['"]/)
    expect(batchSrc).toMatch(/validation_not_valid/)
  })
  it('CREATE: pending duplicate 有りは duplicate_unresolved で reject', () => {
    expect(batchSrc).toMatch(/pendingDupSet/)
    expect(batchSrc).toMatch(/duplicate_unresolved/)
  })
  it('SKIP: pending 以外は idempotent skip', () => {
    expect(batchSrc).toMatch(/reviewStatus\s*!==\s*['"]pending['"]/)
  })
  it('update は chunk (100) + session_id + company_id + .in(id, chunk)', () => {
    expect(batchSrc).toMatch(/CHUNK\s*=\s*100/)
    expect(batchSrc).toMatch(/\.in\(\s*['"]id['"]\s*,\s*chunk\s*\)/)
  })
  it("audit 'review.bulk_action' + reason 集計 (PII 除外)", () => {
    expect(batchSrc).toMatch(/writeAuditLog\(auth,\s*sessionId,\s*['"]review\.bulk_action['"]/)
    expect(batchSrc).toMatch(/aggregateReasons/)
  })
})

// ---- Sheets endpoint contract ----

describe('U4 sheets route contract', () => {
  it('CSV session は sheets: [] を即返却', () => {
    // 変数名は sourceType (session.source_type から抽出) or session.source_type どちらでも可
    expect(sheetsSrc).toMatch(/(sourceType|session\.source_type)\s*===\s*['"]csv['"]/)
    expect(sheetsSrc).toMatch(/sheets:\s*\[\]/)
  })
  it('listXlsxSheets を呼ぶ (extract 前に discovery)', () => {
    expect(sheetsSrc).toMatch(/listXlsxSheets\s*\(/)
  })
  it('storage_path は DB record から取得 (browser 由来 path を信用しない)', () => {
    expect(sheetsSrc).toMatch(/\.from\(\s*['"]import_files['"]\s*\)/)
    expect(sheetsSrc).toMatch(/storage_path/)
  })
})

// ---- Extract endpoint: sheet param support ----

describe('U4 extract route — sheet param', () => {
  it('optional body の sheet は string / number のみ受け付ける', () => {
    expect(extractSrc).toMatch(/requestedSheet:\s*string\s*\|\s*number\s*\|\s*undefined/)
    expect(extractSrc).toMatch(/body\?\.\[['"]sheet['"]\]/)
  })
  it('extractFile 呼び出しに sheet 引数を渡す', () => {
    expect(extractSrc).toMatch(/extractFile\s*\(\s*buffer\s*,\s*ext\s*,\s*ext\s*===\s*['"]xlsx['"]\s*\?/)
  })
  it('response に available_sheets を含む (multi-sheet UX 情報)', () => {
    expect(extractSrc).toMatch(/available_sheets:\s*result\.meta\.availableSheets/)
  })
})

// ---- Safety: 0 AI / 0 external fetch ----

describe('U4 routes — 0 AI / 0 external fetch', () => {
  function stripComments(s: string): string {
    return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  }
  for (const [name, src] of allRoutes) {
    it(`${name}: OpenAI / anthropic / gemini の import/call なし`, () => {
      const code = stripComments(src)
      expect(code).not.toMatch(/from\s*['"](openai|@anthropic-ai\/|@google\/generative-ai)/i)
      expect(code).not.toMatch(/new\s+OpenAI\s*\(/)
      expect(code).not.toMatch(/\.chat\.completions\.create\s*\(|\.messages\.create\s*\(/i)
    })
    it(`${name}: 外部 fetch URL なし`, () => {
      expect(stripComments(src)).not.toMatch(/fetch\s*\(\s*['"`]https?:/i)
    })
    it(`${name}: notification / LINE / email API なし`, () => {
      const code = stripComments(src)
      expect(code).not.toMatch(/from\s*['"](@line\/|sendgrid|nodemailer|resend)/i)
      expect(code).not.toMatch(/notification\.push\s*\(|notify\s*\(/i)
    })
    it(`${name}: auth.users / profiles write なし`, () => {
      expect(src).not.toMatch(/auth\.admin\.createUser|\.from\(\s*['"]auth\.users['"]/)
      expect(src).not.toMatch(/\.from\(\s*['"]profiles['"]\s*\)[\s\S]{0,80}\.(insert|update|upsert|delete)/)
    })
  }
})
