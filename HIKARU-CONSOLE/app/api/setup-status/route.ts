import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { getSetupStatus } from '@/lib/setup/get-setup-status'

// GET /api/setup-status
//
// Returns the company's current HIKARU initial setup status.
// Derives all state from existing Business Data — no dedicated setup table.
//
// Design:
//   - company_id sourced exclusively from authenticated session (never request body/params)
//   - Delegates to lib/setup/get-setup-status.ts so loginAction can reuse the same logic
//     without an HTTP round-trip.
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
  const auth = await getAuthContext()
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await getSetupStatus(auth.companyId, auth.adminClient)
  if (!result.ok) {
    if (result.reason === 'COMPANY_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Company record not found', code: 'COMPANY_NOT_FOUND' },
        { status: 404 },
      )
    }
    return NextResponse.json(
      { error: 'Failed to fetch setup status', code: 'DB_ERROR' },
      { status: 500 },
    )
  }

  return NextResponse.json(result.status)
}
