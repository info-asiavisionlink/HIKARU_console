import * as React from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { PortalSidebar } from '@/components/layouts/PortalSidebar'
import { PortalHeader } from '@/components/layouts/PortalHeader'
import { PortalClientShell } from './PortalClientShell'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const uid = cookieStore.get('hk_cp_uid')?.value

  if (!uid) redirect('/login')

  const admin = createAdminClient()
  const { data: portalAccount } = await admin
    .from('client_portal_accounts')
    .select(`
      id,
      contact_name,
      is_active,
      clients ( name )
    `)
    .eq('profile_id', uid)
    .single()

  if (!portalAccount || !portalAccount.is_active) redirect('/login')

  const { count: unreadCount } = await admin
    .from('client_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('portal_account_id', portalAccount.id)
    .eq('is_read', false)

  const clientName  = (portalAccount.clients as any)?.name ?? ''
  const contactName = portalAccount.contact_name

  return (
    <PortalClientShell
      clientName={clientName}
      contactName={contactName}
      unreadCount={unreadCount ?? 0}
    >
      {children}
    </PortalClientShell>
  )
}
