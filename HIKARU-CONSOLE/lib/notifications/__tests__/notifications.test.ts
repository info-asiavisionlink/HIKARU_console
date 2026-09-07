// ============================================================
// Console notification suite
//
// - isSafeInternalNotificationPath (Safety 1)
// - ADMIN_NOTIFICATION_TYPES stability (Safety 2)
// - route contract tests via static source scan:
//     * GET /api/console-notifications uses count-only query for unread_count (Fix 4)
//     * PATCH /api/console-notifications/[id]/read scope invariants (P0)
//     * PATCH /api/console-notifications/read-all exists + scope invariants (Fix 3)
// - ConsoleHeader wiring: markAllRead + safe navigation (Fix 3 / Safety 1)
// ============================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isSafeInternalNotificationPath } from '../safe-url'
import { ADMIN_NOTIFICATION_TYPES } from '../types'

const ROOT = resolve(__dirname, '../../..')

describe('isSafeInternalNotificationPath', () => {
  it.each([
    ['/', true],
    ['/jobs/123', true],
    ['/expenses/uuid-abc', true],
    ['/attendance/2026/9', true],
    ['/project-requests', true],
    ['/notifications?filter=unread', true],
  ])('allows internal path %s', (url, expected) => {
    expect(isSafeInternalNotificationPath(url)).toBe(expected)
  })

  it.each([
    ['http://example.com', false],
    ['https://example.com/path', false],
    ['//evil.example', false],
    ['javascript:alert(1)', false],
    ['data:text/html,<script>', false],
    ['vbscript:msgbox', false],
    ['file:///etc/passwd', false],
    ['', false],
    ['   ', false],
    ['foo', false],
    ['./relative', false],
    ['../up', false],
  ])('rejects unsafe %s', (url) => {
    expect(isSafeInternalNotificationPath(url)).toBe(false)
  })

  it('rejects non-string values', () => {
    expect(isSafeInternalNotificationPath(null)).toBe(false)
    expect(isSafeInternalNotificationPath(undefined)).toBe(false)
    expect(isSafeInternalNotificationPath(123)).toBe(false)
    expect(isSafeInternalNotificationPath({})).toBe(false)
    expect(isSafeInternalNotificationPath([])).toBe(false)
  })
})

describe('ADMIN_NOTIFICATION_TYPES', () => {
  it('contains exactly the 4 Admin-facing notification types (no accidental addition/removal)', () => {
    expect([...ADMIN_NOTIFICATION_TYPES].sort()).toEqual([
      'attendance_correction_submitted',
      'expense_submitted',
      'project_proposal_submitted',
      'project_report_submitted',
    ])
  })

  it('does not include Worker-facing types', () => {
    for (const t of ADMIN_NOTIFICATION_TYPES) {
      expect(t.endsWith('_approved') || t.endsWith('_rejected') || t.endsWith('_settled')).toBe(false)
      expect(t.startsWith('shift_')).toBe(false)
      expect(t.startsWith('project_') && t.endsWith('_assigned')).toBe(false)
    }
  })
})

// ─── GET /api/console-notifications ─────────────────────────

describe('GET /api/console-notifications route', () => {
  const src = readFileSync(
    resolve(ROOT, 'app/api/console-notifications/route.ts'),
    'utf8'
  )

  it('imports ADMIN_NOTIFICATION_TYPES from shared module (no duplicate literal)', () => {
    expect(src).toContain("from '@/lib/notifications/types'")
    expect(src).not.toMatch(/'attendance_correction_submitted'[\s\S]{0,200}'expense_submitted'/)
  })

  it('uses count-only query for unread_count (Fix 4)', () => {
    expect(src).toMatch(/count:\s*['"]exact['"]/)
    expect(src).toMatch(/head:\s*true/)
    expect(src).toMatch(/\.eq\('is_read',\s*false\)/)
  })

  it('scopes count query by company_id + recipient + type + target_app (same as list)', () => {
    // Get the block after "count:" for count query verification
    const countBlock = src.match(/head:\s*true[\s\S]{0,600}/)
    expect(countBlock).toBeTruthy()
    expect(countBlock![0]).toMatch(/\.eq\(\s*['"]company_id['"]\s*,\s*auth\.companyId\s*\)/)
    expect(countBlock![0]).toMatch(/\.eq\(\s*['"]recipient_profile_id['"]\s*,\s*auth\.userId\s*\)/)
    expect(countBlock![0]).toMatch(/\.in\(\s*['"]type['"]\s*,\s*ADMIN_NOTIFICATION_TYPES/)
    expect(countBlock![0]).toMatch(/target_app\.eq\.console/)
  })

  it('falls back to list-based count if count query errors (badge never breaks)', () => {
    expect(src).toMatch(/countError\s*\|\|\s*unreadTotal\s*===\s*null/)
  })
})

// ─── PATCH /api/console-notifications/[id]/read ────────────

describe('PATCH /api/console-notifications/[id]/read route', () => {
  const src = readFileSync(
    resolve(ROOT, 'app/api/console-notifications/[id]/read/route.ts'),
    'utf8'
  )

  it('imports ADMIN_NOTIFICATION_TYPES from shared module', () => {
    expect(src).toContain("from '@/lib/notifications/types'")
  })

  it('checks ownership via company_id + recipient + type + target_app', () => {
    expect(src).toMatch(/\.eq\(\s*['"]company_id['"]\s*,\s*auth\.companyId/)
    expect(src).toMatch(/\.eq\(\s*['"]recipient_profile_id['"]\s*,\s*auth\.userId/)
    expect(src).toMatch(/\.in\(\s*['"]type['"]\s*,\s*ADMIN_NOTIFICATION_TYPES/)
    expect(src).toMatch(/target_app\.eq\.console/)
  })

  it('updates only is_read (no mass-assignment from body)', () => {
    const updateBlock = src.match(/\.update\(\{[^}]*\}\)/)
    expect(updateBlock).toBeTruthy()
    expect(updateBlock![0]).toContain('is_read')
    expect(updateBlock![0]).not.toMatch(/company_id|recipient_profile_id|type|target_app|target_url/)
  })

  it('returns 404 when not found (protects worker rows from being flipped)', () => {
    expect(src).toMatch(/404/)
  })
})

// ─── PATCH /api/console-notifications/read-all (Fix 3) ─────

describe('PATCH /api/console-notifications/read-all route (Fix 3)', () => {
  const src = readFileSync(
    resolve(ROOT, 'app/api/console-notifications/read-all/route.ts'),
    'utf8'
  )

  it('handler is PATCH', () => {
    expect(src).toMatch(/export async function PATCH/)
  })

  it('imports ADMIN_NOTIFICATION_TYPES', () => {
    expect(src).toContain("from '@/lib/notifications/types'")
  })

  it('scopes update to company + recipient + type + target_app + is_read=false', () => {
    expect(src).toMatch(/\.eq\(\s*['"]company_id['"]\s*,\s*auth\.companyId/)
    expect(src).toMatch(/\.eq\(\s*['"]recipient_profile_id['"]\s*,\s*auth\.userId/)
    expect(src).toMatch(/\.in\(\s*['"]type['"]\s*,\s*ADMIN_NOTIFICATION_TYPES/)
    expect(src).toMatch(/target_app\.eq\.console/)
    expect(src).toMatch(/\.eq\(\s*['"]is_read['"]\s*,\s*false/)
  })

  it('does not accept body fields (server-derived auth only)', () => {
    expect(src).not.toMatch(/req\.json\(\)/)
    expect(src).not.toMatch(/body\.company_id/)
    expect(src).not.toMatch(/body\.recipient_profile_id/)
  })
})

// ─── ConsoleHeader wiring (Fix 3 / Safety 1) ───────────────

describe('ConsoleHeader wiring', () => {
  const src = readFileSync(resolve(ROOT, 'components/layouts/ConsoleHeader.tsx'), 'utf8')

  it('imports isSafeInternalNotificationPath', () => {
    expect(src).toContain("from '@/lib/notifications/safe-url'")
    expect(src).toContain('isSafeInternalNotificationPath')
  })

  it('router.push wrapped by sanitizer for notification target', () => {
    // "if (isSafeInternalNotificationPath(n.target_url)) { router.push(n.target_url) }"
    expect(src).toMatch(/isSafeInternalNotificationPath\(n\.target_url\)[\s\S]{0,80}router\.push\(\s*n\.target_url\s*\)/)
  })

  it('markAllRead helper defined and posts to /api/console-notifications/read-all', () => {
    expect(src).toMatch(/async function markAllRead/)
    expect(src).toMatch(/fetch\(\s*['"]\/api\/console-notifications\/read-all['"]/)
    expect(src).toMatch(/method:\s*['"]PATCH['"]/)
  })

  it('markAllRead only mutates local state after HTTP ok', () => {
    const fn = src.match(/async function markAllRead[\s\S]{0,600}?^\s{2}\}/m)
    expect(fn).toBeTruthy()
    // The setUnreadCount(0) call must appear AFTER the "if (!res.ok) return false" guard
    const setZeroIdx  = fn![0].indexOf('setUnreadCount(0)')
    const okGuardIdx  = fn![0].indexOf('if (!res.ok) return false')
    expect(setZeroIdx).toBeGreaterThan(okGuardIdx)
  })

  it('polling interval is 30_000 ms with cleanup', () => {
    expect(src).toMatch(/setInterval\(fetchNotifs,\s*30000\)/)
    expect(src).toMatch(/clearInterval\(id\)/)
  })
})
