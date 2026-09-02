// ============================================================
// HIKARU Platform API — Verified Platform Operator Helper
//
// 目的:
//   /api/platform/* エントリーポイントで、
//   Supabase Auth で cryptographic に検証された Session から
//   Platform Operator を確認する。
//
// P6 Security Gate:
//   - hk_c_uid / hk_c_role Cookie を Platform Operator authority に使わない
//     (Console middleware用の補助Cookie。Cryptographicに検証されていない)
//   - supabase.auth.getUser() の返り値 (Supabase-verified user.id) のみ使用
//   - profiles.role や user_metadata を Platform Operator authority に使わない
//   - platform_operators テーブルの存在のみ authority
//
// 使い方 (P6 route):
//   const result = await verifyPlatformOperator()
//   if (result.status !== 'operator') {
//     return NextResponse.json(
//       { error: result.status === 'unauthorized' ? '...' : '...' },
//       { status: result.status === 'unauthorized' ? 401 : 403 },
//     )
//   }
//   const operatorUserId = result.userId
// ============================================================

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/server'

export type VerifyPlatformOperatorResult =
  | { status: 'operator';     userId: string }
  | { status: 'unauthorized' }
  | { status: 'forbidden' }

/**
 * Verified Platform Operator identity を取得。
 *
 * flow:
 *   1. @supabase/ssr で cookie 由来の Supabase Session を復元
 *   2. supabase.auth.getUser() で cryptographic に検証された user を取得
 *   3. user.id を使って platform_operators テーブルを SELECT
 *   4. 存在すれば operator, なければ forbidden
 *
 * 失敗時:
 *   - unauthorized: session/user が取れない
 *   - forbidden:    verified user だが platform_operators に不在
 *   - DB エラー時は fail-safe で forbidden
 */
export async function verifyPlatformOperator(): Promise<VerifyPlatformOperatorResult> {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        // getUser 呼び出しの副作用としての cookie 更新に備えて空実装
        setAll: () => {},
      },
    },
  )

  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user?.id) {
    return { status: 'unauthorized' }
  }

  const verifiedUserId = userData.user.id

  // platform_operators を Service Role で確認 (RLS deny 済み table)
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('platform_operators')
    .select('auth_user_id')
    .eq('auth_user_id', verifiedUserId)
    .maybeSingle()

  if (error) {
    console.error('[verify-platform-operator] lookup failed:', error.code, error.message)
    return { status: 'forbidden' }
  }

  if (!data) return { status: 'forbidden' }

  return { status: 'operator', userId: verifiedUserId }
}
