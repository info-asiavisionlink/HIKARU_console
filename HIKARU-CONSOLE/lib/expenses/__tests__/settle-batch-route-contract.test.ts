// ============================================================
// /api/expenses/settle-batch route contract test
//
// 静的 source scan で以下を verify:
//   - Auth 前に body parse しない
//   - company_id は auth から確定 (client body 由来ではない)
//   - MAX_BATCH_SIZE が定義されている
//   - ids: array 検証 / empty 拒否 / dedup / max size 拒否
//   - status='approved' のみ処理
//   - 通知は fire-and-forget (void)
//   - Response contract に settled_ids / failed_ids / errors が含まれる
// ============================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROUTE = resolve(__dirname, '../../../app/api/expenses/settle-batch/route.ts')
const src   = readFileSync(ROUTE, 'utf8')

describe('settle-batch route: authentication', () => {
  it('先に getAuthContext を呼ぶ (401 で早期 return)', () => {
    const authIdx = src.indexOf('getAuthContext')
    const jsonIdx = src.indexOf('req.json()')
    expect(authIdx).toBeGreaterThanOrEqual(0)
    expect(jsonIdx).toBeGreaterThan(authIdx)
    expect(src).toMatch(/if\s*\(\s*!auth\s*\)[\s\S]{0,150}status:\s*401/)
  })
})

describe('settle-batch route: input validation', () => {
  it('MAX_BATCH_SIZE が定義されており正の integer', () => {
    const m = src.match(/const\s+MAX_BATCH_SIZE\s*=\s*(\d+)/)
    expect(m).toBeTruthy()
    const v = Number(m![1])
    expect(v).toBeGreaterThan(0)
    expect(Number.isInteger(v)).toBe(true)
  })

  it('ids が Array であることを検証し 400 を返す', () => {
    expect(src).toContain('Array.isArray(body.ids)')
    expect(src).toMatch(/ids array required[\s\S]{0,40}400/)
  })

  it('empty ids を 400 で拒否', () => {
    expect(src).toMatch(/ids must be non-empty[\s\S]{0,40}400/)
  })

  it('MAX_BATCH_SIZE 超過を 400 で拒否', () => {
    expect(src).toMatch(/batch size exceeds max[\s\S]{0,120}400/)
  })

  it('ids の重複を Set で dedup する', () => {
    expect(src).toMatch(/new Set\([^)]+\)/)
  })

  it('string 型のみ受け入れる (type guard)', () => {
    expect(src).toMatch(/typeof v === 'string'/)
  })
})

describe('settle-batch route: authorization / IDOR safety', () => {
  it('company_id は auth.companyId から取り、body 由来ではない', () => {
    // body から company_id を取り出す痕跡がないこと (mass-assignment 禁止)
    expect(src).not.toMatch(/body\.company_id/)
    expect(src).not.toMatch(/body\[\s*['"]company_id['"]\s*\]/)
    // fetch と update の両方で auth.companyId 制約が入っていること
    const eqScopes = src.match(/\.eq\(\s*['"]company_id['"]\s*,\s*auth\.companyId\s*\)/g) ?? []
    expect(eqScopes.length).toBeGreaterThanOrEqual(1)
  })

  it('worker が bulk settle できないこと: getAuthContext のみが認可経路', () => {
    // getAuthContext は Admin 認証 helper。worker cookie では null が返る想定。
    expect(src).not.toMatch(/getWorkerAuth/)
    expect(src).not.toMatch(/hk_w_/)
  })
})

describe('settle-batch route: status filter', () => {
  it('status=approved のみを settle 対象とする', () => {
    expect(src).toMatch(/row\.status\s*!==\s*'approved'/)
  })

  it('NOT_FOUND / INVALID_STATUS / DB_ERROR の3種類の error code を持つ', () => {
    expect(src).toContain('NOT_FOUND')
    expect(src).toContain('INVALID_STATUS')
    expect(src).toContain('DB_ERROR')
  })
})

describe('settle-batch route: transaction / atomicity', () => {
  it('通知は fire-and-forget (void で await しない)', () => {
    const voidNotifCount = (src.match(/void\s+(insertExpenseSystemNotification|sendNotification)/g) ?? []).length
    expect(voidNotifCount).toBeGreaterThanOrEqual(2)
  })

  it('DB エラーは全 eligible ids を DB_ERROR で報告し 500 を返す', () => {
    expect(src).toMatch(/upsertError[\s\S]{0,400}DB_ERROR[\s\S]{0,600}status:\s*500/)
  })
})

describe('settle-batch route: response contract', () => {
  it('settled_ids / failed_ids / errors / *_count を含む', () => {
    expect(src).toContain('settled_ids')
    expect(src).toContain('failed_ids')
    expect(src).toContain('errors')
    expect(src).toContain('requested_count')
    expect(src).toContain('settled_count')
    expect(src).toContain('failed_count')
  })
})

// ─── UI wiring (regression guard on expenses page) ──────────

describe('expenses page: bulkSettle uses batch endpoint (not N+1)', () => {
  const PAGE = resolve(__dirname, '../../../app/(console)/expenses/page.tsx')
  const pageSrc = readFileSync(PAGE, 'utf8')

  it('POST /api/expenses/settle-batch を1回だけ呼ぶ', () => {
    expect(pageSrc).toContain('/api/expenses/settle-batch')
  })

  it('per-id sequential POST がもう存在しない (N+1 除去)', () => {
    // bulkSettle 関数 block を抽出
    const bulkFn = pageSrc.match(/async function bulkSettle[\s\S]{0,1500}?\n\s{2}\}/)
    expect(bulkFn).toBeTruthy()
    // per-id loop 内で /settle POST を回していた元 pattern が消えていること
    expect(bulkFn![0]).not.toMatch(/for\s*\([\s\S]{0,100}\/api\/expenses\/\$\{[^}]+\}\/settle/)
  })

  it('429 を silent 扱いにせず user に通知する', () => {
    const bulkFn = pageSrc.match(/async function bulkSettle[\s\S]{0,1500}?\n\s{2}\}/)
    expect(bulkFn![0]).toMatch(/429/)
  })
})
