'use client'

import * as React from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
  Button,
} from '@hikaru/ui'
import { Trash2 } from 'lucide-react'

interface ConfirmDeleteDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
  title?: string
  description?: string
}

export function ConfirmDeleteDialog({
  open,
  onClose,
  onConfirm,
  title = '削除しますか？',
  description = 'この操作は取り消せません。',
}: ConfirmDeleteDialogProps) {
  const [loading, setLoading] = React.useState(false)

  async function handleConfirm() {
    setLoading(true)
    try {
      await onConfirm()
    } catch {
      // エラーは呼び出し元で処理済み
    } finally {
      setLoading(false)
      onClose()
    }
  }

  // ダイアログが閉じるときにloading状態をリセット
  function handleOpenChange(o: boolean) {
    if (!o && !loading) onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showClose={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-[var(--color-error-foreground)]" />
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            キャンセル
          </Button>
          <Button variant="destructive" onClick={handleConfirm} loading={loading}>
            {loading ? '削除中...' : '削除する'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
