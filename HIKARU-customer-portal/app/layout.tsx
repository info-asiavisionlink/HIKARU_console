import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HIKARU Client Portal',
  description: '顧客向け作業状況・報告書閲覧ポータル',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
