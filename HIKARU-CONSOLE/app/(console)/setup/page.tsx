// ============================================================
// /setup — Legacy redirect (Initial Setup UI 撤去 2026-09)
//
// 目的:
//   古い bookmark / ブラウザ履歴 / /api/setup-status 由来のリンク互換維持のため、
//   /setup へのアクセスを /dashboard へ server-side redirect する薄い page。
//
// 経緯:
//   NECESSITY AUDIT (2026-09) の結論:
//     Initial Setup UI は「案内 dashboard」であり独自 DB write を持たない。
//     全 CTA が通常画面 (/{entity}/new) or /settings/import への Link のみ。
//     業務機能 100% 委譲済のため UI 撤去可、readiness helper は将来利用のため
//     初期は残す判断だったが、UI + login 分岐 + SetupBanner 全 removal で
//     内部使用も 0 になり、関連 core (get-setup-status.ts / readiness.ts /
//     return-to.ts / /api/setup-status) を同時 dead code として削除。
//
//   本 file だけは URL 互換維持のため redirect page として残す。
// ============================================================

import { redirect } from 'next/navigation'

export default function SetupRedirectPage() {
  redirect('/dashboard')
}
