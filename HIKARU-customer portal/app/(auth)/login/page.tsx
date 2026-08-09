import { LoginForm } from './_components/LoginForm'

const GOLD = 'oklch(0.73 0.12 78)'

export default function LoginPage() {
  return (
    <div className="w-full max-w-md">
      {/* ロゴ */}
      <div className="text-center mb-10">
        <div
          className="inline-flex h-16 w-16 items-center justify-center rounded-2xl mb-6"
          style={{
            background: `linear-gradient(135deg, oklch(0.52 0.10 75) 0%, ${GOLD} 50%, oklch(0.88 0.13 78) 100%)`,
            boxShadow: `0 0 30px ${GOLD}60, 0 8px 24px rgb(0 0 0 / 0.5)`,
          }}
        >
          <span
            className="text-2xl font-black"
            style={{ color: 'oklch(0.06 0.003 260)', letterSpacing: '-0.04em' }}
          >
            H
          </span>
        </div>
        <h1
          className="text-2xl font-bold mb-1"
          style={{
            background: `linear-gradient(135deg, oklch(0.62 0.11 75), oklch(0.88 0.13 78), ${GOLD})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          HIKARU Client Portal
        </h1>
        <p className="text-sm" style={{ color: 'oklch(0.50 0.008 60)' }}>
          顧客専用ポータル
        </p>
      </div>

      {/* カード */}
      <div
        className="rounded-2xl p-8"
        style={{
          background: 'oklch(0.09 0.005 255 / 0.90)',
          backdropFilter: 'blur(32px)',
          border: `1px solid ${GOLD}30`,
          boxShadow: `0 0 40px ${GOLD}0d, 0 20px 60px rgb(0 0 0 / 0.5)`,
        }}
      >
        <h2
          className="text-lg font-semibold mb-6"
          style={{ color: 'oklch(0.88 0.006 60)' }}
        >
          ログイン
        </h2>
        <LoginForm />
      </div>

      <p className="text-center text-xs mt-6" style={{ color: 'oklch(0.35 0.005 60)' }}>
        © 2025 HIKARU. All rights reserved.
      </p>
    </div>
  )
}
