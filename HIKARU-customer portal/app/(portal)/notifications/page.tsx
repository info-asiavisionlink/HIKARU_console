'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell, CheckCheck, Activity, FileText, Star, AlertTriangle, Info } from 'lucide-react'

const GOLD = 'oklch(0.73 0.12 78)'
const TEXT_MUTED = 'oklch(0.55 0.008 60)'
const GREEN = 'oklch(0.72 0.18 150)'
const RED = 'oklch(0.65 0.25 27)'
const BLUE = 'oklch(0.68 0.20 230)'

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  job_started:       { label: '作業開始', color: GREEN, icon: Activity },
  job_completed:     { label: '作業完了', color: GREEN, icon: CheckCheck },
  report_ready:      { label: '報告書完成', color: GOLD, icon: FileText },
  quality_evaluated: { label: 'AI評価完了', color: BLUE, icon: Star },
  redo_requested:    { label: '再清掃', color: RED, icon: AlertTriangle },
  info:              { label: 'お知らせ', color: TEXT_MUTED, icon: Info },
}

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  is_read: boolean
  created_at: string
  job_id: string | null
  project_id: string | null
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = React.useState<Notification[]>([])
  const [loading, setLoading] = React.useState(true)
  const [portalAccountId, setPortalAccountId] = React.useState<string | null>(null)

  React.useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: account } = await supabase
        .from('client_portal_accounts')
        .select('id')
        .eq('profile_id', user.id)
        .single()

      if (!account) return
      setPortalAccountId(account.id)

      const { data } = await supabase
        .from('client_notifications')
        .select('*')
        .eq('portal_account_id', account.id)
        .order('created_at', { ascending: false })
        .limit(50)

      setNotifications((data as Notification[]) ?? [])
      setLoading(false)

      // Realtime
      const channel = supabase
        .channel('notifications-page')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'client_notifications',
          filter: `portal_account_id=eq.${account.id}`,
        }, (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev])
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'client_notifications',
          filter: `portal_account_id=eq.${account.id}`,
        }, (payload) => {
          setNotifications((prev) =>
            prev.map((n) => n.id === (payload.new as Notification).id ? (payload.new as Notification) : n)
          )
        })
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    }

    load()
  }, [])

  async function markAllRead() {
    if (!portalAccountId) return
    const supabase = createClient()
    await supabase
      .from('client_notifications')
      .update({ is_read: true })
      .eq('portal_account_id', portalAccountId)
      .eq('is_read', false)

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  async function markRead(id: string) {
    const supabase = createClient()
    await supabase
      .from('client_notifications')
      .update({ is_read: true })
      .eq('id', id)

    setNotifications((prev) =>
      prev.map((n) => n.id === id ? { ...n, is_read: true } : n)
    )
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <div className="space-y-6 animate-[slide-up_0.4s_ease-out]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'oklch(0.90 0.008 75)' }}>通知</h1>
          {unreadCount > 0 && (
            <p className="text-sm mt-1" style={{ color: TEXT_MUTED }}>
              未読 <span style={{ color: GOLD }}>{unreadCount}</span> 件
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
            style={{
              background: `${GOLD}12`,
              border: `1px solid ${GOLD}25`,
              color: GOLD,
            }}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            すべて既読
          </button>
        )}
      </div>

      <div style={{ height: '1px', background: `linear-gradient(90deg, ${GOLD}50, transparent)` }} />

      {loading ? (
        <div className="flex justify-center py-20">
          <div
            className="h-8 w-8 rounded-full border-2 animate-spin"
            style={{ borderColor: `${GOLD} transparent transparent transparent` }}
          />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Bell className="h-16 w-16 opacity-15" style={{ color: GOLD }} />
          <p className="text-sm" style={{ color: TEXT_MUTED }}>通知はありません</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info
            const Icon = cfg.icon

            return (
              <div
                key={n.id}
                onClick={() => !n.is_read && markRead(n.id)}
                className="flex items-start gap-4 p-4 rounded-2xl transition-all duration-200 cursor-pointer hover:scale-[1.005]"
                style={{
                  background: n.is_read ? 'oklch(0.09 0.005 255 / 0.65)' : 'oklch(0.10 0.005 255 / 0.92)',
                  border: `1px solid ${n.is_read ? GOLD + '10' : GOLD + '25'}`,
                }}
              >
                {/* アイコン */}
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0 mt-0.5"
                  style={{
                    background: `${cfg.color}14`,
                    border: `1px solid ${cfg.color}30`,
                  }}
                >
                  <Icon className="h-5 w-5" style={{ color: cfg.color }} />
                </div>

                {/* コンテンツ */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{
                            background: `${cfg.color}14`,
                            color: cfg.color,
                            border: `1px solid ${cfg.color}25`,
                          }}
                        >
                          {cfg.label}
                        </span>
                        {!n.is_read && (
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: GOLD, boxShadow: `0 0 4px ${GOLD}80` }}
                          />
                        )}
                      </div>
                      <p
                        className="text-sm font-medium"
                        style={{ color: n.is_read ? 'oklch(0.60 0.007 60)' : 'oklch(0.88 0.007 60)' }}
                      >
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs mt-0.5" style={{ color: TEXT_MUTED }}>{n.body}</p>
                      )}
                    </div>
                    <p className="text-[10px] shrink-0 mt-0.5" style={{ color: 'oklch(0.38 0.005 60)' }}>
                      {new Date(n.created_at).toLocaleString('ja-JP', {
                        month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
