'use server'

// ============================================================
// HIKARU First Admin — Password Setup Action
//
// Purpose:
//   Invitation経由でConsole Sessionが確立された First Admin本人が、
//   自分の初回パスワードを設定するための Server Action。
//
// Trust Boundary:
//   - Password authority: Supabase Auth (updateUser) のみ
//   - User authority:     supabase.auth.getUser() (Supabase検証済み)
//   - Role authority:     profiles.role === 'admin' (DB確認、P4と同じ厳格性)
//   - Company authority:  profiles.company_id NOT NULL
//   - Query / user_metadata / form内 role/user_id/company_id: 一切信用しない
//
// Password Security:
//   - password 値を console / audit / DB / cookie / URL / error に出さない
//   - Supabase Auth 以外の場所には一切保存しない
//   - platform_audit_logs へも書き込まない (P5では audit接続不要)
//
// Fail-closed:
//   - Session / user / profile 欠如 → update を絶対に実行せず
//     signOut + clearConsoleSessionCookies + redirect /login
//   - Validation error は同ページで表示 (認証エラーと分離)
// ============================================================

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/server'
import { clearConsoleSessionCookies } from '@/lib/auth/console-session'

export interface SetPasswordState {
  error: string | null
}

// Password policy — 既存 resetPasswordAction (login/actions.ts:113) と統一
const MIN_PASSWORD_LENGTH = 8

async function failClosed(reason: 'no_session' | 'profile_denied' | 'internal_error'): Promise<never> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs: { name: string; value: string; options: Parameters<typeof cookieStore.set>[2] }[]) =>
          cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    },
  )
  try {
    await supabase.auth.signOut()
  } catch {
    // ignore
  }
  try {
    await clearConsoleSessionCookies()
  } catch {
    // ignore
  }
  redirect(`/login?error=${reason}`)
}

export async function setPasswordAction(
  _prevState: SetPasswordState,
  formData: FormData,
): Promise<SetPasswordState> {
  // ---- 1. Validation (Client信用しないためServerで必ず) ----
  const password        = formData.get('password')        as string | null
  const confirmPassword = formData.get('confirmPassword') as string | null

  if (!password || typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return { error: `パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください。` }
  }
  if (password !== confirmPassword) {
    return { error: 'パスワードが一致しません。' }
  }

  // ---- 2. Session + user 確認 ----
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs: { name: string; value: string; options: Parameters<typeof cookieStore.set>[2] }[]) =>
          cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    },
  )

  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user?.id) {
    return failClosed('no_session')
  }
  const authUserId = userData.user.id

  // ---- 3. Profile authority 再確認 (P4と同じ厳格性) ----
  const admin = createAdminClient()
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('role, company_id')
    .eq('id', authUserId)
    .single()

  if (profileErr || !profile) {
    return failClosed('profile_denied')
  }

  const p = profile as { role?: string; company_id?: string | null }
  if (p.role !== 'admin') {
    return failClosed('profile_denied')
  }
  if (!p.company_id) {
    return failClosed('profile_denied')
  }

  // ---- 4. Password update (Supabase Auth only) ----
  const { error: updateErr } = await supabase.auth.updateUser({ password })
  if (updateErr) {
    // password / detail は出さない
    return { error: 'パスワードの設定に失敗しました。もう一度お試しください。' }
  }

  // ---- 5. Success → /setup (initial setup へ誘導) ----
  redirect('/setup')
}
