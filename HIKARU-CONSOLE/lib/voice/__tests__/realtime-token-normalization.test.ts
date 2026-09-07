// ============================================================
// Console Realtime Token Normalization tests
//
// 修正後の Console voice context / token endpoint が以下の invariant を
// 満たすことを静的 + 挙動 verify する:
//
//   INV-1: Provider mount で refreshToken() が fire されない
//   INV-2: visibilitychange で refreshToken() が fire されない
//   INV-3: refreshToken に in-flight Promise lock がある
//   INV-4: startSession に二重クリック guard がある
//   INV-5: token endpoint route は 1 POST = 1 clientSecrets.create()
//   INV-6: connectRealtime は既存 ref-based guard (voiceEngineModeRef) を維持
//   INV-7: 429 catch は silent (自動 retry なし)
//   INV-8: transport disconnect の 1-shot reconnect は維持 (established
//          session でのみ発火、token 取得失敗経路とは分離)
//
// 併せて refreshToken の Promise-based lock を挙動 simulation で verify する
// (module-scope helper 抽出無しで、regex + refactor-safe assertion で)。
// ============================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const CONSOLE_CTX  = resolve(__dirname, '../ConsoleVoiceContext.tsx')
const TOKEN_ROUTE  = resolve(__dirname, '../../../app/api/ai/console-realtime-token/route.ts')

const ctxSrc   = readFileSync(CONSOLE_CTX,  'utf8')
const routeSrc = readFileSync(TOKEN_ROUTE, 'utf8')

// ─── Static contract tests ─────────────────────────────────────

describe('INV-1: mount useEffect does NOT call refreshToken()', () => {
  it('mount useEffect (SDK preload) block は refreshToken() を実行しない (行頭が // でない refreshToken( が無い)', () => {
    // SDK preload useEffect を抽出 (「Provider mount後」コメントから次の }, [])まで)
    const mountBlock = ctxSrc.match(/\/\/ ─── Provider mount後[\s\S]{50,1500}?\}, \[\]\)/)
    expect(mountBlock).toBeTruthy()
    // 本 block 内で refreshToken() の "コメント以外" 呼び出しが存在しないこと
    // コメント行 ((removed) refreshToken() 等) を除外して検証
    const codeLines = mountBlock![0].split('\n').filter(l => !/^\s*\/\//.test(l))
    const codeBody = codeLines.join('\n')
    expect(codeBody).not.toMatch(/refreshToken\s*\(/)
    // (removed) コメントで削除意図を明示している (comment line として存在)
    expect(mountBlock![0]).toMatch(/\(removed\)[\s\S]{0,20}refreshToken/)
  })
})

describe('INV-2: mount useEffect does NOT add visibilitychange listener for token', () => {
  it('mount useEffect 内に document.addEventListener("visibilitychange", ...) がない', () => {
    const mountBlock = ctxSrc.match(/\/\/ ─── Provider mount後[\s\S]{50,1500}?\}, \[\]\)/)
    expect(mountBlock).toBeTruthy()
    expect(mountBlock![0]).not.toMatch(/addEventListener\s*\(\s*['"]visibilitychange['"]/)
    // (removed) コメントで削除意図を明示
    expect(mountBlock![0]).toMatch(/\(removed\)\s*visibilitychange/)
  })
})

describe('INV-3: refreshToken has in-flight Promise lock', () => {
  it('refreshTokenInFlightRef が定義されている', () => {
    expect(ctxSrc).toMatch(/refreshTokenInFlightRef\s*=\s*React\.useRef<Promise<void>\s*\|\s*null>/)
  })
  it('refreshToken 冒頭で in-flight Promise を dedup 返却', () => {
    expect(ctxSrc).toMatch(/const\s+inflight\s*=\s*refreshTokenInFlightRef\.current/)
    expect(ctxSrc).toMatch(/if\s*\(\s*inflight\s*\)\s*return\s+inflight/)
  })
  it('fetch を Promise chain の finally で lock 解放', () => {
    expect(ctxSrc).toMatch(/\.finally\s*\(\s*\(\s*\)\s*=>\s*\{\s*refreshTokenInFlightRef\.current\s*=\s*null\s*\}\s*\)/)
  })
  it('lock 設定は fetch 発火直後 (再帰的 fire を防ぐ)', () => {
    expect(ctxSrc).toMatch(/refreshTokenInFlightRef\.current\s*=\s*p/)
  })
})

describe('INV-4: startSession has synchronous double-click guard', () => {
  it('startSession 冒頭で isSessionRef guard がある', () => {
    // startSession 関数ブロック抽出
    const startSession = ctxSrc.match(/const\s+startSession\s*=\s*React\.useCallback\([\s\S]{0,500}?\}, \[[^\]]*\]\)/)
    expect(startSession).toBeTruthy()
    // 同期 ref guard (setIsSession/scheduleStandby より前)
    expect(startSession![0]).toMatch(/if\s*\(\s*isSessionRef\.current\s*\)\s*return/)
    expect(startSession![0]).toMatch(/if\s*\(\s*voiceEngineModeRef\.current\s*===\s*['"]realtime-connecting['"]\s*\)\s*return/)
  })
})

describe('INV-5: token endpoint route is 1 POST = 1 clientSecrets.create()', () => {
  it('route.ts に コメント以外の clientSecrets.create( 実行が 1 箇所のみ', () => {
    // コメント行 (// で始まる、または /* ... */ 内) を除外して実行文だけ数える
    const codeLines = routeSrc
      .replace(/\/\*[\s\S]*?\*\//g, '')     // block comments 除去
      .split('\n')
      .filter(l => !/^\s*\/\//.test(l))     // line comments 除去
      .join('\n')
    const matches = codeLines.match(/clientSecrets\.create\s*\(/g)
    expect(matches).toBeTruthy()
    expect(matches!.length).toBe(1)
  })
  it('route.ts に loop / retry / dual create の pattern がない', () => {
    expect(routeSrc).not.toMatch(/for\s*\([\s\S]{0,80}clientSecrets\.create/)
    expect(routeSrc).not.toMatch(/while\s*\([\s\S]{0,80}clientSecrets\.create/)
    expect(routeSrc).not.toMatch(/setTimeout[\s\S]{0,80}clientSecrets\.create/)
    // catch block 内で再 create しない
    expect(routeSrc).not.toMatch(/catch[\s\S]{0,120}clientSecrets\.create/)
  })
})

describe('INV-6: connectRealtime maintains existing ref-based guard', () => {
  it('connectRealtime は同期 ref guard (realtimeSessionRef + voiceEngineModeRef) を保持', () => {
    // connectRealtime 関数の先頭 300 chars 以内に両 guard が存在することを検証
    const connectStart = ctxSrc.indexOf('const connectRealtime = React.useCallback')
    expect(connectStart).toBeGreaterThan(0)
    const head = ctxSrc.slice(connectStart, connectStart + 500)
    expect(head).toMatch(/if\s*\(\s*realtimeSessionRef\.current\s*\)\s*return/)
    expect(head).toMatch(/voiceEngineModeRef\.current\s*===\s*['"]realtime-connecting['"]/)
  })
})

describe('INV-7: 429 handling has no auto retry', () => {
  it('token fetch failure catch は silent (setTimeout retry なし)', () => {
    // refreshToken の catch block を抽出
    const catchBlock = ctxSrc.match(/\.catch\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]{0,200}connectRealtime fallback/)
    expect(catchBlock).toBeTruthy()
    // catch 内で setTimeout / refreshToken 再呼び出しをしていない
    expect(catchBlock![0]).not.toMatch(/setTimeout/)
    expect(catchBlock![0]).not.toMatch(/refreshToken\s*\(/)
    expect(catchBlock![0]).not.toMatch(/connectRealtime\s*\(/)
  })
  it('token endpoint route の catch は再帰的 create をしない', () => {
    const catchBlock = routeSrc.match(/catch\s*\([\s\S]{0,300}?\}\s*\}/)
    expect(catchBlock).toBeTruthy()
    expect(catchBlock![0]).not.toMatch(/clientSecrets\.create/)
    expect(catchBlock![0]).not.toMatch(/setTimeout/)
  })
})

describe('INV-8: transport disconnect 1-shot reconnect preserved', () => {
  it('transport.connection_change === "disconnected" 経路の setTimeout(reconnect, 1500) が残っている', () => {
    // token 取得失敗経路 (throw) とは別、established session 後の transport event 経路
    expect(ctxSrc).toMatch(/transport\?\.on\?\.\(\s*['"]connection_change['"]/)
    expect(ctxSrc).toMatch(/setTimeout\(\s*\(\s*\)\s*=>\s*\{[\s\S]{0,300}connectRealtimeRef\.current\(\)[\s\S]{0,50}\}\s*,\s*1500\s*\)/)
    // reconnect 前に isSessionRef + voiceEngineModeRef guard で 429 経路と分離
    expect(ctxSrc).toMatch(/if\s*\(\s*!isSessionRef\.current\s*\)\s*return/)
  })
})

// ─── Behavior simulation: refreshToken in-flight lock ──────────
//
// refreshToken は React hook 内部の useCallback なので直接 import 不可。
// 代わりに、同じ実装 pattern を local に再現して in-flight lock 挙動を verify する。
// (実 context の refreshToken が同じ pattern を持つことは INV-3 で静的に verify 済)

describe('refreshToken behavior — in-flight lock simulation', () => {
  interface MockToken { clientSecret: string; fetchedAt: number }

  function makeRefreshToken(deps: {
    tokenRef: { current: MockToken | null }
    ttlMs:    number
    fetchImpl: () => Promise<{ clientSecret: string } | null>
  }) {
    const inflightRef: { current: Promise<void> | null } = { current: null }
    return (): Promise<void> => {
      const inflight = inflightRef.current
      if (inflight) return inflight
      const existing = deps.tokenRef.current
      if (existing && (Date.now() - existing.fetchedAt) < deps.ttlMs) return Promise.resolve()
      const p = deps.fetchImpl()
        .then(d => {
          if (d?.clientSecret) {
            deps.tokenRef.current = { clientSecret: d.clientSecret, fetchedAt: Date.now() }
          }
        })
        .catch(() => { /* silent */ })
        .finally(() => { inflightRef.current = null })
      inflightRef.current = p
      return p
    }
  }

  it('TEST 5: concurrent refreshToken x 10 → fetch called exactly 1 time', async () => {
    let fetchCount = 0
    const tokenRef = { current: null as MockToken | null }
    const refreshToken = makeRefreshToken({
      tokenRef, ttlMs: 480_000,
      fetchImpl: async () => {
        fetchCount++
        await new Promise(r => setTimeout(r, 10))
        return { clientSecret: 'test-secret' }
      },
    })
    // 10 concurrent calls
    await Promise.all(Array.from({ length: 10 }, () => refreshToken()))
    expect(fetchCount).toBe(1)
    expect(tokenRef.current?.clientSecret).toBe('test-secret')
  })

  it('TEST 6: cached valid token → fetch NOT called (0 fetch)', async () => {
    let fetchCount = 0
    const tokenRef = { current: { clientSecret: 'cached', fetchedAt: Date.now() } as MockToken | null }
    const refreshToken = makeRefreshToken({
      tokenRef, ttlMs: 480_000,
      fetchImpl: async () => { fetchCount++; return { clientSecret: 'fresh' } },
    })
    await refreshToken()
    expect(fetchCount).toBe(0)
    expect(tokenRef.current?.clientSecret).toBe('cached')
  })

  it('TEST 7: expired token → fetch called (1 fetch)', async () => {
    let fetchCount = 0
    const oldTime = Date.now() - 500_000  // > 480s ago = expired
    const tokenRef = { current: { clientSecret: 'expired', fetchedAt: oldTime } as MockToken | null }
    const refreshToken = makeRefreshToken({
      tokenRef, ttlMs: 480_000,
      fetchImpl: async () => { fetchCount++; return { clientSecret: 'fresh' } },
    })
    await refreshToken()
    expect(fetchCount).toBe(1)
    expect(tokenRef.current?.clientSecret).toBe('fresh')
  })

  it('TEST 8: fetch fails (simulated 429) → catch is silent, no auto retry, subsequent call can retry', async () => {
    let fetchCount = 0
    let shouldFail = true
    const tokenRef = { current: null as MockToken | null }
    const refreshToken = makeRefreshToken({
      tokenRef, ttlMs: 480_000,
      fetchImpl: async () => {
        fetchCount++
        if (shouldFail) throw new Error('429 rate limit')
        return { clientSecret: 'recovered' }
      },
    })
    // First call fails silently
    await refreshToken()
    expect(fetchCount).toBe(1)
    expect(tokenRef.current).toBeNull()
    // NO automatic retry — verified by waiting and checking count unchanged
    await new Promise(r => setTimeout(r, 30))
    expect(fetchCount).toBe(1)
    // Explicit retry works after lock released
    shouldFail = false
    await refreshToken()
    expect(fetchCount).toBe(2)
    expect(tokenRef.current?.clientSecret).toBe('recovered')
  })

  it('lock is released after fetch completes (next call can proceed)', async () => {
    let fetchCount = 0
    const tokenRef = { current: null as MockToken | null }
    const refreshToken = makeRefreshToken({
      tokenRef, ttlMs: 0,   // TTL 0 = always expired = always re-fetch
      fetchImpl: async () => { fetchCount++; return { clientSecret: `s${fetchCount}` } },
    })
    await refreshToken()
    await refreshToken()
    await refreshToken()
    expect(fetchCount).toBe(3)
  })
})
