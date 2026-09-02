// ============================================================
// HIKARU Auth Callback
//
// Purpose:
//   Supabase Auth redirect (invitation / password reset / email confirm)
//   から戻ってきた際に:
//     1. `code` を検証済み Supabase session へ exchange
//     2. Server 側で profiles を確認 (role='admin' + company_id!=null)
//     3. Console Cookie を設定 (P3 helper)
//     4. 安全な internal path へ redirect
//
// Security principles:
//   - Query parameter (role/user_id/company_id/next) を authority として使わない
//   - user_metadata を authority として使わない
//   - profiles.role / profiles.company_id が唯一の権限 source
//   - fail-closed: どこかで失敗したら supabase.signOut() +
//     clearConsoleSessionCookies() で中途半端な状態を残さない
//   - Open Redirect 対策: next は allowlist 検証 (getSafeAuthRedirect)
//   - code / token / metadata を URL / log / error message に出さない
//
// Trust Boundary:
//   Console cookie の role='admin' は Customer Company Admin であることを示すのみ。
//   Platform Operator 権限は別 (lib/auth/platform-operator.ts)。
//   このcallback では Platform Operator 判定を行わない。
// ============================================================

import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/server'
import {
  setConsoleSessionCookies,
  clearConsoleSessionCookies,
} from '@/lib/auth/console-session'
import {
  getSafeAuthRedirect,
  AUTH_REDIRECT_DEFAULT,
} from '@/lib/auth/safe-redirect'

/**
 * Callback失敗時の共通 cleanup + redirect.
 * - Supabase session を可能な範囲で signOut
 * - Console cookie を clear
 * - error code のみを付けた /login にリダイレクト (token/code は出さない)
 */
async function failClosed(
  request: NextRequest,
  supabase: ReturnType<typeof createServerClient> | null,
  reason: 'invalid_callback' | 'auth_failed' | 'profile_denied' | 'internal_error',
): Promise<NextResponse> {
  // signOut は best-effort。呼べる状態ならcookieクリーンアップも進める。
  if (supabase) {
    try {
      await supabase.auth.signOut()
    } catch {
      // ignore — Cookie側は次で明示的に消す
    }
  }
  try {
    await clearConsoleSessionCookies()
  } catch {
    // ignore — response自体は返す
  }
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('error', reason)
  return NextResponse.redirect(loginUrl)
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url  = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next')

  // CASE A: code missing
  if (!code) {
    return failClosed(request, null, 'invalid_callback')
  }

  const cookieStore = await cookies()

  // Supabase SSR server client. cookies は @supabase/ssr に任せる。
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs: {
          name: string
          value: string
          options: Parameters<typeof cookieStore.set>[2]
        }[]) => {
          cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    },
  )

  // CASE B/C: exchange failure or missing user/session
  let authUserId: string
  let expiresIn: number | undefined
  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error || !data?.session || !data?.user) {
      // token / code は出さない
      return failClosed(request, supabase, 'auth_failed')
    }
    authUserId = data.user.id
    expiresIn  = data.session.expires_in
  } catch {
    return failClosed(request, supabase, 'auth_failed')
  }

  // Server 側で profiles を confirm。
  // user_metadata / query は authority として使わない。
  const admin = createAdminClient()
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('role, company_id')
    .eq('id', authUserId)
    .single()

  // CASE D/G: profile missing or DB error
  if (profileErr || !profile) {
    return failClosed(request, supabase, 'profile_denied')
  }

  const p = profile as { role?: string; company_id?: string | null }

  // CASE E: role != 'admin'
  if (p.role !== 'admin') {
    return failClosed(request, supabase, 'profile_denied')
  }

  // CASE F: company_id NULL
  if (!p.company_id) {
    return failClosed(request, supabase, 'profile_denied')
  }

  // CASE H: Cookie設定失敗 → 中途半端な状態を残さず fail-closed
  try {
    await setConsoleSessionCookies({
      userId:    authUserId,
      role:      'admin',
      expiresIn,
    })
  } catch {
    return failClosed(request, supabase, 'internal_error')
  }

  // Safe redirect (allowlist)
  const target = getSafeAuthRedirect(next)

  // 例外的に AUTH_REDIRECT_DEFAULT に落ちていても redirect は成功として扱う
  // (Console cookie も session も確立済み)
  void target || AUTH_REDIRECT_DEFAULT

  return NextResponse.redirect(new URL(target, request.url))
}
