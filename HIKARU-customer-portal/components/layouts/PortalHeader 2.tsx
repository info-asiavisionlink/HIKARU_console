'use client'

import * as React from 'react'
import { Menu, Bell, LogOut, Building2 } from 'lucide-react'
import { logoutAction } from '@/app/(auth)/login/actions'

const GOLD = 'oklch(0.73 0.12 78)'

interface PortalHeaderProps {
  clientName?: string
  contactName?: string
  unreadCount?: number
  onMobileMenuClick?: () => void
}

export function PortalHeader({
  clientName,
  contactName,
  unreadCount = 0,
  onMobileMenuClick,
}: PortalHeaderProps) {
  const [loggingOut, setLoggingOut] = React.useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    await logoutAction()
  }

  return (
    <header
      className="fixed top-0 right-0 left-0 md:left-[var(--sidebar-width)] flex items-center px-4 md:px-6 gap-4"
      style={{
        height: 'var(--header-height)',
        background: 'oklch(0.07 0.004 260 / 0.95)',
        backdropFilter: 'blur(24px)',
        borderBottom: `1px solid ${GOLD}18`,
        zIndex: 'var(--z-sticky)',
      }}
    >
      {/* Mobile menu */}
      <button
        className="md:hidden p-2 rounded-lg transition-colors hover:opacity-80"
        style={{ color: 'oklch(0.60 0.010 75)' }}
        onClick={onMobileMenuClick}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Client name */}
      {clientName && (
        <div className="hidden md:flex items-center gap-2">
          <Building2 className="h-4 w-4" style={{ color: `${GOLD}99` }} />
          <span className="text-sm font-medium" style={{ color: 'oklch(0.70 0.010 75)' }}>
            {clientName}
          </span>
        </div>
      )}

      <div className="flex-1" />

      {/* Notification badge */}
      {unreadCount > 0 && (
        <div className="relative">
          <Bell className="h-5 w-5" style={{ color: GOLD }} />
          <span
            className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
            style={{
              background: 'oklch(0.65 0.25 27)',
              color: 'white',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        </div>
      )}

      {/* User info */}
      {contactName && (
        <div className="hidden md:flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
            style={{
              background: `${GOLD}18`,
              border: `1px solid ${GOLD}35`,
              color: GOLD,
            }}
          >
            {contactName[0]}
          </div>
          <span className="text-sm" style={{ color: 'oklch(0.65 0.008 60)' }}>
            {contactName}
          </span>
        </div>
      )}

      {/* Logout */}
      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 disabled:opacity-50"
        style={{
          background: 'oklch(0.65 0.25 27 / 0.10)',
          border: '1px solid oklch(0.65 0.25 27 / 0.25)',
          color: 'oklch(0.72 0.18 30)',
        }}
      >
        <LogOut className="h-3.5 w-3.5" />
        ログアウト
      </button>
    </header>
  )
}
