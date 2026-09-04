// ============================================================
// fk-resolver — Import FK Resolution Tests
//
// 契約:
//   - company_id scope: 呼び出し側で pre-load される (this module 内で DB query 無し)
//   - code 優先、name 次点
//   - AMBIGUOUS (複数一致) は auto-pick せず候補 ID 一覧を返す
//   - fuzzy match 禁止 (normalize 後の exact match のみ)
// ============================================================

import { describe, it, expect } from 'vitest'
import { buildFkIndex, resolveFk } from '../fk-resolver'

interface Sample {
  id:   string
  code: string | null
  name: string | null
}

const sample: Sample[] = [
  { id: 'c-1', code: 'ACME',   name: 'Acme株式会社' },
  { id: 'c-2', code: 'GLOBE',  name: 'Globe合同会社' },
  { id: 'c-3', code: null,     name: '重複名テスト' },
  { id: 'c-4', code: null,     name: '重複名テスト' },   // duplicate name (different id)
  { id: 'c-5', code: 'ACME-2', name: null },
]

describe('buildFkIndex', () => {
  it('builds byCode and byName lookups (case-insensitive after normalize)', () => {
    const idx = buildFkIndex(sample)
    expect(idx.byCode.get('acme')).toHaveLength(1)
    expect(idx.byCode.get('globe')).toHaveLength(1)
    expect(idx.byCode.get('acme-2')).toHaveLength(1)
    expect(idx.byName.get('acme株式会社')).toHaveLength(1)
    expect(idx.byName.get('重複名テスト')).toHaveLength(2) // duplicate
  })

  it('skips null / empty code/name', () => {
    const idx = buildFkIndex([{ id: 'x', code: null, name: null }])
    expect(idx.byCode.size).toBe(0)
    expect(idx.byName.size).toBe(0)
  })
})

describe('resolveFk — code priority', () => {
  const idx = buildFkIndex(sample)

  it('resolves by code (case-insensitive)', () => {
    expect(resolveFk(idx, { code: 'ACME' })).toEqual({ status: 'resolved', id: 'c-1', candidates: ['c-1'] })
    expect(resolveFk(idx, { code: 'acme' })).toEqual({ status: 'resolved', id: 'c-1', candidates: ['c-1'] })
    expect(resolveFk(idx, { code: '  ACME  ' })).toEqual({ status: 'resolved', id: 'c-1', candidates: ['c-1'] })
  })

  it('code given but not found → NOT_FOUND (does NOT fall back to name)', () => {
    // 「明示 code を指定した」= その code の record を指定意図。name fallback は誤 resolve になる。
    expect(resolveFk(idx, { code: 'NONEXISTENT', name: 'Acme株式会社' }))
      .toEqual({ status: 'not_found', id: null, candidates: [] })
  })
})

describe('resolveFk — name fallback (only when code absent)', () => {
  const idx = buildFkIndex(sample)

  it('resolves by name if code not given', () => {
    expect(resolveFk(idx, { name: 'Acme株式会社' })).toEqual({ status: 'resolved', id: 'c-1', candidates: ['c-1'] })
  })

  it('returns AMBIGUOUS when name matches multiple records', () => {
    const result = resolveFk(idx, { name: '重複名テスト' })
    expect(result.status).toBe('ambiguous')
    expect(result.id).toBeNull()
    expect(result.candidates.sort()).toEqual(['c-3', 'c-4'])
  })

  it('returns NOT_FOUND when name matches nothing', () => {
    expect(resolveFk(idx, { name: 'Unknown' })).toEqual({ status: 'not_found', id: null, candidates: [] })
  })
})

describe('resolveFk — inputs', () => {
  const idx = buildFkIndex(sample)

  it('both null → NOT_FOUND', () => {
    expect(resolveFk(idx, {})).toEqual({ status: 'not_found', id: null, candidates: [] })
    expect(resolveFk(idx, { code: null, name: null })).toEqual({ status: 'not_found', id: null, candidates: [] })
    expect(resolveFk(idx, { code: '', name: '' })).toEqual({ status: 'not_found', id: null, candidates: [] })
  })
})

describe('resolveFk — no cross-company leak (contract)', () => {
  it('resolver only knows what pre-loaded index contains (no DB access)', () => {
    // pre-loaded 配列に含まれない ID は絶対に返らない = cross-company 防止は呼び出し側責任
    const idx = buildFkIndex(sample)
    // 他社の client_code 'FOREIGN' を照会 → NOT_FOUND
    expect(resolveFk(idx, { code: 'FOREIGN' })).toEqual({ status: 'not_found', id: null, candidates: [] })
  })
})
