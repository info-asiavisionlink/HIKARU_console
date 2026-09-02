// ============================================================
// HIKARU Platform Provisioning — Server-side Audit Helper
//
// 目的:
//   Provisioning操作 (Company作成 / First Admin招待 等) を
//   platform_audit_logs へ 1件 append する。
//
// 重要:
//   - Server-only module (Service Role client 使用)
//   - Client-supplied値を Audit authority として信用しない
//   - actorUserId は必ず AuthContext.userId 由来
//   - metadata の機密 key (password/token/authorization/cookie/secret/
//     service_role/api_key 等) は自動除去
//   - Audit失敗は結果として呼び出し側へ返却 (fire-and-forgetにしない)
//     → 呼び出し側が Provisioning結果とは別に判断できる
//
// 使い方 (P6以降):
//   const audit = await writePlatformAudit(auth, {
//     action:      'company.provisioning.completed',
//     targetType:  'company',
//     targetId:    newCompanyId,
//     status:      'success',
//     requestId:   idempotencyKey,
//     metadata:    { admin_email_hash: sha256(email) },
//   })
//   if (!audit.ok) {
//     console.error('[audit] write failed:', audit.error)
//     // Provisioning本処理は成功として扱ってよい (呼び出し側判断)
//   }
// ============================================================

import type { AuthContext } from '@/lib/supabase/server-admin'

// ---- Allowed enum values ----

// 将来イベント種別を絞るための型。
// P2時点で確実に使うものだけ列挙 (P6で必要になったら追加)。
export type PlatformAuditAction =
  | 'company.provisioning.started'
  | 'company.provisioning.completed'
  | 'company.provisioning.failed'
  | 'admin.invitation.sent'
  | 'admin.invitation.failed'
  | 'admin.profile_linked'

export type PlatformAuditStatus = 'started' | 'success' | 'failure'

export type PlatformAuditTargetType = 'company' | 'auth_user' | 'profile'

// ---- Metadata sanitization ----

// 機密 key (大小文字問わず、部分一致含む)。
// このリストにマッチする key は metadata から除去してから INSERT。
const FORBIDDEN_METADATA_KEYS = [
  'password',
  'passwd',
  'token',
  'access_token',
  'refresh_token',
  'invite_token',
  'invite_url',
  'authorization',
  'auth_header',
  'cookie',
  'set-cookie',
  'secret',
  'service_role',
  'service_role_key',
  'api_key',
  'apikey',
  'session',
  'bearer',
] as const

/**
 * metadata から機密 key を除去する。
 * - key名の大小文字を無視
 * - 部分一致 (例: 'user_password' → password含むため除去)
 * - trueshallow (最上位keyのみ検査 — nested object は原則使わない設計)
 *
 * export しているのは helper単体テストのため。
 */
export function sanitizeAuditMetadata(
  input: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!input || typeof input !== 'object') return null

  const cleaned: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    const lower = key.toLowerCase()
    const forbidden = FORBIDDEN_METADATA_KEYS.some(f => lower.includes(f))
    if (forbidden) continue
    cleaned[key] = value
  }

  // 何も残らなければ null で保存 (空 object を残さない)
  return Object.keys(cleaned).length === 0 ? null : cleaned
}

// ---- Input & Result types ----

export interface WritePlatformAuditInput {
  action:      PlatformAuditAction | string   // stringも許容 (将来拡張)
  status:      PlatformAuditStatus
  targetType?: PlatformAuditTargetType | string | null
  targetId?:   string | null
  requestId?:  string | null
  metadata?:   Record<string, unknown> | null
}

export interface WritePlatformAuditResult {
  ok:    boolean
  id?:   string
  error?: string
}

// ---- Main helper ----

/**
 * Provisioning Audit を1件 append する。
 *
 * 呼び出し側契約:
 *   - auth は getAuthContext() 由来 (Client-suppliedであってはならない)
 *   - actorUserId は auth.userId のみ使用 (引数に user_id を取らない)
 *   - metadata の機密 key は自動除去される
 *
 * 失敗時:
 *   - { ok: false, error } を返却
 *   - throw しない (呼び出し側のProvisioning処理を破壊しない)
 */
export async function writePlatformAudit(
  auth: AuthContext,
  input: WritePlatformAuditInput,
): Promise<WritePlatformAuditResult> {
  if (!auth?.userId) {
    return { ok: false, error: 'actor_user_id missing (auth context invalid)' }
  }

  if (!input.action) {
    return { ok: false, error: 'action required' }
  }

  if (!input.status) {
    return { ok: false, error: 'status required' }
  }

  const cleanedMetadata = sanitizeAuditMetadata(input.metadata ?? null)

  const row = {
    actor_user_id: auth.userId,
    action:        input.action,
    target_type:   input.targetType ?? null,
    target_id:     input.targetId   ?? null,
    status:        input.status,
    request_id:    input.requestId  ?? null,
    metadata:      cleanedMetadata,
  }

  const { data, error } = await auth.adminClient
    .from('platform_audit_logs')
    .insert(row as never)
    .select('id')
    .single()

  if (error) {
    // 呼び出し側で判断できるよう ok=false を返却。
    // ここで console.error は出すが throw しない。
    console.error('[platform-audit] insert failed:', input.action, error.code, error.message)
    return { ok: false, error: error.message }
  }

  const row_id = (data as { id?: string } | null)?.id
  return { ok: true, id: row_id }
}
