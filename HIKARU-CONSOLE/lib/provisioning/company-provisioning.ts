// ============================================================
// HIKARU Company Provisioning — Pure Helpers
//
// Input validation / normalization / hashing だけを担当する pure module。
// DB I/O や Supabase 呼び出しはここに含めない (route side で管理)。
// これにより unit test 容易性を確保。
// ============================================================

import { createHash } from 'node:crypto'

// ---- Types ----

export interface RawProvisioningInput {
  companyName?: unknown
  adminName?:   unknown
  adminEmail?:  unknown
}

export interface NormalizedProvisioningInput {
  companyName: string
  adminName:   string
  adminEmail:  string
}

export type ValidateProvisioningResult =
  | { ok: true;  value: NormalizedProvisioningInput }
  | { ok: false; error: string; field: 'companyName' | 'adminName' | 'adminEmail' | 'idempotency' }

// ---- Limits (control character対策 + reasonable maxLen) ----

export const COMPANY_NAME_MAX = 200
export const ADMIN_NAME_MAX   = 100
export const ADMIN_EMAIL_MAX  = 254   // RFC 5321 email length practical limit

// 制御文字 (null byte / newline / tab / DEL 等)
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_RE = /[\x00-\x1F\x7F]/

// email 形式チェック (RFC 完全ではないが実用十分な最小限)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ---- Validation ----

export function validateProvisioningInput(raw: RawProvisioningInput): ValidateProvisioningResult {
  // companyName
  if (typeof raw.companyName !== 'string') {
    return { ok: false, field: 'companyName', error: 'companyName is required' }
  }
  const companyName = raw.companyName.trim()
  if (companyName.length === 0) {
    return { ok: false, field: 'companyName', error: 'companyName is required' }
  }
  if (companyName.length > COMPANY_NAME_MAX) {
    return { ok: false, field: 'companyName', error: `companyName exceeds max length (${COMPANY_NAME_MAX})` }
  }
  if (CONTROL_CHAR_RE.test(companyName)) {
    return { ok: false, field: 'companyName', error: 'companyName contains invalid characters' }
  }

  // adminName
  if (typeof raw.adminName !== 'string') {
    return { ok: false, field: 'adminName', error: 'adminName is required' }
  }
  const adminName = raw.adminName.trim()
  if (adminName.length === 0) {
    return { ok: false, field: 'adminName', error: 'adminName is required' }
  }
  if (adminName.length > ADMIN_NAME_MAX) {
    return { ok: false, field: 'adminName', error: `adminName exceeds max length (${ADMIN_NAME_MAX})` }
  }
  if (CONTROL_CHAR_RE.test(adminName)) {
    return { ok: false, field: 'adminName', error: 'adminName contains invalid characters' }
  }

  // adminEmail — trim + lowercase canonicalization
  if (typeof raw.adminEmail !== 'string') {
    return { ok: false, field: 'adminEmail', error: 'adminEmail is required' }
  }
  const adminEmail = raw.adminEmail.trim().toLowerCase()
  if (adminEmail.length === 0) {
    return { ok: false, field: 'adminEmail', error: 'adminEmail is required' }
  }
  if (adminEmail.length > ADMIN_EMAIL_MAX) {
    return { ok: false, field: 'adminEmail', error: `adminEmail exceeds max length (${ADMIN_EMAIL_MAX})` }
  }
  if (CONTROL_CHAR_RE.test(adminEmail)) {
    return { ok: false, field: 'adminEmail', error: 'adminEmail contains invalid characters' }
  }
  if (!EMAIL_RE.test(adminEmail)) {
    return { ok: false, field: 'adminEmail', error: 'adminEmail is not a valid email' }
  }

  return { ok: true, value: { companyName, adminName, adminEmail } }
}

// ---- Idempotency Key validation ----

export function isValidIdempotencyKey(key: string | null | undefined): boolean {
  if (typeof key !== 'string') return false
  const trimmed = key.trim()
  return UUID_RE.test(trimmed)
}

// ---- Request Hash ----
//
// normalized payload の SHA256 hex を計算する。
// 同一 Idempotency-Key で別 payload が来た場合の検出用。
// payload に token / secret / password は含まれない (input型で保証)。

export function computeRequestHash(input: NormalizedProvisioningInput): string {
  const canonical = JSON.stringify({
    companyName: input.companyName,
    adminName:   input.adminName,
    adminEmail:  input.adminEmail,
  })
  return createHash('sha256').update(canonical).digest('hex')
}

// ---- Console URL resolution ----
//
// invitation の redirectTo を組み立てる元の Console URL を取得する。
// 既存Console慣例 (services/auth.service.ts) と統一して NEXT_PUBLIC_CONSOLE_URL を使用。
// 未設定なら Configuration Error として null 返却 (呼び出し側で 503 応答)。

export function resolveSiteUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_CONSOLE_URL
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  // https:// or http:// scheme 必須
  if (!/^https?:\/\//i.test(trimmed)) return null
  // trailing slash 除去 (redirectTo組み立てで // を作らないため)
  return trimmed.replace(/\/$/, '')
}

export function buildInvitationRedirectUrl(siteUrl: string): string {
  return `${siteUrl}/auth/callback?next=/set-password`
}

// ---- Audit metadata sanitization aid ----
//
// Provisioning API 内で platform-audit へ渡す metadata を作る際、
// admin email は生ではなく hash で残すためのヘルパー。

export function hashEmail(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
}
