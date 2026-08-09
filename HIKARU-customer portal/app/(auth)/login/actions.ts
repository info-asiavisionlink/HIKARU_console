'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/server'

interface LoginState {
  error: string | null
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const loginId  = (formData.get('loginId')  as string)?.trim().toUpperCase()
  const password = formData.get('password')  as string

  if (!loginId || !password) {
    return { error: 'ログインIDとパスワードを入力してください。' }
  }

  // CLT-0001 → clt-0001@hikaru.client
  const email = `${loginId.toLowerCase()}@hikaru.client`

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (authError || !authData.session) {
    return { error: translateAuthError(authError?.message ?? '') }
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single()

  if (!profile || profile.role !== 'client') {
    await supabase.auth.signOut()
    return { error: 'アカウントの権限が設定されていません。担当者へお問い合わせください。' }
  }

  // ポータルアカウントが有効か確認
  const { data: portalAccount } = await admin
    .from('client_portal_accounts')
    .select('id, is_active')
    .eq('profile_id', authData.user.id)
    .single()

  if (!portalAccount || !portalAccount.is_active) {
    await supabase.auth.signOut()
    return { error: 'このアカウントは無効です。担当者へお問い合わせください。' }
  }

  // 最終ログイン日時を更新
  await admin
    .from('client_portal_accounts')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', portalAccount.id)

  const isProduction = process.env.NODE_ENV === 'production'
  const maxAge = authData.session.expires_in ?? 3600
  const opts = { httpOnly: true, secure: isProduction, path: '/', maxAge, sameSite: 'lax' } as const

  cookieStore.set('hk_cp_role', 'client',           opts)
  cookieStore.set('hk_cp_uid',  authData.user.id,   opts)

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
        setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )

  await supabase.auth.signOut()
  cookieStore.delete('hk_cp_role')
  cookieStore.delete('hk_cp_uid')
  redirect('/login')
}

function translateAuthError(message: string): string {
  if (message.includes('Invalid login credentials') || message.includes('invalid_credentials'))
    return 'ログインIDまたはパスワードが正しくありません。'
  if (message.includes('Too many requests'))
    return 'ログイン試行回数が上限に達しました。しばらく待ってから再試行してください。'
  return 'エラーが発生しました。しばらく時間をおいて再試行してください。'
}
