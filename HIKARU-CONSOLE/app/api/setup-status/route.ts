import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { computeReadiness, type SetupCounts } from '@/lib/setup/readiness'

// GET /api/setup-status
//
// Returns the company's current HIKARU initial setup status.
// Derives all state from existing Business Data — no dedicated setup table.
//
// Design:
//   - company_id sourced exclusively from authenticated session (never request body/params)
//   - 5 parallel COUNT queries (no full row SELECT)
//   - DB errors surfaced as 500, not silently treated as 0
//   - OpenAI: 0, Polling: 0, Realtime: 0, N+1: 0
//   - No PII in response (counts only, no names/emails/etc.)
//
// COUNT active conditions:
//   clients:   is_active = true
//   stores:    is_active = true
//   employees: status    = 'active'
//   projects:  status    = 'active'
//
// Readiness rules (from formal spec):
//   COMPANY_READY  = company.name trim non-empty
//   ACCOUNT_READY  = COMPANY_READY  (auth + company_id guaranteed by getAuthContext)
//   BUSINESS_READY = ACCOUNT_READY && CLIENT_READY && EMPLOYEE_READY
//   OPERATION_READY= BUSINESS_READY && PROJECT_READY
//   STORE_READY is NOT required for BUSINESS/OPERATION_READY (store_id nullable in projects)
export async function GET() {
  // 1. Auth + company_id (always from session, never from request)
  const auth = await getAuthContext()
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { companyId, adminClient } = auth

  // 2. Parallel COUNT queries — company_id scoped → no cross-tenant data
  // { count: 'exact', head: true }: HEAD request to PostgREST, returns count header only.
  // No data rows are returned, minimizing payload.
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

  // 3. Surface DB errors — do NOT silently treat errors as count=0
  if (clientsRes.error) {
    console.error('[setup-status] clients count failed:', clientsRes.error.code, clientsRes.error.message)
    return NextResponse.json({ error: 'Failed to count clients', code: 'DB_ERROR' }, { status: 500 })
  }
  if (storesRes.error) {
    console.error('[setup-status] stores count failed:', storesRes.error.code, storesRes.error.message)
    return NextResponse.json({ error: 'Failed to count stores', code: 'DB_ERROR' }, { status: 500 })
  }
  if (employeesRes.error) {
    console.error('[setup-status] employees count failed:', employeesRes.error.code, employeesRes.error.message)
    return NextResponse.json({ error: 'Failed to count employees', code: 'DB_ERROR' }, { status: 500 })
  }
  if (projectsRes.error) {
    console.error('[setup-status] projects count failed:', projectsRes.error.code, projectsRes.error.message)
    return NextResponse.json({ error: 'Failed to count projects', code: 'DB_ERROR' }, { status: 500 })
  }
  if (companyRes.error || !companyRes.data) {
    console.error('[setup-status] company fetch failed:', companyRes.error?.code, companyRes.error?.message)
    return NextResponse.json({ error: 'Company record not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 })
  }

  // 4. Assemble counts (count is null only if there was an error, which we checked above)
  const counts: SetupCounts = {
    clients:   clientsRes.count   ?? 0,
    stores:    storesRes.count    ?? 0,
    employees: employeesRes.count ?? 0,
    projects:  projectsRes.count  ?? 0,
  }

  // 5. Compute readiness deterministically (pure function, no AI)
  const companyName = (companyRes.data as { name: string | null }).name
  const readiness   = computeReadiness(companyName, counts)

  // 6. Return — no PII (no names, emails, or identifiable data beyond counts)
  return NextResponse.json({
    company: {
      name:  companyName,
      ready: readiness.companyReady,
    },
    counts,
    readiness,
  })
}
