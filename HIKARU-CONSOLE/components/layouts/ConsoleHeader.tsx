'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Cpu, Menu, FilePen, CheckCheck } from 'lucide-react'
import {
  Avatar, AvatarFallback, AvatarImage,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
  cn,
} from '@hikaru/ui'
import { useAuthStore } from '@/stores/auth.store'
import { logoutAction } from '@/app/(auth)/login/actions'

type SysNotification = {
  id: string
  title: string
  body: string | null
  type: string
  is_read: boolean
  target_url: string | null
  created_at: string
}

function useSysNotifications() {
  const [notifications, setNotifications] = React.useState<SysNotification[]>([])
  const [unreadCount, setUnreadCount]     = React.useState(0)

  const fetchNotifs = React.useCallback(async () => {
    try {
      const res  = await fetch('/api/console-notifications')
      const json = await res.json()
      setNotifications(json.notifications ?? [])
      setUnreadCount(json.unread_count    ?? 0)
    } catch { /* ignore */ }
  }, [])

  React.useEffect(() => {
    fetchNotifs()
    const id = setInterval(fetchNotifs, 30000)
    return () => clearInterval(id)
  }, [fetchNotifs])

  async function markRead(notifId: string) {
    try {
      await fetch(`/api/console-notifications/${notifId}/read`, { method: 'PATCH' })
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch { /* ignore */ }
  }

  return { notifications, unreadCount, fetchNotifs, markRead }
}

interface ConsoleHeaderProps {
  sidebarWidth?: string
  onMobileMenuClick?: () => void
}

export function ConsoleHeader({
  sidebarWidth = 'var(--sidebar-width)',
  onMobileMenuClick,
}: ConsoleHeaderProps) {
  const user = useAuthStore((s) => s.user)
  const router = useRouter()
  const { notifications, unreadCount, fetchNotifs, markRead } = useSysNotifications()
  const [time, setTime] = React.useState('')
  const [date, setDate] = React.useState('')

  React.useEffect(() => {
    const update = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
      setDate(now.toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' }))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-[var(--z-sticky)]',
        'flex items-center justify-between gap-4',
        'h-[var(--header-height)] px-4',
        'transition-all duration-300',
        // モバイル: left=0、デスクトップ: サイドバー幅
        'left-0 md:left-[var(--sidebar-left)]',
      )}
      style={{
        ['--sidebar-left' as string]: sidebarWidth,
        background: 'oklch(0.05 0.002 260 / 0.92)',
        backdropFilter: 'blur(30px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(30px) saturate(1.6)',
        borderBottom: '1px solid oklch(0.73 0.12 78 / 0.15)',
      }}
    >
      {/* Gold top glow */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, oklch(0.73 0.12 78 / 0.50), transparent)' }}
      />

      {/* 左: ハンバーガー（モバイルのみ）+ システム情報 */}
      <div className="flex items-center gap-3">
        {/* ハンバーガーボタン（モバイルのみ） */}
        <button
          onClick={onMobileMenuClick}
          className="md:hidden p-2 rounded-[var(--radius)] transition-colors focus:outline-none"
          style={{ color: 'oklch(0.73 0.12 78 / 0.80)' }}
          aria-label="メニューを開く"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* AI Engine status */}
        <div className="flex items-center gap-2">
          <Cpu className="h-3.5 w-3.5" style={{ color: 'oklch(0.85 0.18 198 / 0.7)' }} />
          <span className="hidden sm:inline text-[9px] font-bold uppercase tracking-[0.25em]"
            style={{ color: 'oklch(0.85 0.18 198 / 0.60)' }}>
            AI ENGINE
          </span>
          <span className="h-1.5 w-1.5 rounded-full animate-[pulse-soft_2s_ease-in-out_infinite]"
            style={{ background: 'oklch(0.72 0.18 150)', boxShadow: '0 0 6px oklch(0.72 0.18 150)' }} />
        </div>

        {/* 日時 */}
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-[10px] font-mono tracking-wider"
            style={{ color: 'oklch(0.50 0.007 75)' }}>
            {date}
          </span>
          <span className="text-xs font-mono tracking-widest"
            style={{ color: 'oklch(0.73 0.12 78 / 0.65)' }}>
            {time}
          </span>
        </div>
      </div>

      {/* 右: アクション */}
      <div className="flex items-center gap-2">
        {/* System通知 Bell */}
        <DropdownMenu onOpenChange={(open) => { if (open) fetchNotifs() }}>
          <DropdownMenuTrigger asChild>
            <button
              className="relative rounded-[var(--radius)] p-2 transition-all duration-200 focus:outline-none"
              style={{ color: 'oklch(0.50 0.007 75)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'oklch(0.73 0.12 78)'
                e.currentTarget.style.background = 'oklch(0.73 0.12 78 / 0.08)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'oklch(0.50 0.007 75)'
                e.currentTarget.style.background = 'transparent'
              }}
              aria-label="通知"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span
                  className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
                  style={{ background: 'oklch(0.65 0.20 25)', color: 'white' }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>通知</span>
              {unreadCount > 0 && (
                <span className="text-xs font-normal" style={{ color: 'oklch(0.65 0.20 25)' }}>
                  未読 {unreadCount}件
                </span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-xs" style={{ color: 'oklch(0.50 0.007 75)' }}>
                <Bell className="h-5 w-5 mb-1 opacity-30" />
                通知はありません
              </div>
            ) : (
              notifications.slice(0, 10).map((n) => (
                <DropdownMenuItem
                  key={n.id}
                  onSelect={async () => {
                    if (!n.is_read) await markRead(n.id)
                    if (n.target_url) router.push(n.target_url)
                  }}
                  className={cn('flex flex-col items-start gap-0.5 py-2.5 cursor-pointer', !n.is_read && 'font-medium')}
                >
                  <div className="flex items-center gap-2 w-full">
                    {!n.is_read && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'oklch(0.65 0.20 25)' }} />
                    )}
                    {n.is_read && <CheckCheck className="h-3 w-3 shrink-0 opacity-30" />}
                    <span className="text-xs truncate flex-1">{n.title}</span>
                  </div>
                  {n.body && (
                    <p className="text-[10px] pl-4 line-clamp-2 whitespace-pre-line" style={{ color: 'oklch(0.55 0.007 75)' }}>
                      {n.body}
                    </p>
                  )}
                  <p className="text-[9px] pl-4" style={{ color: 'oklch(0.45 0.006 75)' }}>
                    {new Date(n.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </DropdownMenuItem>
              ))
            )}
            {notifications.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => router.push('/attendance/corrections')}
                  className="justify-center text-xs"
                >
                  <FilePen className="h-3.5 w-3.5 mr-1.5" />
                  修正申請一覧を見る
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-5 w-px" style={{ background: 'oklch(0.73 0.12 78 / 0.15)' }} />

        {/* ユーザーメニュー */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2.5 rounded-[var(--radius)] px-2 py-1.5 transition-all duration-200 focus:outline-none"
              onMouseEnter={(e) => { e.currentTarget.style.background = 'oklch(0.73 0.12 78 / 0.06)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <Avatar size="sm">
                <AvatarImage src={undefined} alt={user?.name} />
                <AvatarFallback>{user?.name?.slice(0, 2) ?? 'AD'}</AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start min-w-0">
                <span className="text-xs font-semibold truncate max-w-[120px]"
                  style={{ color: 'oklch(0.88 0.008 75)' }}>
                  {user?.name ?? '管理者'}
                </span>
                <span className="text-[9px] uppercase tracking-[0.2em]"
                  style={{ color: 'oklch(0.73 0.12 78 / 0.65)' }}>
                  ADMIN
                </span>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>{user?.email ?? 'admin@hikaru.com'}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push('/settings')}>設定</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={async () => { await logoutAction() }}>ログアウト</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
