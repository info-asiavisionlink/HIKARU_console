'use client'

import * as React from 'react'
import { SideDrawer } from './SideDrawer'
import { Toaster } from '@hikaru/ui'

interface WorkerLayoutProps {
  children: React.ReactNode
  hideBottomNav?: boolean // 後方互換性のために残す（効果なし）
}

export function WorkerLayout({ children }: WorkerLayoutProps) {
  const [drawerOpen, setDrawerOpen] = React.useState(false)

  // children に onMenuClick を注入するために Context を使う
  return (
    <MenuContext.Provider value={{ openMenu: () => setDrawerOpen(true) }}>
      <main className="min-h-dvh">
        {children}
      </main>
      <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <Toaster
        position="top-center"
        richColors
        expand={false}
        toastOptions={{
          classNames: {
            toast: 'rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)]',
          },
        }}
      />
    </MenuContext.Provider>
  )
}

// Context でメニュー開閉を子コンポーネントに伝える
export const MenuContext = React.createContext<{ openMenu: () => void }>({
  openMenu: () => {},
})

export function useMenuContext() {
  return React.useContext(MenuContext)
}
