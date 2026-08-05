'use client'

import * as React from 'react'
import { Sidebar } from './Sidebar'
import { ConsoleHeader } from './ConsoleHeader'
import { Toaster, HudBackground, cn } from '@hikaru/ui'

interface ConsoleLayoutProps {
  children: React.ReactNode
}

function Background() {
  return (
    <>
      {/* パーティクル＋スキャンライン（sidebar/header: z-200 の下、body背景の上） */}
      <HudBackground particleCount={50} showGrid zIndex={1} />
      {/* ゴールドグロー（上部）*/}
      <div
        className="fixed top-0 left-0 right-0 h-[40vh] pointer-events-none"
        style={{
          zIndex: 2,
          background: 'radial-gradient(ellipse 60% 100% at 50% 0%, oklch(0.73 0.12 78 / 0.06) 0%, transparent 100%)',
        }}
      />
      {/* シアングロー（右下） */}
      <div
        className="fixed bottom-0 right-0 w-[50vw] h-[40vh] pointer-events-none"
        style={{
          zIndex: 2,
          background: 'radial-gradient(ellipse 100% 100% at 100% 100%, oklch(0.60 0.28 260 / 0.05) 0%, transparent 70%)',
        }}
      />
    </>
  )
}

export function ConsoleLayout({ children }: ConsoleLayoutProps) {
  const [collapsed, setCollapsed] = React.useState(false)

  const sidebarWidth = collapsed
    ? 'var(--sidebar-collapsed-width)'
    : 'var(--sidebar-width)'

  return (
    <>
      {/* パーティクル背景（全コンソールページ共通） */}
      <Background />

      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((p) => !p)}
      />
      <ConsoleHeader sidebarWidth={sidebarWidth} />
      <main
        className={cn('min-h-dvh pt-[var(--header-height)] transition-all duration-300')}
        style={{ paddingLeft: sidebarWidth }}
      >
        <div className="p-6 max-w-[var(--content-max-width)] mx-auto">
          {children}
        </div>
      </main>
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          classNames: {
            toast: 'rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)]',
          },
          style: {
            background: 'oklch(0.10 0.006 255 / 0.96)',
            backdropFilter: 'blur(24px)',
            border: '1px solid oklch(0.73 0.12 78 / 0.25)',
            color: 'oklch(0.88 0.008 75)',
          },
        }}
      />
    </>
  )
}
