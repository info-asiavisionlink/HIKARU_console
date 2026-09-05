// ============================================================
// POST /api/import/sessions — Session Create Route Contract Tests
//
// browser 側の entity routing 事故 (Employee → Client silent routing)
// への server 側 defense-in-depth を静的に担保する。
//
// - request body に requested_entity_type (trace) を受け取る
// - requested_entity_type と entity_type の不一致は 400 で拒否する
// - session.created audit log に requested_entity_type + referer を記録する
// - entity_type / source_type は既存 VALID_* リストで検証を続ける
// - company_id / created_by は auth context から (body から取らない)
// ============================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROUTE_PATH = resolve(
  __dirname,
  '../../../app/api/import/sessions/route.ts',
)
const source = readFileSync(ROUTE_PATH, 'utf8')

describe('session-create route — auth + admin', () => {
  it('getAuthContext + requireAdmin gate を維持', () => {
    expect(source).toMatch(/const\s+auth\s*=\s*await\s+getAuthContext\s*\(\s*\)/)
    expect(source).toMatch(/requireAdmin\s*\(\s*auth\s*\)/)
    expect(source).toMatch(/status:\s*401/)
    expect(source).toMatch(/status:\s*403/)
  })
})

describe('session-create route — entity_type / source_type allowlist', () => {
  it('entity_type は VALID_ENTITY_TYPES で検証、不一致は 400', () => {
    expect(source).toMatch(
      /VALID_ENTITY_TYPES[\s\S]{0,120}\.includes\(entityType\)[\s\S]{0,400}status:\s*400/,
    )
  })

  it('source_type は VALID_SOURCE_TYPES で検証、不一致は 400', () => {
    expect(source).toMatch(
      /VALID_SOURCE_TYPES[\s\S]{0,120}\.includes\(sourceType\)[\s\S]{0,400}status:\s*400/,
    )
  })
})

describe('session-create route — entity_type mismatch defense (browser trace)', () => {
  it('body から requested_entity_type を trace 値として受け取る', () => {
    expect(source).toMatch(/raw\.requested_entity_type/)
  })

  it('requested_entity_type と entity_type の不一致は ENTITY_TYPE_MISMATCH で 400 拒否', () => {
    expect(source).toMatch(
      /requestedEntity[\s\S]{0,60}!==\s*entityType[\s\S]{0,200}status:\s*400/,
    )
    expect(source).toMatch(/ENTITY_TYPE_MISMATCH/)
  })

  it('requested_entity_type が null (Step1 選択経路) の場合は不一致検証を skip', () => {
    // requestedEntity !== null && requestedEntity !== entityType — 明示的に null を許容する契約。
    expect(source).toMatch(
      /requestedEntity\s*!==\s*null\s*&&\s*requestedEntity\s*!==\s*entityType/,
    )
  })
})

describe('session-create route — DB insert uses server-side context (not body)', () => {
  it('company_id は auth context から (body から取らない)', () => {
    expect(source).toMatch(/company_id:\s*auth\.companyId/)
    expect(source).not.toMatch(/company_id:\s*raw\./)
    expect(source).not.toMatch(/body\.\s*company_?id/)
  })

  it('created_by は auth.userId から (body から取らない)', () => {
    expect(source).toMatch(/created_by:\s*auth\.userId/)
    expect(source).not.toMatch(/created_by:\s*raw\./)
  })

  it('DB INSERT の entity_type は body 検証済みの entityType を使う', () => {
    expect(source).toMatch(/entity_type:\s*entityType/)
  })
})

describe('session-create route — audit log records routing trace', () => {
  it('session.created audit に requested_entity_type と referer を含める', () => {
    expect(source).toMatch(
      /writeAuditLog[\s\S]{0,400}session\.created[\s\S]{0,400}requested_entity_type[\s\S]{0,200}referer/,
    )
  })

  it('referer は request header から取得する (client 供給ではない)', () => {
    expect(source).toMatch(/req\.headers\.get\(\s*['"]referer['"]\s*\)/)
  })

  it('audit metadata に token / secret / cookie を絶対に記録しない', () => {
    // 静的な禁止パターン。誤って追加されないよう assert。
    expect(source).not.toMatch(/writeAuditLog[\s\S]{0,600}token/i)
    expect(source).not.toMatch(/writeAuditLog[\s\S]{0,600}cookie/i)
    expect(source).not.toMatch(/writeAuditLog[\s\S]{0,600}secret/i)
    expect(source).not.toMatch(/writeAuditLog[\s\S]{0,600}password/i)
  })
})
