// ============================================================
// HIKARU Console — Session Cookie Helper
//
// 目的:
//   Console の "middleware 用カスタム Cookie" (hk_c_role / hk_c_uid) の
//   設定・削除を1箇所へ集約する。
//
// 使い所:
//   - loginAction() (既存): password login 成功後
//   - logoutAction() (既存): サインアウト時
//
// 重要:
//   - Cookie 名 / options を勝手に変更しない (middleware / getAuthContext と整合)
//   - Cookie 値は必ず Server 側検証済みのもの (Supabase auth + profiles) を渡す
//   - Browser から供給された userId / role を絶対に受け取らない
//   - Cookie に token / password / session JSON 等を保存しない
//   - Cookie 内 role は Console 利用に許可された値 ('admin') に限定
//
// Delivery Model:
//   HIKARU は SaaS 中央発行型ではなく、顧客企業ごとに環境を構築・納品する
//   モデルを採用する。初期 Admin は技術側 (Supabase Dashboard) で作成し、
//   顧客はその認証情報で通常 /login → /setup に進む。
//   本 helper は通常 login / logout のセッション状態管理に限定する。
// ============================================================

import { cookies } from 'next/headers'

// ---- Constants ----

/** Cookie 名。middleware / server-admin.ts / logoutAction と整合必須。 */
export const CONSOLE_COOKIE_ROLE = 'hk_c_role' as const
export const CONSOLE_COOKIE_UID  = 'hk_c_uid'  as const

/**
 * 廃止予定だが logoutAction がまだ削除しているレガシー Cookie 名。
 * 削除ロジックの互換性維持のためのみ export。
 */
export const CONSOLE_LEGACY_COOKIES = ['hk_c_at', 'hk_c_rt'] as const

/** Console session に許可される role。現在 admin のみ。 */
export type ConsoleSessionRole = 'admin'

/** Default max-age when Supabase session provides no expires_in (現状の login 挙動と一致) */
const DEFAULT_MAX_AGE_SECONDS = 3600

// ---- Types ----

export interface SetConsoleSessionCookiesInput {
  /** Supabase 検証済み auth.users.id */
  userId: string
  /** DB 検証済み profiles.role。現在 'admin' のみ許可 */
  role:   ConsoleSessionRole
  /** Supabase session.expires_in (秒)。未指定時は 3600 */
  expiresIn?: number
}

// ---- Cookie options ----

/**
 * middleware / getAuthContext が期待する Cookie options を返す。
 * 既存 loginAction (app/(auth)/login/actions.ts:73) と完全一致。
 */
function buildCookieOptions(maxAgeSeconds: number) {
  const isProduction = process.env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    secure:   isProduction,
    path:     '/',
    maxAge:   maxAgeSeconds,
    sameSite: 'lax' as const,
  }
}

// ---- Public API ----

/**
 * Console session cookies (hk_c_role, hk_c_uid) を設定する。
 *
 * 呼び出し側契約:
 *   - userId は Supabase (signInWithPassword / exchangeCodeForSession) 検証済み
 *   - role は profiles テーブルから取得した検証済み値 (Browser 供給禁止)
 *   - Console 利用可能な role は 'admin' のみ (loginAction と同じ制約)
 *
 * 失敗時:
 *   - 入力不正は Error throw (呼び出し側 loginAction / callback で catch し
 *     User には一般エラーで応答すること)
 *
 * 何故 throw か:
 *   - Cookie 設定失敗は認証状態不整合の重大バグ。
 *   - fire-and-forget にすると認証成功なのに middleware で拒否される
 *     "壊れた状態" を作りかねない。呼び出し側で確実に検出させる。
 */
export async function setConsoleSessionCookies(
  input: SetConsoleSessionCookiesInput,
): Promise<void> {
  if (!input?.userId || typeof input.userId !== 'string') {
    throw new Error('setConsoleSessionCookies: userId is required')
  }
  if (input.role !== 'admin') {
    // 将来 role を拡張する場合はここを更新。
    // 現状 Console loginAction 側が admin 以外を signOut するため、
    // ここに admin 以外が来るのは Program バグ。
    throw new Error(`setConsoleSessionCookies: unsupported role: ${String(input.role)}`)
  }

  const maxAge = typeof input.expiresIn === 'number' && input.expiresIn > 0
    ? input.expiresIn
    : DEFAULT_MAX_AGE_SECONDS

  const opts = buildCookieOptions(maxAge)
  const cookieStore = await cookies()

  cookieStore.set(CONSOLE_COOKIE_ROLE, input.role,   opts)
  cookieStore.set(CONSOLE_COOKIE_UID,  input.userId, opts)
}

/**
 * Console session cookies を削除する。
 * logoutAction が明示的に呼び出す想定。
 * レガシー hk_c_at / hk_c_rt も念のため削除 (既存 logoutAction と同じ挙動)。
 */
export async function clearConsoleSessionCookies(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(CONSOLE_COOKIE_ROLE)
  cookieStore.delete(CONSOLE_COOKIE_UID)
  for (const legacy of CONSOLE_LEGACY_COOKIES) {
    cookieStore.delete(legacy)
  }
}
