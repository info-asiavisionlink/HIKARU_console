'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FolderOpen, FileText, Bell, History, X, FileSpreadsheet,
} from 'lucide-react'

const GOLD = 'oklch(0.73 0.12 78)'
const SIDEBAR_BG = 'oklch(0.05 0.003 260)'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
}

const navItems: NavItem[] = [
  { label: 'ダッシュボード', href: '/dashboard',      icon: LayoutDashboard },
  { label: '案件一覧',       href: '/projects',       icon: FolderOpen },
  { label: '報告書履歴',     href: '/reports',        icon: FileText },
  { label: '請求・書類',     href: '/invoices',       icon: FileSpreadsheet },
  { label: '通知',           href: '/notifications',  icon: Bell },
]

interface PortalSidebarProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function PortalSidebar({ mobileOpen = false, onMobileClose }: PortalSidebarProps) {
  const pathname = usePathname()

  React.useEffect(() => {
    onMobileClose?.()
  }, [pathname]) // eslint-disable-line

  const content = (
    <aside
      className="fixed left-0 top-0 h-full flex flex-col"
      style={{
        width: 'var(--sidebar-width)',
        background: SIDEBAR_BG,
        borderRight: `1px solid ${GOLD}22`,
        zIndex: 'var(--z-sticky)',
      }}
    >
      {/* ロゴ */}
      <div
        className="flex items-center gap-3 px-6 shrink-0"
        style={{
          height: 'var(--header-height)',
          borderBottom: `1px solid ${GOLD}18`,
        }}
      >
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0"
          style={{
            background: `linear-gradient(135deg, oklch(0.52 0.10 75) 0%, ${GOLD} 50%, oklch(0.88 0.13 78) 100%)`,
            boxShadow: `0 0 14px ${GOLD}60`,
          }}
        >
          <span className="text-sm font-black" style={{ color: 'oklch(0.06 0.003 260)' }}>H</span>
        </div>
        <div>
          <p className="text-sm font-bold leading-tight" style={{ color: GOLD }}>HIKARU</p>
          <p className="text-[10px] leading-tight" style={{ color: 'oklch(0.45 0.007 60)' }}>Client Portal</p>
        </div>
        {/* Mobile close */}
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="ml-auto md:hidden p-1 rounded opacity-60 hover:opacity-100"
            style={{ color: 'oklch(0.60 0.010 75)' }}
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
              style={{
                background: active ? `${GOLD}14` : 'transparent',
                color: active ? GOLD : 'oklch(0.60 0.010 75)',
                border: active ? `1px solid ${GOLD}28` : '1px solid transparent',
              }}
            >
              <item.icon
                className="h-4 w-4 shrink-0"
                style={{ filter: active ? `drop-shadow(0 0 5px ${GOLD}99)` : 'none' }}
              />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Gold divider */}
      <div style={{ height: '1px', background: `linear-gradient(90deg, transparent, ${GOLD}30, transparent)`, margin: '0 16px' }} />

      {/* Footer */}
      <div className="p-4">
        <p className="text-[10px] text-center" style={{ color: 'oklch(0.32 0.005 60)' }}>
          © 2025 HIKARU
        </p>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block">{content}</div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-[var(--z-overlay)]">
          <div
            className="absolute inset-0"
            style={{ background: 'rgb(0 0 0 / 0.7)' }}
            onClick={onMobileClose}
          />
          <div className="relative h-full" style={{ width: 'var(--sidebar-width)' }}>
            {content}
          </div>
        </div>
      )}
    </>
  )
}
