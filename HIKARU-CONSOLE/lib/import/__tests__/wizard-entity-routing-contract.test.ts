// ============================================================
// Wizard + Preview — Entity Routing Contract Tests
//
// Root cause of Employee → Client silent routing (2026-09):
//   User uploaded Employee XLSX but DB session was created with
//   entity_type='client'. Server-side audit confirmed that the
//   Wizard's POST body itself carried entity_type='client'.
//
// This suite is a static contract test to prevent regression of:
//   - Preview 「移行を開始」button が URL に entity_type=<entity> を必ず含める
//   - Wizard の parsePreselectedEntityType が accept list = client/store/employee
//   - Wizard state initializer は preselectedEntity をそのまま採用 (client fallback 禁止)
//   - startImport() 冒頭で URL query と state の不一致を検知して POST を止める
//   - POST body 直前で VALID_ENTITY_TYPES 再確認
//   - POST body に requested_entity_type trace を含める
//   - client への silent fallback パターン (`|| 'client'` / `?? 'client'`) が無い
// ============================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const WIZARD_PATH = resolve(
  __dirname,
  '../../../app/(console)/settings/import/new/page.tsx',
)
const PREVIEW_PATH = resolve(
  __dirname,
  '../../../app/(console)/settings/import/preview/[entity]/page.tsx',
)

const wizardSource  = readFileSync(WIZARD_PATH,  'utf8')
const previewSource = readFileSync(PREVIEW_PATH, 'utf8')

describe('Preview page — entity_type propagation to Wizard', () => {
  it('handleStart は URL に entity_type=<meta.wizardEntityParam> を必ず含める', () => {
    // URLSearchParams を entity_type のキー付きで生成し Wizard へ push している契約。
    expect(previewSource).toMatch(
      /URLSearchParams\s*\(\s*\{\s*entity_type:\s*meta\.wizardEntityParam\s*\}\s*\)/,
    )
    expect(previewSource).toMatch(
      /router\.push\s*\(\s*`\/settings\/import\/new\?\$\{query\.toString\(\)\}`\s*\)/,
    )
  })

  it('handleStart は actionEnabled=false または wizardEntityParam が空の entity では起動しない', () => {
    expect(previewSource).toMatch(
      /if\s*\(\s*!\s*meta\.actionEnabled\s*\|\|\s*!\s*meta\.wizardEntityParam\s*\)\s*return/,
    )
  })
})

describe('Wizard — preselected entity handling', () => {
  it('VALID_ENTITY_TYPES に client / store / employee がすべて含まれる', () => {
    expect(wizardSource).toMatch(
      /VALID_ENTITY_TYPES[\s\S]{0,120}=\s*\[[^\]]*['"]client['"][\s\S]{0,120}\]\s*as\s*const/,
    )
    expect(wizardSource).toMatch(
      /VALID_ENTITY_TYPES[\s\S]{0,120}=\s*\[[^\]]*['"]store['"][\s\S]{0,120}\]\s*as\s*const/,
    )
    expect(wizardSource).toMatch(
      /VALID_ENTITY_TYPES[\s\S]{0,120}=\s*\[[^\]]*['"]employee['"][\s\S]{0,120}\]\s*as\s*const/,
    )
  })

  it('parsePreselectedEntityType は VALID_ENTITY_TYPES 外を null に落とす (client fallback 禁止)', () => {
    expect(wizardSource).toMatch(
      /return\s*\(VALID_ENTITY_TYPES[\s\S]{0,60}\)\.includes\(raw\)[\s\S]{0,60}:\s*null/,
    )
  })

  it('初期 state は preselectedEntity をそのまま採用する (client fallback 禁止)', () => {
    expect(wizardSource).toMatch(
      /useState<EntityType\s*\|\s*null>\(preselectedEntity\)/,
    )
    // preselect が有る時のみ step=2 (upload) にスキップ。
    expect(wizardSource).toMatch(
      /useState<Step>\(preselectedEntity\s*\?\s*2\s*:\s*1\)/,
    )
  })

  it('client への silent fallback パターン (`|| \'client\'` / `?? \'client\'` / `useState(\'client\')`) が無い', () => {
    expect(wizardSource).not.toMatch(/\|\|\s*['"]client['"]/)
    expect(wizardSource).not.toMatch(/\?\?\s*['"]client['"]/)
    expect(wizardSource).not.toMatch(/useState\s*\(\s*['"]client['"]\s*\)/)
    expect(wizardSource).not.toMatch(/defaultValue\s*=\s*['"]client['"]/)
  })
})

describe('Wizard — startImport() defensive gates', () => {
  it('URL query の entity_type と内部 state が不一致なら POST を止める', () => {
    // URL に entity_type クエリが存在し、かつ state と異なる場合の早期 return + user error 表示。
    expect(wizardSource).toMatch(
      /searchParams\.get\(\s*['"]entity_type['"]\s*\)[\s\S]{0,300}!==\s*entityType[\s\S]{0,300}return/,
    )
    // 明示エラー文言 (user へ再読み込みを促す)
    expect(wizardSource).toMatch(/移行対象の情報が一致しません/)
  })

  it('state が VALID_ENTITY_TYPES 外なら POST を止める (二重防御)', () => {
    expect(wizardSource).toMatch(
      /VALID_ENTITY_TYPES[\s\S]{0,80}\)\.includes\(\s*entityType\s*\)[\s\S]{0,120}return/,
    )
  })

  it('POST body には entity_type と requested_entity_type (trace) を含める', () => {
    expect(wizardSource).toMatch(/entity_type:\s*entityType/)
    expect(wizardSource).toMatch(/requested_entity_type:\s*urlEntityRaw/)
  })

  it('POST 先は /api/import/sessions の 1 個のみ', () => {
    // 別 route への silent 送信が無いこと。
    const matches = wizardSource.match(/fetch\s*\(\s*['"]\/api\/import\/sessions['"]/g) ?? []
    expect(matches.length).toBe(1)
  })
})

describe('Wizard — normal flows unchanged', () => {
  it('Client 経路: entity_type クエリ = client でも state = client なら POST 送信', () => {
    // ここは code が gate に落ちない事を担保する為の間接テスト。
    // gate 実装は「URL !== state」でのみ止める契約なので、一致していれば当然送信される。
    // 直接 assertion は不要 (上記 startImport gate テストが対偶で担保)。
    expect(wizardSource).toMatch(/urlEntityRaw\s*!==\s*null\s*&&\s*urlEntityRaw\s*!==\s*entityType/)
  })
})
