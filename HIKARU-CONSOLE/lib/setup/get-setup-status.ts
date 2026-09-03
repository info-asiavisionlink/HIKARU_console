// ============================================================
// HIKARU Initial Setup — Server-side Status Fetch
//
// 目的:
//   /api/setup-status と loginAction で共有する
//   Setup status 取得ロジックを1箇所へ集約。
//
// 契約:
//   - companyId は auth 済み context から取得された Server 側検証済み値のみを受け取る
//     (Browser 供給禁止, 呼び出し側責任)
//   - adminClient は既存 getAdminClient() が返す service_role client
//   - 失敗時は reason 付き discriminated union を返す
//       * COMPANY_NOT_FOUND: companies row 欠落 → API は HTTP 404 に mapping
//       * DB_ERROR:          count query 失敗 → API は HTTP 500 に mapping
//     Login 側は reason に関係なく /dashboard fallback。
//   - 各失敗は console.error で logging (ops observability 維持)
// ============================================================

import { computeReadiness, type SetupCounts, type SetupStatus } from './readiness'
import type { SupabaseClient } from '@supabase/supabase-js'

// 呼び出し側は typed (createAdminClient → SupabaseClient<Database>) と
// 非typed (getAuthContext.adminClient) の両方が存在する。
// Helper 内では table 名 / column 名を string literal で使うだけで、
// generic の Database 情報は不要なため受口を広げる。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, any, any>

export type SetupStatusFailureReason = 'COMPANY_NOT_FOUND' | 'DB_ERROR'

export type SetupStatusResult =
  | { ok: true;  status: SetupStatus }
  | { ok: false; reason: SetupStatusFailureReason }

/**
 * 指定 companyId の Setup Status を取得する。
 * 失敗理由は API HTTP status への正確な mapping に必要なため、
 * discriminated union で返却する。
 */
export async function getSetupStatus(
  companyId: string,
  adminClient: AdminClient,
): Promise<SetupStatusResult> {
  const [clientsRes, storesRes, employeesRes, projectsRes, companyRes] = await Promise.all([
    adminClient
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('is_active', true),

    adminClient
      .from('stores')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('is_active', true),

    adminClient
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'active'),

    adminClient
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'active'),

    adminClient
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single(),
  ])

  if (clientsRes.error) {
    console.error('[setup-status] clients count failed:', clientsRes.error.code, clientsRes.error.message)
    return { ok: false, reason: 'DB_ERROR' }
  }
  if (storesRes.error) {
    console.error('[setup-status] stores count failed:', storesRes.error.code, storesRes.error.message)
    return { ok: false, reason: 'DB_ERROR' }
  }
  if (employeesRes.error) {
    console.error('[setup-status] employees count failed:', employeesRes.error.code, employeesRes.error.message)
    return { ok: false, reason: 'DB_ERROR' }
  }
  if (projectsRes.error) {
    console.error('[setup-status] projects count failed:', projectsRes.error.code, projectsRes.error.message)
    return { ok: false, reason: 'DB_ERROR' }
  }
  // Supabase `.single()` は 0 rows の場合 PGRST116 を返す。
  // それ以外の error code は permission / network / query error の可能性があるため
  // DB_ERROR として区別する (ops monitoring の精度維持)。
  if (companyRes.error) {
    console.error('[setup-status] company fetch failed:', companyRes.error.code, companyRes.error.message)
    return companyRes.error.code === 'PGRST116'
      ? { ok: false, reason: 'COMPANY_NOT_FOUND' }
      : { ok: false, reason: 'DB_ERROR' }
  }
  if (!companyRes.data) {
    console.error('[setup-status] company fetch returned no data (unexpected)')
    return { ok: false, reason: 'COMPANY_NOT_FOUND' }
  }

  const counts: SetupCounts = {
    clients:   clientsRes.count   ?? 0,
    stores:    storesRes.count    ?? 0,
    employees: employeesRes.count ?? 0,
    projects:  projectsRes.count  ?? 0,
  }

  const companyName = (companyRes.data as { name: string | null }).name
  const readiness   = computeReadiness(companyName, counts)

  return {
    ok: true,
    status: {
      company: {
        name:  companyName,
        ready: readiness.companyReady,
      },
      counts,
      readiness,
    },
  }
}
