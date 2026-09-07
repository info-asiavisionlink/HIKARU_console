// ============================================================
// Production E2E Hotfix — 3 registration failures
//
// 静的 source scan で以下 invariants を verify する:
//
// Issue 1: Dashboard "案件を追加" QuickAction は /projects/spot/new を指す。
//          /projects/new は入力可能 field が不足しており、後編集を強いる。
//          spot/new は work_content / required_staff / estimated_hours /
//          entry_route / SinglePriceCard / BillingInfoCard を含む完全な form。
//
// Issue 2: createClientRecord は fetch('/api/clients') を経由する。
//          browser Supabase SDK 直接呼びは Console 独自 auth cookie
//          (hk_c_at) を認識できず hang する。/api/clients は server 側
//          getAuthContext で確実に auth 解決する。
//          clients/new submit handler は try/finally で saving 状態を
//          必ず解除する。
//
// Issue 3: /api/employees POST は employees テーブル INSERT payload から
//          contract_type / hourly_rate を除外する (Production Schema に
//          存在しない列)。同2列は profiles テーブルに移して update する。
// ============================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DASHBOARD_PAGE   = resolve(__dirname, '../../../app/(console)/dashboard/page.tsx')
const CLIENTS_SERVICE  = resolve(__dirname, '../../../services/clients.service.ts')
const CLIENTS_NEW_PAGE = resolve(__dirname, '../../../app/(console)/clients/new/page.tsx')
const EMPLOYEES_ROUTE  = resolve(__dirname, '../../../app/api/employees/route.ts')
const EMPLOYEES_NEW    = resolve(__dirname, '../../../app/(console)/employees/new/page.tsx')
const SPOT_NEW_PAGE    = resolve(__dirname, '../../../app/(console)/projects/spot/new/page.tsx')

// ─── Issue 1: Dashboard 案件を追加 → /projects/spot/new ──────

describe('Issue 1: Dashboard project quick action', () => {
  const dashboardSrc = readFileSync(DASHBOARD_PAGE, 'utf8')

  it('"案件を追加" QuickAction は /projects/spot/new を指す (完全な form へ誘導)', () => {
    expect(dashboardSrc).toMatch(/label:\s*'案件を追加'[^}]*href:\s*'\/projects\/spot\/new'/)
  })

  it('regression guard: 旧 /projects/new への QuickAction は残っていない', () => {
    // 「案件を追加」QuickAction の label→href block の中に旧 route が無いこと
    const quickAction = dashboardSrc.match(/label:\s*'案件を追加'[^,}]*,\s*href:\s*'([^']+)'/)
    expect(quickAction).toBeTruthy()
    expect(quickAction![1]).not.toBe('/projects/new')
  })
})

describe('Issue 1: spot/new is the complete create form', () => {
  const spotSrc = readFileSync(SPOT_NEW_PAGE, 'utf8')

  it('作業内容 / 必要人数 / 予定時間 / 入館経路 / 契約金額 / 請求情報 の入力を持つ', () => {
    expect(spotSrc).toContain('work_content')
    expect(spotSrc).toContain('required_staff')
    expect(spotSrc).toContain('estimated_hours')
    expect(spotSrc).toContain('entry_route')
    expect(spotSrc).toContain('SinglePriceCard')
    expect(spotSrc).toContain('BillingInfoCard')
  })
})

// ─── Issue 2: Client createClientRecord uses API route ──────

describe('Issue 2: createClientRecord uses server API not browser Supabase', () => {
  const svcSrc = readFileSync(CLIENTS_SERVICE, 'utf8')

  it('createClientRecord は fetch(/api/clients) を経由する', () => {
    const fn = svcSrc.match(/export async function createClientRecord[\s\S]*?(?=\nexport\s|$)/)
    expect(fn).toBeTruthy()
    expect(fn![0]).toMatch(/fetch\(\s*['"]\/api\/clients['"]/)
    expect(fn![0]).toMatch(/method:\s*['"]POST['"]/)
    expect(fn![0]).toContain("credentials: 'include'")
  })

  it('createClientRecord は browser Supabase 直呼び (supabase.from\\(clients\\)) をしない', () => {
    const fn = svcSrc.match(/export async function createClientRecord[\s\S]*?(?=\nexport\s|$)/)
    expect(fn).toBeTruthy()
    // browser client 直接呼びの痕跡がないこと
    expect(fn![0]).not.toMatch(/supabase\.from\(\s*['"]clients['"]/)
    expect(fn![0]).not.toMatch(/getCompanyId\(/)
  })

  it('例外を try/catch で拾い error を返す (Promise rejection で UI が hang しない)', () => {
    const fn = svcSrc.match(/export async function createClientRecord[\s\S]*?(?=\nexport\s|$)/)
    expect(fn![0]).toMatch(/try\s*\{/)
    expect(fn![0]).toMatch(/catch\s*\(/)
  })

  it('AbortSignal.timeout を付けており fetch が無限 hang しない', () => {
    const fn = svcSrc.match(/export async function createClientRecord[\s\S]*?(?=\nexport\s|$)/)
    expect(fn![0]).toMatch(/AbortSignal\.timeout\(\s*\d+/)
  })

  it('戻り値に HTTP status を含めて呼び出し側で 401 判定できる', () => {
    const fn = svcSrc.match(/export async function createClientRecord[\s\S]*?(?=\nexport\s|$)/)
    expect(fn![0]).toMatch(/status:\s*(res\.status|null)/)
  })
})

describe('Issue 2: clients/new submit handler has try/finally', () => {
  const pageSrc = readFileSync(CLIENTS_NEW_PAGE, 'utf8')

  it('handleSubmit は try/finally で必ず setLoading(false) を実行する', () => {
    const handler = pageSrc.match(/async function handleSubmit[\s\S]{0,4000}?\n\s{2}\}/)
    expect(handler).toBeTruthy()
    expect(handler![0]).toMatch(/try\s*\{/)
    expect(handler![0]).toMatch(/finally\s*\{[^}]*setLoading\(\s*false\s*\)/)
  })

  it('finally 中で setLoading(false) が呼ばれる', () => {
    const handler = pageSrc.match(/async function handleSubmit[\s\S]{0,4000}?\n\s{2}\}/)
    // finally block を抽出
    const fin = handler![0].match(/finally\s*\{[\s\S]{0,300}?\}/)
    expect(fin).toBeTruthy()
    expect(fin![0]).toContain('setLoading(false)')
  })

  it('duplicate click guard: submit button に disabled={loading} が残っている', () => {
    expect(pageSrc).toMatch(/<Button\s+type="submit"\s+disabled=\{loading\}/)
  })

  it('401 セッション切れは /login?next=/clients/new へリダイレクトする', () => {
    const handler = pageSrc.match(/async function handleSubmit[\s\S]{0,4000}?\n\s{2}\}/)
    expect(handler![0]).toMatch(/status\s*===\s*401/)
    expect(handler![0]).toMatch(/router\.push\(\s*['"]\/login\?next=\/clients\/new['"]/)
  })
})

// ─── Issue 3: Employee create schema alignment ──────────────

describe('Issue 3: /api/employees POST does not send contract_type/hourly_rate to employees table', () => {
  const routeSrc = readFileSync(EMPLOYEES_ROUTE, 'utf8')

  it('ALLOWED_EMP_FIELDS 白名单に contract_type と hourly_rate が含まれない', () => {
    const list = routeSrc.match(/ALLOWED_EMP_FIELDS\s*=\s*\[[\s\S]{0,600}?\]\s*as\s*const/)
    expect(list).toBeTruthy()
    expect(list![0]).not.toMatch(/['"]contract_type['"]/)
    expect(list![0]).not.toMatch(/['"]hourly_rate['"]/)
  })

  it('contract_type / hourly_rate は body から個別に取り出し profiles.update に渡す', () => {
    expect(routeSrc).toMatch(/const\s+contract_type\s*=\s*body\.contract_type/)
    expect(routeSrc).toMatch(/const\s+hourly_rate\s*=\s*body\.hourly_rate/)

    // profiles.update payload に両フィールドが含まれる
    const profilesUpdate = routeSrc.match(/\.from\(\s*['"]profiles['"]\s*\)\s*\.update\(\{[\s\S]{0,600}?\}\)/)
    expect(profilesUpdate).toBeTruthy()
    expect(profilesUpdate![0]).toMatch(/contract_type/)
    expect(profilesUpdate![0]).toMatch(/hourly_rate/)
  })

  it('employees INSERT payload に contract_type / hourly_rate が混入しない', () => {
    // .from('employees').insert(...) を抽出
    const insertMatch = routeSrc.match(/\.from\(\s*['"]employees['"]\s*\)\s*\.insert\(\{[\s\S]{0,300}?\}/)
    expect(insertMatch).toBeTruthy()
    expect(insertMatch![0]).not.toMatch(/contract_type/)
    expect(insertMatch![0]).not.toMatch(/hourly_rate/)
  })
})

describe('Issue 3: existing employee create UI still sends these fields (unchanged)', () => {
  const uiSrc = readFileSync(EMPLOYEES_NEW, 'utf8')

  it('form state に contract_type と hourly_rate が残っている (UI 変更しない)', () => {
    expect(uiSrc).toMatch(/contract_type:\s*['"]part_time['"]/)
    expect(uiSrc).toMatch(/hourly_rate:\s*['"]{2}/)
  })

  it('createEmployee 呼び出しの payload に contract_type / hourly_rate が含まれる', () => {
    expect(uiSrc).toMatch(/contract_type:\s*form\.contract_type/)
    expect(uiSrc).toMatch(/hourly_rate:\s*form\.hourly_rate/)
  })
})
