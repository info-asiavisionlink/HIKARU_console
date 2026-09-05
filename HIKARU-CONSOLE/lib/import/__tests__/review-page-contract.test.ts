// ============================================================
// Review page — Final Commit UI Gate Contract Tests
//
// Root cause of Store/Employee E2E failure (2026-09):
//   Review page had hardcoded `if (session.entity_type !== 'client') return null`
//   → final commit button never rendered for store/employee sessions
//   → user could approve rows but had no UI trigger to invoke commit RPC
//   → 0 stores / 0 employees INSERT despite RPC + eligibility being correct
//
// This suite is a static contract test to prevent that regression:
//   - Review page MUST source its final-commit gate from SUPPORTED_COMMIT_ENTITIES
//   - Hardcoded `entity_type !== 'client'` (or === 'client') MUST NOT return.
//   - Hardcoded 顧客・店舗 wording in modal / info banner MUST NOT return.
// ============================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SUPPORTED_COMMIT_ENTITIES } from '../commit-eligibility'

const REVIEW_PAGE_PATH = resolve(
  __dirname,
  '../../../app/(console)/settings/import/[id]/page.tsx',
)
const source = readFileSync(REVIEW_PAGE_PATH, 'utf8')

describe('Review page — final commit UI gate', () => {
  it('imports SUPPORTED_COMMIT_ENTITIES from commit-eligibility', () => {
    expect(source).toMatch(
      /import\s*{[^}]*SUPPORTED_COMMIT_ENTITIES[^}]*}\s*from\s*['"]@\/lib\/import\/commit-eligibility['"]/,
    )
  })

  it('gates final commit UI via SUPPORTED_COMMIT_ENTITIES.includes (not hardcoded client)', () => {
    // The negative early-return pattern that hides the commit CTA when the
    // current session entity is unsupported. This is the exact regression guard.
    expect(source).toMatch(
      /if\s*\(\s*!\s*SUPPORTED_COMMIT_ENTITIES\.includes\s*\(\s*session\.entity_type\s*\)\s*\)\s*return\s+null/,
    )
  })

  it('does NOT reintroduce hardcoded entity_type client-only gate that returns null', () => {
    // Regression assertion: the previous bug used
    //   if (session.entity_type !== 'client') return null
    // Any equivalent pattern that returns null for non-client MUST NOT be present.
    expect(source).not.toMatch(
      /session\.entity_type\s*!==\s*['"]client['"][^\n]*return\s+null/,
    )
    // Also guard the inverted form guarding rendering only for client.
    expect(source).not.toMatch(
      /session\.entity_type\s*===\s*['"]client['"][\s\S]{0,80}\?\s*[^:]{0,120}:\s*null/,
    )
  })
})

describe('Review page — commit invocation is genuine (no mock success path)', () => {
  it('handleCommit posts to /api/import/sessions/[id]/commit', () => {
    expect(source).toMatch(
      /fetch\s*\(\s*`\/api\/import\/sessions\/\$\{sessionId\}\/commit`/,
    )
  })

  it('success screen is driven by real API response (body.data.inserted_count)', () => {
    expect(source).toMatch(/setCommitResult\s*\(\s*\{[\s\S]{0,120}inserted:\s*body\.data\.inserted_count/)
  })

  it('rejects on !res.ok || !body.success with toast.error (no silent success)', () => {
    expect(source).toMatch(/if\s*\(\s*!res\.ok\s*\|\|\s*!body\?\.success\s*\)\s*\{[\s\S]{0,120}toast\.error/)
  })
})

describe('Review page — wording is entity-agnostic (not client-only)', () => {
  it('info banner wording does not hardcode "顧客・店舗"', () => {
    expect(source).not.toMatch(/実際の顧客・店舗データへの書き込みは行われません/)
  })

  it('confirmation modal wording does not hardcode "顧客データベース"', () => {
    expect(source).not.toMatch(/実際の顧客データベースに書き込みます/)
  })
})

describe('Review page — SUPPORTED_COMMIT_ENTITIES contract sanity', () => {
  it('exactly allows the three entities currently wired end-to-end', () => {
    // This test cross-links with commit-eligibility.test.ts. If someone widens
    // SUPPORTED_COMMIT_ENTITIES (e.g. adds project) without wiring backend,
    // both suites will need to be updated together.
    expect([...SUPPORTED_COMMIT_ENTITIES].sort()).toEqual([
      'client',
      'employee',
      'store',
    ])
  })

  it('does NOT include any of project / expense / attendance / shift', () => {
    for (const et of ['project', 'expense', 'attendance', 'shift']) {
      expect(SUPPORTED_COMMIT_ENTITIES).not.toContain(et)
    }
  })
})
