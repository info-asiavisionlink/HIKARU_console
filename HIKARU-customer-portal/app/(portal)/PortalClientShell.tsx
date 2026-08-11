'use client'

import * as React from 'react'
import { PortalSidebar } from '@/components/layouts/PortalSidebar'
import { PortalHeader } from '@/components/layouts/PortalHeader'

interface Props {
  children: React.ReactNode
  clientName: string
  contactName: string
  unreadCount: number
}

export function PortalClientShell({ children, clientName, contactName, unreadCount }: Props) {
  const [mobileOpen, setMobileOpen] = React.useState(false)

  return (
    <>
      <PortalSidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <PortalHeader
        clientName={clientName}
        contactName={contactName}
        unreadCount={unreadCount}
        onMobileMenuClick={() => setMobileOpen(true)}
      />

      <main
        className="min-h-dvh pt-[var(--header-height)] md:pl-[var(--sidebar-width)]"
      >
        <div className="p-4 md:p-6 max-w-[var(--content-max-width)] mx-auto">
          {children}
        </div>
      </main>
    </>
  )
}
