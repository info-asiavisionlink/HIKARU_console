import { describe, it, expect } from 'vitest'
import { normalizeBoolean } from '../../normalizers/boolean-normalizer'

describe('normalizeBoolean — TRUE', () => {
  it('英字 true 系', () => {
    for (const v of ['true', 'TRUE', 'True', 't', 'T']) {
      expect(normalizeBoolean(v)).toEqual({ ok: true, value: 'true' })
    }
  })

  it('yes 系', () => {
    for (const v of ['yes', 'YES', 'Yes', 'y', 'Y']) {
      expect(normalizeBoolean(v)).toEqual({ ok: true, value: 'true' })
    }
  })

  it('日本語 (はい / 有 / あり)', () => {
    for (const v of ['はい', 'ハイ', '有', 'あり', 'アリ']) {
      expect(normalizeBoolean(v)).toEqual({ ok: true, value: 'true' })
    }
  })

  it('記号 (○/◯/⭕)', () => {
    expect(normalizeBoolean('○')).toEqual({ ok: true, value: 'true' })
    expect(normalizeBoolean('◯')).toEqual({ ok: true, value: 'true' })
    expect(normalizeBoolean('⭕')).toEqual({ ok: true, value: 'true' })
  })

  it('数値 1', () => {
    expect(normalizeBoolean('1')).toEqual({ ok: true, value: 'true' })
    expect(normalizeBoolean(1)).toEqual({ ok: true, value: 'true' })
  })

  it('native boolean true', () => {
    expect(normalizeBoolean(true)).toEqual({ ok: true, value: 'true' })
  })
})

describe('normalizeBoolean — FALSE', () => {
  it('英字 false 系', () => {
    for (const v of ['false', 'FALSE', 'False', 'f', 'F']) {
      expect(normalizeBoolean(v)).toEqual({ ok: true, value: 'false' })
    }
  })

  it('no 系', () => {
    for (const v of ['no', 'NO', 'No', 'n', 'N']) {
      expect(normalizeBoolean(v)).toEqual({ ok: true, value: 'false' })
    }
  })

  it('日本語 (いいえ / 無 / なし)', () => {
    for (const v of ['いいえ', 'イイエ', '無', 'なし', 'ナシ']) {
      expect(normalizeBoolean(v)).toEqual({ ok: true, value: 'false' })
    }
  })

  it('記号 (× / ✕ / ✖ / ✗)', () => {
    expect(normalizeBoolean('×')).toEqual({ ok: true, value: 'false' })
    expect(normalizeBoolean('✕')).toEqual({ ok: true, value: 'false' })
    expect(normalizeBoolean('✖')).toEqual({ ok: true, value: 'false' })
    expect(normalizeBoolean('✗')).toEqual({ ok: true, value: 'false' })
  })

  it('数値 0', () => {
    expect(normalizeBoolean('0')).toEqual({ ok: true, value: 'false' })
    expect(normalizeBoolean(0)).toEqual({ ok: true, value: 'false' })
  })

  it('native boolean false', () => {
    expect(normalizeBoolean(false)).toEqual({ ok: true, value: 'false' })
  })
})

describe('normalizeBoolean — trim / NFKC', () => {
  it('trim 前後空白', () => {
    expect(normalizeBoolean('  true  ')).toEqual({ ok: true, value: 'true' })
    expect(normalizeBoolean('　はい　')).toEqual({ ok: true, value: 'true' })
  })

  it('全角英数字 → 半角 (NFKC)', () => {
    expect(normalizeBoolean('ｔｒｕｅ')).toEqual({ ok: true, value: 'true' })
    expect(normalizeBoolean('１')).toEqual({ ok: true, value: 'true' })
    expect(normalizeBoolean('０')).toEqual({ ok: true, value: 'false' })
  })
})

describe('normalizeBoolean — reject unknown (勝手に false にしない)', () => {
  it('曖昧値', () => {
    for (const v of ['-', '未定', '不明', 'TBD', 'maybe', '？', '?']) {
      expect(normalizeBoolean(v)).toEqual({ ok: false, reason: 'unknown' })
    }
  })

  it('other numbers', () => {
    expect(normalizeBoolean(2)).toEqual({ ok: false, reason: 'unknown' })
    expect(normalizeBoolean(-1)).toEqual({ ok: false, reason: 'unknown' })
    expect(normalizeBoolean('2')).toEqual({ ok: false, reason: 'unknown' })
  })

  it('empty', () => {
    expect(normalizeBoolean('')).toEqual({ ok: false, reason: 'empty' })
    expect(normalizeBoolean('   ')).toEqual({ ok: false, reason: 'empty' })
    expect(normalizeBoolean(null)).toEqual({ ok: false, reason: 'empty' })
    expect(normalizeBoolean(undefined)).toEqual({ ok: false, reason: 'empty' })
  })
})
