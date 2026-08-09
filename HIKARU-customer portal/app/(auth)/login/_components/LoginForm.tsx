'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { loginAction } from '../actions'

const GOLD = 'oklch(0.73 0.12 78)'
const GOLD_MUTED = 'oklch(0.73 0.12 78 / 0.12)'
const GOLD_BORDER = 'oklch(0.73 0.12 78 / 0.30)'
const TEXT = 'oklch(0.88 0.006 60)'
const TEXT_MUTED = 'oklch(0.55 0.008 60)'
const SURFACE = 'oklch(0.10 0.005 255 / 0.85)'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-60"
      style={{
        background: pending
          ? GOLD_MUTED
          : `linear-gradient(135deg, oklch(0.52 0.10 75) 0%, ${GOLD} 50%, oklch(0.88 0.13 78) 100%)`,
        color: 'oklch(0.08 0.005 60)',
        boxShadow: pending ? 'none' : `0 0 20px ${GOLD}4d, 0 4px 16px rgb(0 0 0 / 0.4)`,
      }}
    >
      {pending ? (
        <span
          className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin"
          style={{ borderColor: `${GOLD} transparent transparent transparent` }}
        />
      ) : (
        <LogIn className="h-4 w-4" />
      )}
      {pending ? '認証中...' : 'ログイン'}
    </button>
  )
}

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, { error: null })
  const [showPassword, setShowPassword] = useState(false)

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.error && (
        <div
          className="rounded-xl p-4 text-sm"
          style={{
            background: 'oklch(0.65 0.25 27 / 0.12)',
            border: '1px solid oklch(0.65 0.25 27 / 0.35)',
            color: 'oklch(0.78 0.18 30)',
          }}
        >
          {state.error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: TEXT_MUTED }}>
          ログインID
        </label>
        <input
          name="loginId"
          type="text"
          placeholder="CLT-0001"
          autoComplete="username"
          required
          className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
          style={{
            background: SURFACE,
            border: `1px solid ${GOLD_BORDER}`,
            color: TEXT,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = GOLD
            e.currentTarget.style.boxShadow = `0 0 0 3px ${GOLD_MUTED}`
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = GOLD_BORDER
            e.currentTarget.style.boxShadow = 'none'
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: TEXT_MUTED }}>
          パスワード
        </label>
        <div className="relative">
          <input
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="current-password"
            required
            className="w-full px-4 py-3 pr-12 rounded-xl text-sm outline-none transition-all duration-200"
            style={{
              background: SURFACE,
              border: `1px solid ${GOLD_BORDER}`,
              color: TEXT,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = GOLD
              e.currentTarget.style.boxShadow = `0 0 0 3px ${GOLD_MUTED}`
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = GOLD_BORDER
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((p) => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded transition-opacity hover:opacity-80"
            style={{ color: TEXT_MUTED }}
            aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <SubmitButton />

      <p className="text-center text-xs" style={{ color: TEXT_MUTED }}>
        ログインIDをお忘れの場合は担当者へご連絡ください。
      </p>
    </form>
  )
}
