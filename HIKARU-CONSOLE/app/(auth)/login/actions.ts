'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/server'
import { setConsoleSessionCookies, clearConsoleSessionCookies } from '@/lib/auth/console-session'
import { safeLoginNext } from '@/lib/auth/safe-next'
import { getSetupStatus } from '@/lib/setup/get-setup-status'

interface LoginState {
  error: string | null
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email    = (formData.get('email')    as string)?.trim()
  const password = formData.get('password')  as string
  const nextRaw  = formData.get('next') as string | null
  const next     = safeLoginNext(nextRaw)

  if (!email || !password) {
    return { error: 'メールアドレスまたはIDとパスワードを入力してください。' }
  }

  // EMP-XXXX 形式を内部メールに変換（従業員がSystemと同じIDでログイン可能）
  const resolvedEmail = /^EMP-\d+$/i.test(email.trim())
    ? `${email.trim().toLowerCase()}@hikaru.internal`
    : email

  const cookieStore = await cookies()

  // @supabase/ssr に Cookie 管理を委譲する正規クライアント
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: Parameters<typeof cookieStore.set>[2] }[]) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  // ① Supabase 標準サインイン（セッションCookieを正しい形式で自動設定）
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: resolvedEmail,
    password,
  })

  if (authError || !authData.session) {
    return { error: translateAuthError(authError?.message ?? '') }
  }

  // ② ロール確認（admin のみ CONSOLE 利用可） + company_id 取得
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, company_id')
    .eq('id', authData.user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    // セッションをクリアしてからエラーを返す
    await supabase.auth.signOut()
    return { error: '作業者アカウントです。HIKARU System をご利用ください。' }
  }

  // ③ ミドルウェア用カスタム Cookie（ルートガードに使用）
  // Cookie 設定は共通 helper 経由。既存挙動 (options / value source) は完全維持。
  await setConsoleSessionCookies({
    userId:    authData.user.id,
    role:      'admin',
    expiresIn: authData.session.expires_in,
  })

  // ④ Redirect 決定
  //   優先順位:
  //     1. 明示的な safe next (認証切れで飛ばされた元 page 等) → next
  //     2. Setup 未完了 (BUSINESS_READY=false) → /setup
  //     3. Setup 完了 or Status 取得失敗 → /dashboard (安全 fallback)
  //   Setup status 取得失敗はログイン自体を失敗扱いにしない。
  if (next) {
    redirect(next)
  }

  // Setup status 取得失敗 (COMPANY_NOT_FOUND / DB_ERROR) は Login 自体を
  // 失敗扱いにせず、default /dashboard に fallback する仕様。
  const result = profile.company_id
    ? await getSetupStatus(profile.company_id, admin)
    : null

  if (result?.ok && !result.status.readiness.businessReady) {
    redirect('/setup')
  }

  redirect('/dashboard')
}

export async function forgotPasswordAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = (formData.get('email') as string)?.trim()
  if (!email) return { error: 'メールアドレスを入力してください。' }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs: { name: string; value: string; options: Parameters<typeof cookieStore.set>[2] }[]) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )

  const { error } = await supabase.auth.resetPasswordForEmail(email)
  if (error) return { error: 'メール送信に失敗しました。' }
  return { error: null }
}

export async function resetPasswordAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const password        = formData.get('password')        as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!password || password.length < 8)
    return { error: 'パスワードは8文字以上で入力してください。' }
  if (password !== confirmPassword)
    return { error: 'パスワードが一致しません。' }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs: { name: string; value: string; options: Parameters<typeof cookieStore.set>[2] }[]) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: 'パスワードの変更に失敗しました。' }
  redirect('/dashboard')
}

export async function logoutAction() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs: { name: string; value: string; options: Parameters<typeof cookieStore.set>[2] }[]) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )

  await supabase.auth.signOut()

  // ミドルウェア用カスタム Cookie も削除 (レガシー hk_c_at / hk_c_rt 含む)
  await clearConsoleSessionCookies()

  redirect('/login')
}

function translateAuthError(message: string): string {
  if (message.includes('Invalid login credentials') || message.includes('invalid_credentials'))
    return 'メールアドレスまたはパスワードが正しくありません。'
  if (message.includes('Email not confirmed'))
    return 'メールアドレスが確認されていません。'
  if (message.includes('Too many requests'))
    return 'ログイン試行回数が上限に達しました。しばらく待ってから再試行してください。'
  return 'エラーが発生しました。しばらく時間をおいて再試行してください。'
}
