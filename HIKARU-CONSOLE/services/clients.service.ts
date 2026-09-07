export interface ClientRow {
  id: string
  company_id: string
  name: string
  code: string | null
  email: string | null
  phone: string | null
  address: string | null
  contact_name: string | null
  notes: string | null
  is_active: boolean
  // 請求情報（migration 040）
  invoice_email: string | null
  payment_terms: string | null
  closing_day: number | null
  // 支払条件構造化（migration 042）
  payment_month_offset: number | null  // 0=当月,1=翌月,2=翌々月... (0-6)
  payment_day: number | null           // 1-30=指定日, 31=月末
  created_at: string
  updated_at: string
}

export interface ClientInsert {
  name: string
  code?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  contact_name?: string | null
  notes?: string | null
  // 請求情報（作成後に設定可）
  invoice_email?: string | null
  payment_terms?: string | null
  closing_day?: number | null
  // 支払条件構造化（migration 042）
  payment_month_offset?: number | null
  payment_day?: number | null
}

export async function listClients(opts?: {
  search?: string
  page?: number
  pageSize?: number
  activeOnly?: boolean
}) {
  const params = new URLSearchParams()
  if (opts?.search)    params.set('search',   opts.search)
  if (opts?.page)      params.set('page',     String(opts.page))
  if (opts?.pageSize)  params.set('pageSize', String(opts.pageSize))

  const res = await fetch(`/api/clients?${params}`, {
    credentials: 'include',  // Cookie を必ず送信
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { data: [] as ClientRow[], count: 0, error: new Error(body.error ?? `HTTP ${res.status}`) }
  }

  const body = await res.json()
  return { data: (body.clients ?? []) as ClientRow[], count: body.count ?? 0, error: null }
}

export async function getClient(id: string) {
  const res = await fetch(`/api/clients/${id}`, { credentials: 'include', cache: 'no-store' })
  if (!res.ok) return { data: null, error: new Error(`HTTP ${res.status}`) }
  const body = await res.json()
  return { data: body.data ?? body.client ?? null, error: null }
}

// 以下は既存の Supabase client 直接呼び出しを継続（更新・削除は認証済みのサーバーアクション経由が望ましいが今は簡易版）
import { createClient } from '@/lib/supabase/client'

async function getCompanyId(): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
  return data?.company_id ?? null
}

export async function createClientRecord(input: ClientInsert): Promise<{
  data:   ClientRow | null
  error:  Error | null
  status: number | null
}> {
  // Console は独自 auth cookie (hk_c_at) を使用しており browser Supabase SDK は
  // 認証セッションを共有しない。/api/clients は getAuthContext で Console admin auth を
  // 解決するため必ずこちら経由で作成する (createEmployee と同じパターン)。
  //
  // 追加防御:
  //   - AbortSignal.timeout(15s) — fetch がハングしても 15秒で AbortError を投げて
  //     "保存中..." に張り付かないようにする。
  //   - status を戻り値に含める — 呼び出し側で 401 のときに /login リダイレクト等が可能。
  try {
    const res = await fetch('/api/clients', {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify(input),
      signal:      AbortSignal.timeout(15_000),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        data:   null,
        error:  new Error(body.error ?? `HTTP ${res.status}`),
        status: res.status,
      }
    }
    return {
      data:   (body.client ?? body.data ?? null) as ClientRow | null,
      error:  null,
      status: res.status,
    }
  } catch (e) {
    const isTimeout = e instanceof DOMException && e.name === 'TimeoutError'
    return {
      data:   null,
      error:  isTimeout
        ? new Error('サーバーとの通信がタイムアウトしました。時間をおいて再度お試しください。')
        : (e instanceof Error ? e : new Error('顧客の作成に失敗しました')),
      status: null,
    }
  }
}

export async function updateClient(id: string, input: Partial<ClientInsert> & { is_active?: boolean }) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('clients')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export async function deleteClient(id: string) {
  const res = await fetch(`/api/clients/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { error: new Error(body.error ?? `HTTP ${res.status}`) }
  }
  return { error: null }
}
