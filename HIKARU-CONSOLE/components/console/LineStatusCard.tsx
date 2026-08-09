'use client'

import * as React from 'react'
import { Card, CardContent, Button, toast } from '@hikaru/ui'
import { MessageCircle, Link2, Link2Off, Bell, BellOff } from 'lucide-react'

interface Props {
  entityType: 'employee' | 'partner'
  entityId: string
}

interface LineStatus {
  line_user_id: string | null
  line_notify_enabled: boolean
  has_account: boolean
}

export function LineStatusCard({ entityType, entityId }: Props) {
  const [status, setStatus]   = React.useState<LineStatus | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving]   = React.useState(false)
  const [editId, setEditId]   = React.useState('')
  const [showEdit, setShowEdit] = React.useState(false)

  const apiBase = `/api/${entityType}s/${entityId}/line`

  React.useEffect(() => {
    fetch(apiBase)
      .then((r) => r.json())
      .then((d) => { setStatus(d); setEditId(d.line_user_id ?? '') })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [apiBase])

  async function saveLineUserId() {
    setSaving(true)
    try {
      const res = await fetch(apiBase, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line_user_id: editId.trim() || null }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const json = await res.json()
      setStatus((s) => s ? { ...s, line_user_id: json.profile.line_user_id } : s)
      setShowEdit(false)
      toast.success('LINE User IDを保存しました')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  async function toggleNotify() {
    if (!status) return
    setSaving(true)
    try {
      const res = await fetch(apiBase, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line_notify_enabled: !status.line_notify_enabled }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setStatus((s) => s ? { ...s, line_notify_enabled: !s.line_notify_enabled } : s)
      toast.success('通知設定を変更しました')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '変更に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null
  if (!status?.has_account) return null

  const isLinked = Boolean(status.line_user_id)

  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
          <MessageCircle className="h-4 w-4" /> LINE連携
        </h2>

        {/* 連携状態 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isLinked
              ? <Link2    className="h-4 w-4 text-[var(--color-success)]" />
              : <Link2Off className="h-4 w-4 text-[var(--color-muted-foreground)]" />
            }
            <span className="text-sm">
              {isLinked ? (
                <span className="text-[var(--color-success)] font-medium">連携済み</span>
              ) : (
                <span className="text-[var(--color-muted-foreground)]">未連携</span>
              )}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowEdit((v) => !v)}>
            {showEdit ? 'キャンセル' : isLinked ? '変更' : 'IDを登録'}
          </Button>
        </div>

        {isLinked && (
          <p className="text-xs text-[var(--color-muted-foreground)] font-mono">
            {status.line_user_id}
          </p>
        )}

        {/* User ID入力フォーム */}
        {showEdit && (
          <div className="space-y-2 border-t border-[var(--color-border)] pt-3">
            <label className="text-xs text-[var(--color-muted-foreground)]">LINE User ID</label>
            <input
              type="text"
              value={editId}
              onChange={(e) => setEditId(e.target.value)}
              placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
            <Button size="sm" onClick={saveLineUserId} disabled={saving}>
              保存
            </Button>
          </div>
        )}

        {/* 通知ON/OFF */}
        {isLinked && (
          <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3">
            <div className="flex items-center gap-2">
              {status.line_notify_enabled
                ? <Bell    className="h-4 w-4 text-[var(--color-primary)]" />
                : <BellOff className="h-4 w-4 text-[var(--color-muted-foreground)]" />
              }
              <span className="text-sm">
                LINE通知
                <span className={status.line_notify_enabled
                  ? 'text-[var(--color-success)] font-medium'
                  : 'text-[var(--color-muted-foreground)]'
                }>
                  {status.line_notify_enabled ? 'ON' : 'OFF'}
                </span>
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleNotify}
              disabled={saving}
            >
              {status.line_notify_enabled ? 'OFFにする' : 'ONにする'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
