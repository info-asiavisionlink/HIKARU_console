'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { Button, Input, Alert, cn } from '@hikaru/ui'
import { setPasswordAction } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" loading={pending} className="w-full">
      {!pending && <KeyRound className="h-4 w-4" />}
      {pending ? '設定中...' : 'パスワードを設定してHIKARUを使い始める'}
    </Button>
  )
}

export default function SetPasswordPage() {
  const [state, formAction] = useActionState(setPasswordAction, { error: null })
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Brand */}
      <div className="flex flex-col items-center gap-2 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-xl)]"
          style={{ background: 'var(--color-primary)' }}
        >
          <span className="text-xl font-bold text-white">H</span>
        </div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">
          HIKARUへようこそ
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          初回パスワードを設定してください
        </p>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-sm rounded-[var(--radius-xl)] border border-[var(--color-border)]
                   bg-[var(--color-surface)] p-7 shadow-[var(--shadow-md)]"
      >
        <form action={formAction} className="flex flex-col gap-4">
          {state.error && <Alert variant="error">{state.error}</Alert>}

          <Input
            name="password"
            type={showPw ? 'text' : 'password'}
            label="新しいパスワード"
            placeholder="8文字以上"
            autoComplete="new-password"
            required
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPw((p) => !p)}
                className={cn(
                  'rounded-sm p-0.5 text-[var(--color-muted-foreground)]',
                  'hover:text-[var(--color-foreground)] transition-colors focus:outline-none'
                )}
                aria-label={showPw ? 'パスワードを隠す' : 'パスワードを表示'}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />

          <Input
            name="confirmPassword"
            type={showConfirm ? 'text' : 'password'}
            label="パスワードの確認"
            placeholder="もう一度入力"
            autoComplete="new-password"
            required
            rightIcon={
              <button
                type="button"
                onClick={() => setShowConfirm((p) => !p)}
                className={cn(
                  'rounded-sm p-0.5 text-[var(--color-muted-foreground)]',
                  'hover:text-[var(--color-foreground)] transition-colors focus:outline-none'
                )}
                aria-label={showConfirm ? 'パスワードを隠す' : 'パスワードを表示'}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />

          <SubmitButton />
        </form>
      </div>

      <p className="text-xs text-center text-[var(--color-muted-foreground)]">
        設定後、HIKARUの初期設定画面へ移動します。
      </p>
    </div>
  )
}
