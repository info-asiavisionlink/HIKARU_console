// ============================================================
// HIKARU Import — Shared API Helpers
//
// 全Import APIで再利用する共通処理:
//   - Admin権限チェック (seal/route.tsと同パターン)
//   - Session ownership検証
//   - Audit log (non-blocking fire-and-forget)
//   - 入力値バリデーション定数
// ============================================================

import type { AuthContext } from '@/lib/supabase/server-admin'
import type { ImportEntityType, ImportSourceType } from '@/types/import'

// Uploadを許可するSessionの状態
export const UPLOAD_ALLOWED_STATES = ['created'] as const
export type UploadAllowedState = (typeof UPLOAD_ALLOWED_STATES)[number]

// 有効なEnum値
export const VALID_ENTITY_TYPES: readonly ImportEntityType[] = [
  'client', 'store', 'employee', 'project', 'invoice', 'expense',
] as const

export const VALID_SOURCE_TYPES: readonly ImportSourceType[] = ['csv', 'xlsx'] as const

// Session一覧の取得上限
export const SESSION_LIST_LIMIT = 50

// ---- Admin Check ----
// seal/route.ts と同パターン。全Import APIで Admin専用を強制。
export async function requireAdmin(auth: AuthContext): Promise<boolean> {
  const { data } = await auth.adminClient
    .from('profiles')
    .select('role')
    .eq('id', auth.userId)
    .single()
  return (data as { role?: string } | null)?.role === 'admin'
}

// ---- Session Ownership ----
// id + company_id の両方で検索。
// 他社SessionとID不在を区別しない（情報漏洩防止）。
export async function getOwnedSession(
  auth: AuthContext,
  sessionId: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await auth.adminClient
    .from('import_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('company_id', auth.companyId)
    .single()

  if (error || !data) return null
  return data as Record<string, unknown>
}

// ---- Non-blocking Audit Log ----
// Audit失敗はUpload全体をブロックしない。
// ファイル内容・Service Role Key・PII全文は保存しない。
export function writeAuditLog(
  auth: AuthContext,
  sessionId: string,
  action: string,
  detail?: Record<string, unknown>,
): void {
  // intentionally not awaited — fire-and-forget
  auth.adminClient
    .from('import_audit_logs')
    .insert({
      session_id: sessionId,
      company_id: auth.companyId,
      actor_id:   auth.userId,
      action,
      detail:     detail ?? null,
    } as never)
    .then(({ error }) => {
      if (error) {
        console.error('[import-audit] write failed:', action, error.code, error.message)
      }
    })
}
