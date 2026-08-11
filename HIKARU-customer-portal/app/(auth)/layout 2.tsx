export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-dvh flex items-center justify-center p-4"
      style={{
        background: 'oklch(0.06 0.004 260)',
        backgroundImage: `
          radial-gradient(ellipse 80% 60% at 50% -10%, oklch(0.73 0.12 78 / 0.06) 0%, transparent 55%),
          radial-gradient(ellipse 40% 40% at 95% 95%, oklch(0.52 0.10 75 / 0.04) 0%, transparent 45%)
        `,
      }}
    >
      {children}
    </div>
  )
}
