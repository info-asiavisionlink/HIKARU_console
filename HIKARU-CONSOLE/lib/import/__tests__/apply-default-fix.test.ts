// ============================================================
// Fix 2 — apply-default performance & safety tests
//
// 主に静的 contract test (route source を regex + AST-lite で verify)。
// full DB integration は既存 vitest 環境では動かない (adminClient は mock 不可)。
// route contract を静的に verify して、 U3 safety 契約 (empty-only / allowlist /
// company scope) と U4 concurrency 契約 (grouped update + bounded concurrency) を
// 両立していることを保証する。
// ============================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const APPLY_DEFAULT = resolve(
  __dirname,
  '../../../app/api/import/sessions/[id]/review/apply-default/route.ts',
)
const src = readFileSync(APPLY_DEFAULT, 'utf8')

// ---------- U3 safety contract 維持 (Fix 2 で崩さない) ----------

describe('Fix 2 — U3 safety contract 維持', () => {
  it('empty-only 判定: shouldApplyDefault を必ず経由', () => {
    expect(src).toMatch(/shouldApplyDefault\s*\(\s*currentMapped\[field\]\s*\)/)
  })
  it('applyReviewPatch を通す (allowlist + U1 normalizer + validateMappedRow)', () => {
    expect(src).toMatch(/applyReviewPatch\s*\(\s*currentMapped\s*,\s*\{\s*\[field\]:\s*value\s*\}/)
  })
  it('reference field 禁止 (REFERENCE_DEFAULT_FORBIDDEN)', () => {
    expect(src).toMatch(/REFERENCE_DEFAULT_FORBIDDEN/)
    expect(src).toMatch(/meta\.type\s*===\s*['"]reference['"]/)
  })
  it('field allowlist check (FIELD_NOT_EDITABLE)', () => {
    expect(src).toMatch(/FIELD_NOT_EDITABLE/)
    expect(src).toMatch(/getFieldMeta\s*\(/)
  })
  it('review_status は変更しない (column default は review 判定を invalidate しない)', () => {
    // update payload に review_status が含まれていないことを確認
    // (UpdatePayload 型定義には mapped_data / validation_status / validation_errors のみ)
    const payloadTypeMatch = src.match(/interface UpdatePayload\s*\{[\s\S]{0,500}?\}/)
    expect(payloadTypeMatch).toBeTruthy()
    expect(payloadTypeMatch![0]).not.toMatch(/review_status/)
    // update SET にも含まれていない
    const updateSetMatch = src.match(/\.update\s*\(\s*\{[\s\S]{0,500}?updated_at:\s*nowIso[\s\S]{0,100}?\}\s*as\s*never\s*\)/)
    expect(updateSetMatch).toBeTruthy()
    expect(updateSetMatch![0]).not.toMatch(/review_status:/)
  })
})

// ---------- Fix 2 — Performance / concurrency ----------

describe('Fix 2 — grouping + bounded concurrency', () => {
  it('同一 payload の row を group 化 (stableStringify で deterministic key)', () => {
    expect(src).toMatch(/stableStringify\s*\(/)
    expect(src).toMatch(/const groups = new Map<string,\s*\{\s*payload:\s*UpdatePayload;\s*ids:\s*string\[\]\s*\}>/)
  })
  it('IN_CHUNK 上限 (PostgREST URL 長対策)', () => {
    expect(src).toMatch(/const\s+IN_CHUNK\s*=\s*200/)
  })
  it('MAX_PARALLEL 上限 (Supabase rate 対策)', () => {
    expect(src).toMatch(/const\s+MAX_PARALLEL\s*=\s*6/)
  })
  it('タスクは Promise.all で bounded 並列', () => {
    expect(src).toMatch(/Promise\.all\s*\(\s*batch\.map\s*\(\s*runTask\s*\)\s*\)/)
  })
  it('per-row .update() ループが除去されている (旧: for u of batch → 1 UPDATE per row)', () => {
    // 旧 pattern: `for (const u of batch) { await ...update()...eq('id', u.id) }`
    // 新 pattern: `.in('id', t.ids)` (chunk 単位、per-row not per-chunk)
    expect(src).not.toMatch(/for\s*\(\s*const\s+u\s+of\s+batch\s*\)/)
    expect(src).toMatch(/\.in\s*\(\s*['"]id['"]\s*,\s*t\.ids\s*\)/)
  })
})

// ---------- Company / session scope 維持 ----------

describe('Fix 2 — cross-company / cross-session guard', () => {
  it('全 UPDATE に .eq(session_id) + .eq(company_id) + .in(id, ids) の 3 条件', () => {
    // .from('import_staging_rows') の update() 呼び出しを全て抽出
    const updateBlockRe = /\.from\(\s*['"]import_staging_rows['"]\s*\)[\s\S]{0,600}?\.in\(\s*['"]id['"]/g
    const blocks = src.match(updateBlockRe) ?? []
    expect(blocks.length).toBeGreaterThan(0)
    for (const b of blocks) {
      expect(b).toMatch(/\.eq\(\s*['"]session_id['"]\s*,\s*sessionId\s*\)/)
      expect(b).toMatch(/\.eq\(\s*['"]company_id['"]\s*,\s*auth[!.]?.companyId\s*\)/)
    }
  })
  it('mapped_data merge は applyReviewPatch のみで実行 (raw client-supplied merge なし)', () => {
    // client body の value → applyReviewPatch 経由でのみ mapped_data に反映
    // 直接 currentMapped[field] = value のような bypass 無し
    expect(src).not.toMatch(/currentMapped\[field\]\s*=\s*value/)
  })
})

// ---------- Failure semantics ----------

describe('Fix 2 — partial failure reporting', () => {
  it('failed_count を response に含める', () => {
    expect(src).toMatch(/failed_count:\s*failedCount/)
  })
  it('全 failure (applied 0 + failed>0) は 500 で返す', () => {
    expect(src).toMatch(/failedCount\s*>\s*0\s*&&\s*appliedCount\s*===\s*0/)
    expect(src).toMatch(/status:\s*500/)
  })
  it('partial success (applied>0 + failed>0) は success:true で counts を返す', () => {
    // 200 応答経路で failed_count を含める
    const successBlock = src.match(/return NextResponse\.json\(\{\s*success:\s*true[\s\S]{0,600}?\}\s*\)/)
    expect(successBlock).toBeTruthy()
    expect(successBlock![0]).toMatch(/failed_count/)
  })
  it('audit に failures sample を含めるが最大 5 件 (PII 無し)', () => {
    expect(src).toMatch(/failures\.slice\(0,\s*5\)/)
    // sample は ids_sample (先頭 3 UUID) + error code のみ、値なし
    expect(src).toMatch(/ids_sample:\s*t\.ids\.slice\(0,\s*3\)/)
    expect(src).toMatch(/error:\s*updateErr\.code/)
  })
})

// ---------- Safety: 0 AI / 0 external fetch (post-Fix 2) ----------

describe('Fix 2 — no AI / no external fetch', () => {
  function stripComments(s: string): string {
    return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  }
  it('OpenAI / anthropic / gemini の import/call なし', () => {
    const code = stripComments(src)
    expect(code).not.toMatch(/from\s*['"](openai|@anthropic-ai\/|@google\/generative-ai)/i)
    expect(code).not.toMatch(/new\s+OpenAI\s*\(/)
  })
  it('外部 fetch URL なし', () => {
    expect(stripComments(src)).not.toMatch(/fetch\s*\(\s*['"`]https?:/i)
  })
})

// ---------- stableStringify unit ----------

describe('Fix 2 — stableStringify (Grouping key builder)', () => {
  // stableStringify を route から re-import できないため、同じロジックを local に持って
  // 挙動 sanity check する (実装 sync するのが目的、drift 検出用)
  function stableStringify(v: unknown): string {
    if (v === null || typeof v !== 'object') return JSON.stringify(v)
    if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']'
    const keys = Object.keys(v as Record<string, unknown>).sort()
    const parts = keys.map(k => JSON.stringify(k) + ':' + stableStringify((v as Record<string, unknown>)[k]))
    return '{' + parts.join(',') + '}'
  }
  it('key 順が違っても同じ string を返す (grouping stable)', () => {
    const a = { b: 1, a: 2 }
    const b = { a: 2, b: 1 }
    expect(stableStringify(a)).toBe(stableStringify(b))
    expect(stableStringify(a)).toBe('{"a":2,"b":1}')
  })
  it('nested object も再帰的に sort', () => {
    const a = { outer: { z: 1, a: 2 } }
    expect(stableStringify(a)).toBe('{"outer":{"a":2,"z":1}}')
  })
  it('null / primitive はそのまま JSON', () => {
    expect(stableStringify(null)).toBe('null')
    expect(stableStringify('x')).toBe('"x"')
    expect(stableStringify(42)).toBe('42')
  })
  it('array は order 保持', () => {
    expect(stableStringify([3, 1, 2])).toBe('[3,1,2]')
  })
})
