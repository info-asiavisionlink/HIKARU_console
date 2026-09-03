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
//   - DB error 時は null 返却 + console.error logging
//     (呼び出し側で fallback 判断できるようにする)
//   - API contract (5 parallel COUNTs, companies fetch, computeReadiness)
//     は /api/setup-status と完全同一
// ============================================================

import { computeReadiness, type SetupCounts, type SetupStatus } from './readiness'
import type { SupabaseClient } from '@supabase/supabase-js'

// 呼び出し側は typed (createAdminClient → SupabaseClient<Database>) と
// 非typed (getAuthContext.adminClient) の両方が存在する。
// Helper 内では table 名 / column 名を string literal で使うだけで、
// generic の Database 情報は不要なため受口を広げる。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, any, any>

/**
 * 指定 companyId の Setup Status を取得する。
 * DB error は null 返却 (呼び出し側で fallback destination 決定)。
 */
export async function getSetupStatus(
  companyId: string,
  adminClient: AdminClient,
): Promise<SetupStatus | null> {
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
    return null
  }
  if (storesRes.error) {
    console.error('[setup-status] stores count failed:', storesRes.error.code, storesRes.error.message)
    return null
  }
  if (employeesRes.error) {
    console.error('[setup-status] employees count failed:', employeesRes.error.code, employeesRes.error.message)
    return null
  }
  if (projectsRes.error) {
    console.error('[setup-status] projects count failed:', projectsRes.error.code, projectsRes.error.message)
    return null
  }
  if (companyRes.error || !companyRes.data) {
    console.error('[setup-status] company fetch failed:', companyRes.error?.code, companyRes.error?.message)
    return null
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
    company: {
      name:  companyName,
      ready: readiness.companyReady,
    },
    counts,
    readiness,
  }
}
