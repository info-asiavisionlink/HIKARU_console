// ============================================================
// Console AI Rate Limiter tests
//
// 検証項目:
//   1. checkRateLimit の閾値 / window リセット / key 分離
//   2. 5つの OpenAI cost route が auth 直後・OpenAI 呼び出し前に
//      rate limit を実行している (静的 source scan)
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  checkRateLimit,
  rateLimitExceededResponse,
  CONSOLE_ADMIN_RATE_LIMIT,
  CONSOLE_TOKEN_RATE_LIMIT,
} from '../ratelimit'

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('threshold 未満は true (=許可) を返す', () => {
    const key = `test-under-${Math.random()}`
    expect(checkRateLimit(key, 3, 60_000)).toBe(true)
    expect(checkRateLimit(key, 3, 60_000)).toBe(true)
    expect(checkRateLimit(key, 3, 60_000)).toBe(true)
  })

  it('threshold 到達で false (=拒否) を返す', () => {
    const key = `test-over-${Math.random()}`
    expect(checkRateLimit(key, 2, 60_000)).toBe(true)
    expect(checkRateLimit(key, 2, 60_000)).toBe(true)
    expect(checkRateLimit(key, 2, 60_000)).toBe(false)
    expect(checkRateLimit(key, 2, 60_000)).toBe(false)
  })

  it('key が異なれば独立してカウントされる (auth context 別に分離)', () => {
    const keyA = `test-userA-${Math.random()}`
    const keyB = `test-userB-${Math.random()}`
    expect(checkRateLimit(keyA, 1, 60_000)).toBe(true)
    expect(checkRateLimit(keyA, 1, 60_000)).toBe(false)
    // 別 user は影響なし
    expect(checkRateLimit(keyB, 1, 60_000)).toBe(true)
  })

  it('window 経過後にカウンタがリセットされる', () => {
    const key = `test-window-${Math.random()}`
    vi.setSystemTime(new Date('2026-09-07T00:00:00Z'))
    expect(checkRateLimit(key, 1, 60_000)).toBe(true)
    expect(checkRateLimit(key, 1, 60_000)).toBe(false)

    // window 内 → まだ拒否
    vi.setSystemTime(new Date('2026-09-07T00:00:30Z'))
    expect(checkRateLimit(key, 1, 60_000)).toBe(false)

    // window 経過後 → 許可
    vi.setSystemTime(new Date('2026-09-07T00:01:01Z'))
    expect(checkRateLimit(key, 1, 60_000)).toBe(true)
  })
})

describe('rateLimitExceededResponse', () => {
  it('status 429 を返す', async () => {
    const res  = rateLimitExceededResponse()
    expect(res.status).toBe(429)
    const body = await res.json() as { success: boolean; error: { code: string } }
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED')
  })
})

describe('CONSOLE_ADMIN_RATE_LIMIT / CONSOLE_TOKEN_RATE_LIMIT', () => {
  it('Admin 用の閾値は正の integer で window は 60s', () => {
    expect(CONSOLE_ADMIN_RATE_LIMIT.limit).toBeGreaterThan(0)
    expect(Number.isInteger(CONSOLE_ADMIN_RATE_LIMIT.limit)).toBe(true)
    expect(CONSOLE_ADMIN_RATE_LIMIT.windowMs).toBe(60_000)
  })

  it('Token 用の閾値は Admin 用より小さい (session 発行は 1 per session が正常)', () => {
    expect(CONSOLE_TOKEN_RATE_LIMIT.limit).toBeLessThan(CONSOLE_ADMIN_RATE_LIMIT.limit)
    expect(CONSOLE_TOKEN_RATE_LIMIT.windowMs).toBe(60_000)
  })
})

// ─── Route wiring (static source scan) ─────────────────────

const AI_DIR = resolve(__dirname, '../../../app/api/ai')

interface RouteExpectation {
  file:        string
  limitConst:  'CONSOLE_ADMIN_RATE_LIMIT' | 'CONSOLE_TOKEN_RATE_LIMIT'
  keyPrefix:   string
}

const EXPECTED_ROUTES: RouteExpectation[] = [
  { file: 'console-realtime-token/route.ts', limitConst: 'CONSOLE_TOKEN_RATE_LIMIT', keyPrefix: 'console-realtime-token' },
  { file: 'console-intent/route.ts',         limitConst: 'CONSOLE_ADMIN_RATE_LIMIT', keyPrefix: 'console-intent' },
  { file: 'console-agent/route.ts',          limitConst: 'CONSOLE_ADMIN_RATE_LIMIT', keyPrefix: 'console-agent' },
  { file: 'console-agent-sdk/route.ts',      limitConst: 'CONSOLE_ADMIN_RATE_LIMIT', keyPrefix: 'console-agent-sdk' },
  { file: 'console-manual-qa/route.ts',      limitConst: 'CONSOLE_ADMIN_RATE_LIMIT', keyPrefix: 'console-manual-qa' },
]

describe.each(EXPECTED_ROUTES)('$file wiring', ({ file, limitConst, keyPrefix }) => {
  const src = readFileSync(resolve(AI_DIR, file), 'utf8')

  it(`imports rate limit helpers from '@/lib/ai/ratelimit'`, () => {
    expect(src).toContain("from '@/lib/ai/ratelimit'")
    expect(src).toContain('checkRateLimit')
    expect(src).toContain(limitConst)
    expect(src).toContain('rateLimitExceededResponse')
  })

  it(`uses auth.userId as the rate limit key scope (prefix "${keyPrefix}:")`, () => {
    expect(src).toContain(`${keyPrefix}:\${auth.userId}`)
  })

  it('rate limit check appears AFTER getAuthContext() and BEFORE OpenAI call', () => {
    const authIdx  = src.indexOf('getAuthContext')
    const limitIdx = src.indexOf('checkRateLimit')
    expect(authIdx).toBeGreaterThanOrEqual(0)
    expect(limitIdx).toBeGreaterThan(authIdx)

    // OpenAI usage: `new OpenAI(` / `createOpenAIClient(` / `run(` / `generateScopedManualQA(`
    // どれも rate limit check より後ろにあることを確認
    const openAiIdx = ['new OpenAI(', 'createOpenAIClient(', 'run(consoleJarvis', 'generateScopedManualQA(']
      .map(m => src.indexOf(m))
      .filter(i => i >= 0)
    expect(openAiIdx.length).toBeGreaterThan(0)
    for (const i of openAiIdx) {
      expect(limitIdx).toBeLessThan(i)
    }
  })

  it('does NOT retry on 429 (no fetch/re-invocation after rateLimitExceededResponse)', () => {
    // rateLimitExceededResponse() は return されて即終了。retry loop なし。
    const retryPattern = /rateLimitExceededResponse\(\)[\s\S]{0,200}?retry/i
    expect(src).not.toMatch(retryPattern)
  })
})
