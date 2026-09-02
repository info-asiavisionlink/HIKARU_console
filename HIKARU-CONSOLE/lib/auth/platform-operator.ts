// ============================================================
// HIKARU Platform Operator — Server-side Authorization Helper
//
// 目的:
//   /api/platform/* route から共通利用される Platform Operator 判定。
//
// 重要:
//   - Customer Company Admin (profiles.role='admin') とは完全に別権限
//   - profiles.role='admin' だけでは Platform Operator になれない
//   - client-supplied user_id / role / company_id を一切信用しない
//   - 判定sourceは常に auth.uid() 由来 (getAuthContext経由の userId)
//   - platform_operators テーブル (RLS full deny) を Service Role で照合
//
// 使い方 (P2以降のAPI route):
//   const auth = await getAuthContext()
//   if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
//   const op = await checkPlatformOperator(auth)
//   if (op !== 'operator') {
//     return NextResponse.json(
//       { error: op === 'unauthorized' ? 'unauthorized' : 'forbidden' },
//       { status: op === 'unauthorized' ? 401 : 403 },
//     )
//   }
//   // ここから Platform Operator確定領域
// ============================================================

import type { AuthContext } from '@/lib/supabase/server-admin'

// 判定結果:
//   'operator'      : Platform Operator (platform_operators に存在)
//   'not_operator'  : 認証済みだが Operator ではない (Customer Admin/Worker/etc.)
//   'unauthorized'  : 認証情報なし (通常はAPI route側で getAuthContext=null で先に弾かれる)
export type PlatformOperatorCheckResult = 'operator' | 'not_operator' | 'unauthorized'

/**
 * 現在認証済みの user が Platform Operator か判定する。
 *
 * ・auth.userId は getAuthContext (session cookie 由来) から取得済み
 * ・引数から任意 user_id を渡す設計は禁止 (Browser供給値信用しないため)
 * ・Service Role clientで platform_operators を直接 SELECT
 * ・profile.role は一切参照しない (Customer Admin と混同しないため)
 */
export async function checkPlatformOperator(
  auth: AuthContext,
): Promise<PlatformOperatorCheckResult> {
  if (!auth?.userId) return 'unauthorized'

  const { data, error } = await auth.adminClient
    .from('platform_operators')
    .select('auth_user_id')
    .eq('auth_user_id', auth.userId)
    .maybeSingle()

  if (error) {
    // DBエラーは 0件扱いしない。安全側 (not_operator) に倒すが、
    // 呼び出し側は error を認識できるよう console に残す。
    console.error('[platform-operator] check failed:', error.code, error.message)
    return 'not_operator'
  }

  return data ? 'operator' : 'not_operator'
}

/**
 * boolean版 (簡易チェック用)。
 * 401/403 の区別が不要な場合に使う。API route では checkPlatformOperator を推奨。
 */
export async function isPlatformOperator(auth: AuthContext): Promise<boolean> {
  return (await checkPlatformOperator(auth)) === 'operator'
}
