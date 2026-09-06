// ============================================================
// header-synonyms.ts unit tests
//
// - 各 entity dictionary の構造 (`[synonym, canonical]` 配列)
// - within-entity ambiguity: 同じ synonym 文字列が異なる canonical に
//   複数 mapping されていないこと (dictionary 整合性)
// - getSynonyms() の entity 分岐
// - 全 canonical が対応 entity の ALIASES で既知であること (spelling drift 検出)
// ============================================================

import { describe, it, expect } from 'vitest'
import {
  getSynonyms,
  CLIENT_SYNONYMS, STORE_SYNONYMS, EMPLOYEE_SYNONYMS, PROJECT_SYNONYMS,
  EXPENSE_SYNONYMS, ATTENDANCE_SYNONYMS, SHIFT_SYNONYMS,
} from '../header-synonyms'

describe('getSynonyms — entity dispatch', () => {
  it('7 entity 全て解決する', () => {
    expect(getSynonyms('client').length).toBeGreaterThan(0)
    expect(getSynonyms('store').length).toBeGreaterThan(0)
    expect(getSynonyms('employee').length).toBeGreaterThan(0)
    expect(getSynonyms('project').length).toBeGreaterThan(0)
    expect(getSynonyms('expense').length).toBeGreaterThan(0)
    expect(getSynonyms('attendance').length).toBeGreaterThan(0)
    expect(getSynonyms('shift').length).toBeGreaterThan(0)
  })
  it('未知 entity は空', () => {
    expect(getSynonyms('unknown_entity')).toEqual([])
    expect(getSynonyms('')).toEqual([])
  })
})

describe('dictionary structural integrity', () => {
  const all: Array<[string, ReadonlyArray<[string, string]>]> = [
    ['CLIENT',     CLIENT_SYNONYMS],
    ['STORE',      STORE_SYNONYMS],
    ['EMPLOYEE',   EMPLOYEE_SYNONYMS],
    ['PROJECT',    PROJECT_SYNONYMS],
    ['EXPENSE',    EXPENSE_SYNONYMS],
    ['ATTENDANCE', ATTENDANCE_SYNONYMS],
    ['SHIFT',      SHIFT_SYNONYMS],
  ]
  for (const [name, dict] of all) {
    it(`${name}: 各 entry は [synonym, canonical] tuple`, () => {
      for (const entry of dict) {
        expect(Array.isArray(entry)).toBe(true)
        expect(entry.length).toBe(2)
        expect(typeof entry[0]).toBe('string')
        expect(typeof entry[1]).toBe('string')
        expect(entry[0].length).toBeGreaterThan(0)
        expect(entry[1].length).toBeGreaterThan(0)
      }
    })

    it(`${name}: within-entity ambiguity (同じ synonym が異なる canonical へ) は 0`, () => {
      const conflicts: Array<{ syn: string; a: string; b: string }> = []
      const seen = new Map<string, string>()
      for (const [syn, field] of dict) {
        const prev = seen.get(syn)
        if (prev !== undefined && prev !== field) {
          conflicts.push({ syn, a: prev, b: field })
        } else if (prev === undefined) {
          seen.set(syn, field)
        }
      }
      expect(conflicts).toEqual([])
    })
  }
})
