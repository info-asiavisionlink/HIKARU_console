// ============================================================
// JARVIS CONSOLE Tool Registry — DAY1 Read-only Tools
// System Tools とは完全分離。Admin/Manager Context専用。
// Agentが直接Supabase queryすることは禁止。
// ============================================================

import type { ConsoleAgentTool, ConsoleAgentContext, ToolResult } from './types'
import { getJstDateString, getJstYear, getJstMonth } from '@/lib/billing/date-utils'

// ─── HTTP helper（Cookie転送でAuth維持）──────────────────────
async function apiFetch(path: string, ctx: ConsoleAgentContext): Promise<Response> {
  return fetch(`${ctx.baseUrl}${path}`, {
    headers: { Cookie: ctx.cookieHeader },
    credentials: 'include',
  })
}

// ─── Tools ───────────────────────────────────────────────────

const getDashboardSummary: ConsoleAgentTool = {
  name:        'get_dashboard_summary',
  description: 'ダッシュボードの今日の状況サマリーを取得する',
  safetyLevel: 1,
  parameters:  { type: 'object', properties: {}, required: [] },
  async execute(_, ctx): Promise<ToolResult> {
    try {
      const res = await apiFetch('/api/dashboard', ctx)
      if (!res.ok) return { success: false, text: 'ダッシュボード情報を取得できませんでした。' }
      const data = await res.json()
      const parts: string[] = []
      // API: { projects: { active, total, ... }, clients, employees, partners, revenue }
      if (data?.projects?.active  != null) parts.push(`進行中案件: ${data.projects.active}件`)
      if (data?.projects?.total   != null && data.projects.total !== data.projects.active)
        parts.push(`案件合計: ${data.projects.total}件`)
      if (data?.employees?.active != null) parts.push(`在籍従業員: ${data.employees.active}名`)
      return {
        success: true,
        text:    parts.length > 0 ? `現在の状況: ${parts.join('、')}` : 'ダッシュボードを確認してください。',
        data,
      }
    } catch {
      return { success: false, text: 'ダッシュボード情報の取得中にエラーが発生しました。' }
    }
  },
}

const PROJECT_TYPE_LABELS_L1: Record<string, string> = { spot: 'スポット', recurring: '定期', hotel: 'ホテル' }
const PROJECT_STATUS_LABELS_L1: Record<string, string> = { active: '稼働中', paused: '停止中', completed: '完了', cancelled: 'キャンセル', scheduled_confirmed: '予定確定', scheduled_unconfirmed: '予定未確定', billing_pending: '入金待ち' }

const getProjects: ConsoleAgentTool = {
  name:        'get_projects',
  description: '案件・現場・仕事の一覧や状況を確認する。「案件教えて」「今どんな仕事が入ってる？」「進行中の現場は？」「スポットの案件だけ見たい」等。画面を開く依頼ではなく情報を求める場合に使う。',
  safetyLevel: 1,
  parameters: {
    type:       'object',
    properties: {
      status:       { type: 'string', description: 'active/paused/completed/cancelled等' },
      project_type: { type: 'string', description: 'spot/recurring/hotel' },
      search:       { type: 'string', description: '案件名検索キーワード' },
    },
    required: [],
  },
  async execute(params, ctx): Promise<ToolResult> {
    try {
      const q = new URLSearchParams()
      if (params.status)       q.set('status',       params.status)
      if (params.project_type) q.set('project_type', params.project_type)
      if (params.search)       q.set('search',       params.search)
      const res   = await apiFetch(`/api/projects?${q}`, ctx)
      if (!res.ok) return { success: false, text: '案件一覧を取得できませんでした。' }
      const data  = await res.json()
      // API: { projects: [...], count: N }
      const list  = Array.isArray(data?.projects) ? data.projects : []
      const total = data?.count ?? list.length
      if (total === 0) return { success: true, text: '案件はありません。', items: [] }
      const items = list.slice(0, 5).map((p: any, i: number) => ({
        id:    p.id,
        label: `${i + 1}件目: ${p.name}、${PROJECT_TYPE_LABELS_L1[p.project_type] ?? p.project_type ?? ''}、${PROJECT_STATUS_LABELS_L1[p.status] ?? p.status ?? ''}`,
      }))
      return {
        success: true,
        text:    `案件が${total}件あります。`,
        items,
        data:    { total },
      }
    } catch {
      return { success: false, text: '案件一覧の取得中にエラーが発生しました。' }
    }
  },
}

const getProjectDetail: ConsoleAgentTool = {
  name:        'get_project_detail',
  description: '指定IDの案件詳細を取得する。一覧でIDを確認後に使う。',
  safetyLevel: 1,
  parameters: {
    type: 'object',
    properties: { project_id: { type: 'string', description: '案件のID' } },
    required: ['project_id'],
  },
  async execute(params, ctx): Promise<ToolResult> {
    const projectId = params.project_id as string
    if (!projectId) return { success: false, text: '案件IDが必要です。' }
    try {
      const res  = await apiFetch(`/api/projects/${projectId}`, ctx)
      if (!res.ok) return { success: false, text: '案件詳細を取得できませんでした。' }
      const data = await res.json()
      const p    = data?.project
      if (!p) return { success: false, text: '案件が見つかりませんでした。' }
      const type   = PROJECT_TYPE_LABELS_L1[p.project_type] ?? p.project_type ?? '不明'
      const stat   = PROJECT_STATUS_LABELS_L1[p.status] ?? p.status ?? '不明'
      const client = p.clients?.name ?? ''
      const assigns = Array.isArray(p.project_assignments) ? p.project_assignments.length : 0
      const start  = p.start_date ? `、開始: ${p.start_date}` : ''
      const end    = p.end_date   ? `〜${p.end_date}` : ''
      const loc    = p.location_name ? `、場所: ${p.location_name}` : ''
      return {
        success: true,
        text: `案件詳細 — ${p.name}、${type}、${stat}${client ? `、顧客: ${client}` : ''}${start}${end}${loc}、担当${assigns}名`,
        items: [{ id: projectId, label: `ID: ${projectId}` }],
      }
    } catch {
      return { success: false, text: '案件詳細の取得中にエラーが発生しました。' }
    }
  },
}

const getProjectAssignments: ConsoleAgentTool = {
  name:        'get_project_assignments',
  description: '指定IDの案件担当者を実名で取得する。担当追加/変更/削除前にも使う。',
  safetyLevel: 1,
  parameters: {
    type: 'object',
    properties: { project_id: { type: 'string', description: '案件のID' } },
    required: ['project_id'],
  },
  async execute(params, ctx): Promise<ToolResult> {
    const projectId = params.project_id as string
    if (!projectId) return { success: false, text: '案件IDが必要です。' }
    try {
      const res  = await apiFetch(`/api/projects/${projectId}/assignments`, ctx)
      if (!res.ok) return { success: false, text: '担当者情報を取得できませんでした。' }
      const data = await res.json()
      const assignments: { assignee_type: string; assignee_id: string }[] = Array.isArray(data?.data) ? data.data : []
      if (assignments.length === 0) return { success: true, text: 'この案件に担当者はいません。', data: { assignments: [] } }

      const empIds     = assignments.filter(a => a.assignee_type === 'employee').map(a => a.assignee_id)
      const partnerIds = assignments.filter(a => a.assignee_type === 'partner').map(a => a.assignee_id)
      const empMap     = new Map<string, string>()
      const partnerMap = new Map<string, string>()

      await Promise.all([
        empIds.length > 0
          ? apiFetch('/api/employees?pageSize=200', ctx).then(r => r.json()).then(d => {
              for (const e of (d.data ?? [])) empMap.set(e.id, e.name ?? e.id)
            }).catch(() => {})
          : Promise.resolve(),
        partnerIds.length > 0
          ? apiFetch('/api/partners?pageSize=200', ctx).then(r => r.json()).then(d => {
              for (const p of (d.data ?? [])) partnerMap.set(p.id, p.company_name ?? p.contact_person_name ?? p.id)
            }).catch(() => {})
          : Promise.resolve(),
      ])

      const empNames:     string[] = empIds.map(id => empMap.get(id)).filter((n): n is string => !!n)
      const partnerNames: string[] = partnerIds.map(id => partnerMap.get(id)).filter((n): n is string => !!n)
      const unknownCount = assignments.length - empNames.length - partnerNames.length

      const parts: string[] = []
      if (empNames.length     > 0) parts.push(`従業員: ${empNames.join('、')}`)
      if (partnerNames.length > 0) parts.push(`協力業者: ${partnerNames.join('、')}`)
      if (unknownCount        > 0) parts.push(`${unknownCount}名の名前を確認できませんでした。`)

      const items = assignments.map(a => {
        const nameMap = a.assignee_type === 'employee' ? empMap : partnerMap
        const label   = `${a.assignee_type === 'employee' ? '従業員' : '協力業者'}: ${nameMap.get(a.assignee_id) ?? '不明'}`
        return { id: a.assignee_id, label }
      })

      return {
        success: true,
        text:    parts.join('、'),
        items,
        data:    { assignments },
      }
    } catch {
      return { success: false, text: '担当者情報の取得中にエラーが発生しました。' }
    }
  },
}

const resolvePerson: ConsoleAgentTool = {
  name:        'resolve_person',
  description: '名前キーワードで従業員・協力業者を検索し候補を返す。担当追加/変更前に必ず使う。AI生成ID禁止。',
  safetyLevel: 1,
  parameters: {
    type:       'object',
    properties: { name: { type: 'string', description: '検索する名前キーワード' } },
    required:   ['name'],
  },
  async execute(params, ctx): Promise<ToolResult> {
    const name = params.name as string
    if (!name?.trim()) return { success: false, text: '名前が必要です。' }
    try {
      const [empRes, partnerRes] = await Promise.all([
        apiFetch(`/api/employees?search=${encodeURIComponent(name)}&pageSize=10`, ctx),
        apiFetch(`/api/partners?search=${encodeURIComponent(name)}&pageSize=10`, ctx),
      ])
      const empData     = empRes.ok     ? await empRes.json()     : { data: [] }
      const partnerData = partnerRes.ok ? await partnerRes.json() : { data: [] }
      const employees:  any[] = empData.data     ?? []
      const partners:   any[] = partnerData.data ?? []
      const total = employees.length + partners.length

      if (total === 0) return { success: true, text: `「${name}」という担当者は見つかりませんでした。` }

      const items = [
        ...employees.map((e: any) => ({ id: e.id, label: `従業員: ${e.name}` })),
        ...partners.map((p: any) => ({ id: p.id, label: `協力業者: ${p.company_name ?? p.contact_person_name}` })),
      ]

      if (total === 1) {
        const onlyItem = items[0]
        const type     = employees.length > 0 ? 'employee' : 'partner'
        const resName  = employees.length > 0 ? employees[0].name : (partners[0].company_name ?? partners[0].contact_person_name)
        return {
          success: true,
          text:    `1名見つかりました。${onlyItem.label}`,
          items,
          data:    { resolved: { type, id: onlyItem.id, name: resName } },
        }
      }
      return { success: true, text: `「${name}」で${total}名見つかりました。どの方ですか？`, items }
    } catch {
      return { success: false, text: '検索中にエラーが発生しました。' }
    }
  },
}

const resolveClient: ConsoleAgentTool = {
  name:        'resolve_client',
  description: '顧客名で検索しclient_idを返す。案件作成/編集前に必ず使う。新規顧客登録は行わない。',
  safetyLevel: 1,
  parameters: {
    type:       'object',
    properties: { name: { type: 'string', description: '顧客名キーワード' } },
    required:   ['name'],
  },
  async execute(params, ctx): Promise<ToolResult> {
    const name = params.name as string
    if (!name?.trim()) return { success: false, text: '顧客名が必要です。' }
    try {
      const res = await apiFetch(`/api/clients?search=${encodeURIComponent(name)}&pageSize=10`, ctx)
      if (!res.ok) return { success: false, text: '顧客情報を取得できませんでした。' }
      const data    = await res.json()
      const clients: any[] = data.clients ?? []

      if (clients.length === 0) {
        return { success: true, text: `「${name}」という顧客は見つかりませんでした。新規顧客の登録は管理画面から行ってください。` }
      }
      const items = clients.map((c: any) => ({ id: c.id, label: c.name }))
      if (clients.length === 1) {
        return {
          success: true,
          text:    `顧客「${clients[0].name}」が見つかりました。`,
          items,
          data:    { clientId: clients[0].id, clientName: clients[0].name },
        }
      }
      return { success: true, text: `「${name}」に一致する顧客が${clients.length}件あります。どの顧客ですか？`, items }
    } catch {
      return { success: false, text: '顧客検索中にエラーが発生しました。' }
    }
  },
}

const resolveStore: ConsoleAgentTool = {
  name:        'resolve_store',
  description: '店舗名で検索しstore_idを返す。client_idが決まっている場合は指定する。',
  safetyLevel: 1,
  parameters: {
    type:       'object',
    properties: {
      name:      { type: 'string', description: '店舗名キーワード' },
      client_id: { type: 'string', description: '顧客ID（指定するとその顧客の店舗に絞り込む）' },
    },
    required: ['name'],
  },
  async execute(params, ctx): Promise<ToolResult> {
    const name     = params.name      as string
    const clientId = params.client_id as string | undefined
    if (!name?.trim()) return { success: false, text: '店舗名が必要です。' }
    try {
      const q = new URLSearchParams({ search: name, pageSize: '10' })
      if (clientId) q.set('client_id', clientId)
      const res = await apiFetch(`/api/stores?${q}`, ctx)
      if (!res.ok) return { success: false, text: '店舗情報を取得できませんでした。' }
      const data   = await res.json()
      const stores: any[] = data.stores ?? []

      if (stores.length === 0) {
        return { success: true, text: `「${name}」という店舗は見つかりませんでした。` }
      }
      const items = stores.map((s: any) => ({
        id:    s.id,
        label: s.clients?.name ? `${s.name}（${s.clients.name}）` : s.name,
      }))
      if (stores.length === 1) {
        return {
          success: true,
          text:    `店舗「${stores[0].name}」が見つかりました。`,
          items,
          data:    { storeId: stores[0].id, storeName: stores[0].name, clientId: stores[0].client_id },
        }
      }
      return { success: true, text: `「${name}」に一致する店舗が${stores.length}件あります。どの店舗ですか？`, items }
    } catch {
      return { success: false, text: '店舗検索中にエラーが発生しました。' }
    }
  },
}

const getNotifications: ConsoleAgentTool = {
  name:        'get_notifications',
  description: '管理者向け通知・未読件数を確認する。「通知ある？」「何か連絡来てる？」「未読メッセージある？」等に使う。',
  safetyLevel: 1,
  parameters:  { type: 'object', properties: {}, required: [] },
  async execute(_, ctx): Promise<ToolResult> {
    try {
      const res = await apiFetch('/api/console-notifications', ctx)
      if (!res.ok) return { success: false, text: '通知を取得できませんでした。' }
      const data  = await res.json()
      const list  = data.notifications ?? []
      const unread = data.unread_count ?? list.filter((n: { is_read: boolean }) => !n.is_read).length
      if (unread === 0) return { success: true, text: '未読の通知はありません。' }
      const items = list.filter((n: { is_read: boolean }) => !n.is_read).slice(0, 5).map(
        (n: { id: string; title?: string; body?: string }, i: number) => ({
          id: n.id, label: `${i + 1}件目: ${n.title ?? n.body ?? '通知'}`,
        })
      )
      return { success: true, text: `未読の通知が${unread}件あります。`, items }
    } catch {
      return { success: false, text: '通知の取得中にエラーが発生しました。' }
    }
  },
}

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  transport: '交通費', parking: '駐車料', supplies: '備品費',
  consumables: '消耗品費', other: 'その他',
}

const getPendingExpenses: ConsoleAgentTool = {
  name:        'get_pending_expenses',
  description: '承認待ちの経費申請一覧を取得する。「経費申請来てる？」「まだ処理してない経費ある？」「お金の申請が上がってる？」「経費確認して」等に使う。データを取得する場合に使う（画面を開く場合はnavigateを使う）。',
  safetyLevel: 1,
  parameters:  { type: 'object', properties: {}, required: [] },
  async execute(_, ctx): Promise<ToolResult> {
    try {
      const res = await apiFetch('/api/expenses?status=submitted', ctx)
      if (!res.ok) return { success: false, text: '経費申請を確認できませんでした。' }
      const data  = await res.json()
      // API: { expenses: [...], kpi: {...} }
      const items = Array.isArray(data?.expenses) ? data.expenses : []
      if (items.length === 0) return { success: true, text: '承認待ちの経費申請はありません。' }
      const listItems = items.slice(0, 5).map(
        (e: { id: string; amount?: number; title?: string; category?: string; expense_date?: string; profiles?: { name?: string } }, i: number) => ({
          id:    e.id,
          label: `${i + 1}件目: ${e.profiles?.name ?? '申請者不明'}、${EXPENSE_CATEGORY_LABELS[e.category ?? ''] ?? 'その他'}、${Number(e.amount ?? 0).toLocaleString('ja-JP')}円${e.expense_date ? `、${e.expense_date}` : ''}`,
        })
      )
      return {
        success: true,
        text:    `承認待ち経費が${items.length}件あります。`,
        items:   listItems,
      }
    } catch {
      return { success: false, text: '経費申請の取得中にエラーが発生しました。' }
    }
  },
}

const getExpenseDetail: ConsoleAgentTool = {
  name:        'get_expense_detail',
  description: '指定IDの経費申請詳細を取得する。一覧でIDを確認後に使う。',
  safetyLevel: 1,
  parameters:  {
    type: 'object',
    properties: { expense_id: { type: 'string', description: '経費申請のID' } },
    required: ['expense_id'],
  },
  async execute(params, ctx): Promise<ToolResult> {
    const expenseId = params.expense_id as string
    if (!expenseId) return { success: false, text: '経費IDが必要です。' }
    try {
      const res  = await apiFetch(`/api/expenses/${expenseId}`, ctx)
      if (!res.ok) return { success: false, text: '経費詳細を取得できませんでした。' }
      const data = await res.json()
      const exp  = data?.expense
      if (!exp) return { success: false, text: '経費情報が見つかりませんでした。' }
      const name = exp.profiles?.name ?? '申請者不明'
      const cat  = EXPENSE_CATEGORY_LABELS[exp.category] ?? exp.category ?? 'その他'
      const amt  = `${Number(exp.amount ?? 0).toLocaleString('ja-JP')}円`
      const date = exp.expense_date ? `、${exp.expense_date}` : ''
      const desc = exp.description ? `、用途: ${exp.description}` : (exp.title ? `、件名: ${exp.title}` : '')
      const stat = exp.status ?? '不明'
      return {
        success: true,
        text: `経費詳細 — ${name}、${cat}、${amt}${date}${desc}、ステータス: ${stat}`,
        items: [{ id: expenseId, label: `ID: ${expenseId}` }],
      }
    } catch {
      return { success: false, text: '経費詳細の取得中にエラーが発生しました。' }
    }
  },
}

const getPendingAttendance: ConsoleAgentTool = {
  name:        'get_pending_attendance',
  description: '勤怠修正申請の承認待ちを確認する。「勤怠修正来てる？」「勤務時間の直しの申請ある？」「修正申請何件？」等に使う。',
  safetyLevel: 1,
  parameters:  { type: 'object', properties: {}, required: [] },
  async execute(_, ctx): Promise<ToolResult> {
    try {
      const res = await apiFetch('/api/attendance/corrections?status=pending', ctx)
      if (!res.ok) return { success: false, text: '勤怠修正申請を確認できませんでした。' }
      const data  = await res.json()
      // API: { corrections: [...] }
      const items = Array.isArray(data?.corrections) ? data.corrections : []
      if (items.length === 0) return { success: true, text: '承認待ちの勤怠修正申請はありません。' }
      return {
        success: true,
        text:    `承認待ちの勤怠修正申請が${items.length}件あります。`,
      }
    } catch {
      return { success: false, text: '勤怠修正申請の取得中にエラーが発生しました。' }
    }
  },
}

const getPendingRequests: ConsoleAgentTool = {
  name:        'get_pending_requests',
  description: '案件依頼・見積依頼の未対応件数を確認する',
  safetyLevel: 1,
  parameters:  { type: 'object', properties: {}, required: [] },
  async execute(_, ctx): Promise<ToolResult> {
    try {
      const res = await apiFetch('/api/project-requests?status=pending&count=true', ctx)
      if (!res.ok) return { success: false, text: '案件依頼を確認できませんでした。' }
      const data  = await res.json()
      const count = data.count ?? (data.data?.length ?? 0)
      if (count === 0) return { success: true, text: '未対応の案件依頼はありません。' }
      return {
        success: true,
        text:    `未対応の案件依頼が${count}件あります。`,
        data:    { count },
      }
    } catch {
      return { success: false, text: '案件依頼の取得中にエラーが発生しました。' }
    }
  },
}

const getRevenueSummary: ConsoleAgentTool = {
  name:        'get_revenue_summary',
  description: '売上情報（今月・今年・未入金・未請求）をHIKARU登録データから取得する。「今月売上いくら？」「売上どんな感じ？」「まだ入ってきてないお金ある？」「未請求はいくら？」等に使う。利益計算・今月今年以外の期間は対応不可。',
  safetyLevel: 1,
  parameters:  { type: 'object', properties: {}, required: [] },
  async execute(_, ctx): Promise<ToolResult> {
    try {
      const res = await apiFetch('/api/dashboard', ctx)
      if (!res.ok) return { success: false, text: '売上情報を取得できませんでした。' }
      const data = await res.json()
      const rev  = data?.revenue
      if (!rev || typeof rev !== 'object')
        return { success: false, text: '現在HIKARUに登録されている情報からは売上を確認できません。' }
      // API: revenue.this_month/this_year = 税込合計、unpaid = 請求済未入金、unbilled = 未請求
      const fmt = (n: number): string => `${Math.round(n).toLocaleString('ja-JP')}円`
      const parts: string[] = []
      if (rev.this_month != null) parts.push(`今月の売上: ${fmt(rev.this_month)}`)
      if (rev.this_year  != null) parts.push(`今年の売上: ${fmt(rev.this_year)}`)
      if (rev.unpaid     != null) parts.push(`未入金: ${fmt(rev.unpaid)}`)
      if (rev.unbilled   != null) parts.push(`未請求: ${fmt(rev.unbilled)}`)
      return {
        success: true,
        text:    parts.length > 0 ? parts.join('、') : '売上情報を確認できませんでした。',
        data:    rev,
      }
    } catch {
      return { success: false, text: '売上情報の取得中にエラーが発生しました。' }
    }
  },
}

const navigate: ConsoleAgentTool = {
  name:        'navigate',
  description: '指定のページへ移動・画面を開く。「〜開いて」「〜の画面にして」「〜に移動して」等の画面操作依頼に使う。情報を確認したい場合は移動ではなくデータ取得ツールを使う。',
  safetyLevel: 2,
  parameters: {
    type:       'object',
    properties: {
      action: { type: 'string', description: 'console.go_dashboard / console.open_projects 等' },
    },
    required: ['action'],
  },
  async execute(params): Promise<ToolResult> {
    return {
      success: true,
      text:    `navigate:${params.action}`,
      data:    { action: params.action },
    }
  },
}

// ─── Client Tools ────────────────────────────────────────────

const getClients: ConsoleAgentTool = {
  name:        'get_clients',
  description: '顧客・取引先の一覧や状況を確認する。「顧客一覧教えて」「取引先どんな会社ある？」「ABC社って登録されてる？」「何社取引してる？」等。画面を開く依頼ではなく情報を求める場合に使う。',
  safetyLevel: 1,
  parameters:  {
    type: 'object',
    properties: { search: { type: 'string', description: '顧客名・コード・メールで検索' } },
    required:   [],
  },
  async execute(params, ctx): Promise<import('./types').ToolResult> {
    try {
      const q = new URLSearchParams({ pageSize: '10' })
      if (params.search) q.set('search', params.search)
      const res  = await apiFetch(`/api/clients?${q}`, ctx)
      if (!res.ok) return { success: false, text: '顧客情報を取得できませんでした。' }
      const data    = await res.json()
      const clients: any[] = data.clients ?? []
      const total   = data.count ?? clients.length
      if (total === 0) return { success: true, text: params.search ? `「${params.search}」という顧客は見つかりませんでした。` : '顧客は登録されていません。', items: [] }
      const items = clients.slice(0, 5).map((c: any, i: number) => ({
        id:    c.id,
        label: `${i + 1}件目: ${c.name}${c.code ? `（${c.code}）` : ''}、${c.is_active === false ? '停止中' : '稼働中'}`,
      }))
      return { success: true, text: `顧客が${total}社あります。`, items, data: { total } }
    } catch {
      return { success: false, text: '顧客一覧の取得中にエラーが発生しました。' }
    }
  },
}

const getClientDetail: ConsoleAgentTool = {
  name:        'get_client_detail',
  description: '指定した顧客の詳細情報（連絡先・住所・担当者等）を取得する。「この会社の情報教えて」「電話番号は？」「メールアドレスは？」「住所は？」等。一覧でIDを確認後に使う。',
  safetyLevel: 1,
  parameters:  {
    type: 'object',
    properties: { client_id: { type: 'string', description: '顧客のID' } },
    required:   ['client_id'],
  },
  async execute(params, ctx): Promise<import('./types').ToolResult> {
    const clientId = params.client_id
    if (!clientId) return { success: false, text: '顧客IDが必要です。' }
    try {
      const res  = await apiFetch(`/api/clients/${clientId}`, ctx)
      if (!res.ok) return { success: false, text: '顧客情報を取得できませんでした。' }
      const data = await res.json()
      const c    = data?.data
      if (!c) return { success: false, text: '顧客が見つかりませんでした。' }
      const status  = c.is_active === false ? '停止中' : '稼働中'
      const parts: string[] = [`顧客詳細 — ${c.name}${c.code ? `（${c.code}）` : ''}、${status}`]
      if (c.contact_name) parts.push(`担当: ${c.contact_name}`)
      if (c.phone)        parts.push(`電話: ${c.phone}`)
      if (c.email)        parts.push(`メール: ${c.email}`)
      if (c.address)      parts.push(`住所: ${c.address}`)
      if (c.notes)        parts.push(`備考: ${c.notes}`)
      return { success: true, text: parts.join('、'), items: [{ id: clientId, label: `ID: ${clientId}` }] }
    } catch {
      return { success: false, text: '顧客詳細の取得中にエラーが発生しました。' }
    }
  },
}

const getClientStores: ConsoleAgentTool = {
  name:        'get_client_stores',
  description: '指定した顧客に紐づく店舗一覧を取得する。「この会社の店舗教えて」「このお客さんの拠点は？」「どこに店舗ある？」等。',
  safetyLevel: 1,
  parameters:  {
    type: 'object',
    properties: { client_id: { type: 'string', description: '顧客のID' } },
    required:   ['client_id'],
  },
  async execute(params, ctx): Promise<import('./types').ToolResult> {
    const clientId = params.client_id
    if (!clientId) return { success: false, text: '顧客IDが必要です。' }
    try {
      const res    = await apiFetch(`/api/stores?client_id=${clientId}&pageSize=20`, ctx)
      if (!res.ok) return { success: false, text: '店舗情報を取得できませんでした。' }
      const data   = await res.json()
      const stores: any[] = data.stores ?? []
      if (stores.length === 0) return { success: true, text: 'この顧客に紐づく店舗は登録されていません。', items: [] }
      const items = stores.slice(0, 8).map((s: any, i: number) => ({
        id:    s.id,
        label: `${i + 1}件目: ${s.name}${s.address ? `、${s.address}` : ''}`,
      }))
      return { success: true, text: `店舗が${stores.length}件あります。`, items }
    } catch {
      return { success: false, text: '店舗情報の取得中にエラーが発生しました。' }
    }
  },
}

const getClientProjects: ConsoleAgentTool = {
  name:        'get_client_projects',
  description: '指定した顧客に紐づく案件一覧を取得する。「この会社の案件教えて」「この顧客の仕事は？」「今この会社で動いてる現場ある？」等。',
  safetyLevel: 1,
  parameters:  {
    type: 'object',
    properties: { client_id: { type: 'string', description: '顧客のID' } },
    required:   ['client_id'],
  },
  async execute(params, ctx): Promise<import('./types').ToolResult> {
    const clientId = params.client_id
    if (!clientId) return { success: false, text: '顧客IDが必要です。' }
    try {
      const res      = await apiFetch(`/api/projects?client_id=${clientId}&pageSize=10`, ctx)
      if (!res.ok) return { success: false, text: '案件情報を取得できませんでした。' }
      const data     = await res.json()
      const projects: any[] = data.projects ?? []
      const total    = data.count ?? projects.length
      if (total === 0) return { success: true, text: 'この顧客に紐づく案件はありません。', items: [] }
      const PT: Record<string, string> = { spot: 'スポット', recurring: '定期', hotel: 'ホテル' }
      const ST: Record<string, string> = { active: '稼働中', paused: '停止中', completed: '完了', cancelled: 'キャンセル' }
      const items = projects.slice(0, 5).map((p: any, i: number) => ({
        id:    p.id,
        label: `${i + 1}件目: ${p.name}、${PT[p.project_type] ?? p.project_type}、${ST[p.status] ?? p.status}`,
      }))
      return { success: true, text: `案件が${total}件あります。`, items, data: { total } }
    } catch {
      return { success: false, text: '案件情報の取得中にエラーが発生しました。' }
    }
  },
}

// ─── Employee Tools ──────────────────────────────────────────

const EMPLOYEE_STATUS_LABELS: Record<string, string> = { active: '在籍中', on_leave: '休職中', resigned: '退職', suspended: '利用停止' }

const getEmployees: ConsoleAgentTool = {
  name:        'get_employees',
  description: '従業員・スタッフの一覧を取得する。「従業員一覧教えて」「今誰が登録されてる？」「スタッフどんな人いる？」「田中さんって登録されてる？」等。',
  safetyLevel: 1,
  parameters:  {
    type: 'object',
    properties: {
      search: { type: 'string', description: '名前・かな・メール・社員番号で検索' },
      status: { type: 'string', description: 'active/on_leave/resigned/suspended' },
    },
    required: [],
  },
  async execute(params, ctx): Promise<ToolResult> {
    try {
      const q = new URLSearchParams({ pageSize: '10' })
      if (params.search) q.set('search', params.search)
      if (params.status) q.set('status', params.status)
      const res       = await apiFetch(`/api/employees?${q}`, ctx)
      if (!res.ok) return { success: false, text: '従業員情報を取得できませんでした。' }
      const data      = await res.json()
      const employees: any[] = data.data ?? []
      const total     = data.count ?? employees.length
      if (total === 0) return { success: true, text: params.search ? `「${params.search}」という従業員は見つかりませんでした。` : '従業員は登録されていません。', items: [] }
      const items = employees.slice(0, 5).map((e: any, i: number) => ({
        id:    e.id,
        label: `${i + 1}件目: ${e.name}${e.employee_number ? `（${e.employee_number}）` : ''}、${EMPLOYEE_STATUS_LABELS[e.status] ?? e.status}${e.department ? `、${e.department}` : ''}`,
      }))
      return { success: true, text: `従業員が${total}名います。`, items, data: { total } }
    } catch {
      return { success: false, text: '従業員一覧の取得中にエラーが発生しました。' }
    }
  },
}

const getEmployeeDetail: ConsoleAgentTool = {
  name:        'get_employee_detail',
  description: '指定した従業員の詳細情報（連絡先・役職・入社日等）を取得する。「田中さんの情報教えて」「電話番号は？」「この人の役職は？」「いつ入社した？」等。一覧でIDを確認後に使う。',
  safetyLevel: 1,
  parameters:  {
    type: 'object',
    properties: { employee_id: { type: 'string', description: '従業員のID' } },
    required:   ['employee_id'],
  },
  async execute(params, ctx): Promise<ToolResult> {
    const empId = params.employee_id
    if (!empId) return { success: false, text: '従業員IDが必要です。' }
    try {
      const res  = await apiFetch(`/api/employees/${empId}`, ctx)
      if (!res.ok) return { success: false, text: '従業員情報を取得できませんでした。' }
      const data = await res.json()
      const e    = data?.data
      if (!e) return { success: false, text: '従業員が見つかりませんでした。' }
      const parts: string[] = [`${e.name}${e.employee_number ? `（${e.employee_number}）` : ''}、${EMPLOYEE_STATUS_LABELS[e.status] ?? e.status}`]
      if (e.department) parts.push(`部署: ${e.department}`)
      if (e.position)   parts.push(`役職: ${e.position}`)
      if (e.phone)      parts.push(`電話: ${e.phone}`)
      if (e.email)      parts.push(`メール: ${e.email}`)
      if (e.hire_date)  parts.push(`入社: ${e.hire_date}`)
      const assignCount = Array.isArray(e.assignments) ? e.assignments.length : 0
      if (assignCount > 0) parts.push(`担当案件: ${assignCount}件`)
      return { success: true, text: parts.join('、'), items: [{ id: empId, label: `ID: ${empId}` }] }
    } catch {
      return { success: false, text: '従業員詳細の取得中にエラーが発生しました。' }
    }
  },
}

const getEmployeeProjects: ConsoleAgentTool = {
  name:        'get_employee_projects',
  description: '指定した従業員が担当している案件を取得する。「この人の担当案件は？」「田中さん今どの現場入ってる？」「この人の仕事は？」等。',
  safetyLevel: 1,
  parameters:  {
    type: 'object',
    properties: { employee_id: { type: 'string', description: '従業員のID' } },
    required:   ['employee_id'],
  },
  async execute(params, ctx): Promise<ToolResult> {
    const empId = params.employee_id
    if (!empId) return { success: false, text: '従業員IDが必要です。' }
    try {
      const res         = await apiFetch(`/api/employees/${empId}`, ctx)
      if (!res.ok) return { success: false, text: '従業員情報を取得できませんでした。' }
      const data        = await res.json()
      const assignments: any[] = data?.data?.assignments ?? []
      if (assignments.length === 0) return { success: true, text: 'この従業員に紐づく担当案件はありません。', items: [] }
      const ST: Record<string, string> = { active: '稼働中', paused: '停止中', completed: '完了', cancelled: 'キャンセル' }
      const items = assignments.slice(0, 5).map((a: any, i: number) => {
        const p = a.projects
        return { id: p?.id ?? '', label: `${i + 1}件目: ${p?.name ?? '不明'}、${ST[p?.status] ?? p?.status ?? '不明'}` }
      })
      return { success: true, text: `担当案件が${assignments.length}件あります。`, items }
    } catch {
      return { success: false, text: '担当案件の取得中にエラーが発生しました。' }
    }
  },
}

const getEmployeeAttendanceSummary: ConsoleAgentTool = {
  name:        'get_employee_attendance_summary',
  description: '指定した従業員の勤怠概要（出勤日数・勤務時間）を取得する。「この人今月何日出勤した？」「田中さんの勤務状況は？」「今月の出勤状況は？」等。',
  safetyLevel: 1,
  parameters:  {
    type: 'object',
    properties: {
      employee_id: { type: 'string', description: '従業員のID' },
      year:        { type: 'string', description: '年（例: 2026）省略時は今年' },
      month:       { type: 'string', description: '月（例: 8）省略時は今月' },
    },
    required: ['employee_id'],
  },
  async execute(params, ctx): Promise<ToolResult> {
    const empId = params.employee_id
    if (!empId) return { success: false, text: '従業員IDが必要です。' }
    try {
      const empRes = await apiFetch(`/api/employees/${empId}`, ctx)
      if (!empRes.ok) return { success: false, text: '従業員情報を取得できませんでした。' }
      const empData = await empRes.json()
      const e = empData?.data
      if (!e) return { success: false, text: '従業員が見つかりませんでした。' }
      if (!e.auth_user_id) return { success: true, text: `${e.name}さんはシステムアカウントがないため勤怠データを確認できません。` }
      const y = params.year  ?? String(getJstYear())
      const m = params.month ?? String(getJstMonth())
      const attRes = await apiFetch(`/api/attendance?worker_id=${e.auth_user_id}&year=${y}&month=${m}`, ctx)
      if (!attRes.ok) return { success: false, text: '勤怠情報を取得できませんでした。' }
      const attData  = await attRes.json()
      const summary: any[] = attData.summary ?? []
      const ws = summary.find((s: any) => s.worker_id === e.auth_user_id)
      if (!ws) return { success: true, text: `${e.name}さんの${m}月の勤怠記録はありません。` }
      const hours = Math.round(ws.totalWorkMins / 60 * 10) / 10
      return { success: true, text: `${e.name}さんの${m}月の勤怠: 出勤${ws.workDays}日、合計${hours}時間` }
    } catch {
      return { success: false, text: '勤怠情報の取得中にエラーが発生しました。' }
    }
  },
}

const getEmployeeShifts: ConsoleAgentTool = {
  name:        'get_employee_shifts',
  description: '指定した従業員のシフト一覧を取得する。「この人今週のシフトは？」「田中さん次いつ入ってる？」「この人明日入ってる？」「いつシフト入ってる？」等。',
  safetyLevel: 1,
  parameters:  {
    type: 'object',
    properties: {
      employee_id: { type: 'string', description: '従業員のID' },
      date_from:   { type: 'string', description: '開始日（YYYY-MM-DD）省略時は今日' },
      date_to:     { type: 'string', description: '終了日（YYYY-MM-DD）省略時は1週間後' },
    },
    required: ['employee_id'],
  },
  async execute(params, ctx): Promise<ToolResult> {
    const empId = params.employee_id
    if (!empId) return { success: false, text: '従業員IDが必要です。' }
    try {
      const todayJst = getJstDateString()
      const from     = params.date_from ?? todayJst
      const end7     = new Date(todayJst)
      end7.setDate(end7.getDate() + 7)
      const toDate   = params.date_to ?? end7.toISOString().slice(0, 10)
      const q      = new URLSearchParams({ employee_id: empId, date_from: from, date_to: toDate })
      const res    = await apiFetch(`/api/shifts?${q}`, ctx)
      if (!res.ok) return { success: false, text: 'シフト情報を取得できませんでした。' }
      const data   = await res.json()
      const shifts: any[] = data.shifts ?? []
      if (shifts.length === 0) return { success: true, text: 'この期間のシフトは登録されていません。', items: [] }
      const items = shifts.slice(0, 7).map((s: any) => ({
        id:    s.id ?? '',
        label: `${s.shift_date} ${s.start_time?.slice(0, 5) ?? ''}〜${s.end_time?.slice(0, 5) ?? ''}${s.projects?.name ? `（${s.projects.name}）` : ''}`,
      }))
      return { success: true, text: `${shifts.length}件のシフトがあります。`, items }
    } catch {
      return { success: false, text: 'シフト情報の取得中にエラーが発生しました。' }
    }
  },
}

// ─── Employee Quality Tool ───────────────────────────────────

const getEmployeeQualitySummary: ConsoleAgentTool = {
  name:        'get_employee_quality_summary',
  description: '指定した従業員の品質評価サマリーを取得する。「田中さんの品質どう？」「この人の評価は？」「平均スコアは？」「最近の品質評価教えて」等。',
  safetyLevel: 1,
  parameters:  {
    type: 'object',
    properties: {
      employee_id: { type: 'string', description: '従業員のID' },
      days:        { type: 'string', description: '集計対象日数（例: 30）省略時は30日' },
    },
    required: ['employee_id'],
  },
  async execute(params, ctx): Promise<ToolResult> {
    const empId = params.employee_id
    if (!empId) return { success: false, text: '従業員IDが必要です。' }
    try {
      const empRes = await apiFetch(`/api/employees/${empId}`, ctx)
      if (!empRes.ok) return { success: false, text: '従業員情報を取得できませんでした。' }
      const empData = await empRes.json()
      const e = empData?.data
      if (!e) return { success: false, text: '従業員が見つかりませんでした。' }
      if (!e.auth_user_id) return { success: true, text: `${e.name}さんはシステムアカウントがないため品質評価データを確認できません。` }
      const d = params.days ? Math.min(parseInt(params.days, 10), 365) : 30
      const qRes = await apiFetch(`/api/quality/workers?worker_id=${e.auth_user_id}&days=${d}`, ctx)
      if (!qRes.ok) return { success: false, text: '品質情報を取得できませんでした。' }
      const qData   = await qRes.json()
      const workers: any[] = qData.workers ?? []
      const w = workers.find((x: any) => x.worker_id === e.auth_user_id)
      if (!w || w.job_count === 0) return { success: true, text: `${e.name}さんの過去${d}日間に完了した仕事の品質評価データはありません。` }
      const parts: string[] = [`${e.name}さんの品質評価（過去${d}日間）`]
      parts.push(`評価件数: ${w.job_count}件`)
      if (w.avg_hqs            != null) parts.push(`HIKARUスコア: ${Math.round(w.avg_hqs * 10) / 10}点`)
      if (w.avg_ai_score       != null) parts.push(`AI評価平均: ${Math.round(w.avg_ai_score * 10) / 10}点`)
      if (w.avg_customer_score != null) parts.push(`顧客評価平均: ${Math.round(w.avg_customer_score * 10) / 10}点`)
      return { success: true, text: parts.join('、') }
    } catch {
      return { success: false, text: '品質情報の取得中にエラーが発生しました。' }
    }
  },
}

// ─── Registry ────────────────────────────────────────────────
export const CONSOLE_AGENT_TOOLS: ConsoleAgentTool[] = [
  getDashboardSummary,
  getProjects,
  getProjectDetail,
  getProjectAssignments,
  resolvePerson,
  resolveClient,
  resolveStore,
  getClients,
  getClientDetail,
  getClientStores,
  getClientProjects,
  getEmployees,
  getEmployeeDetail,
  getEmployeeProjects,
  getEmployeeAttendanceSummary,
  getEmployeeShifts,
  getEmployeeQualitySummary,
  getNotifications,
  getPendingExpenses,
  getExpenseDetail,
  getPendingAttendance,
  getPendingRequests,
  getRevenueSummary,
  navigate,
]

export function toOpenAITools(tools: ConsoleAgentTool[]) {
  return tools.map(tool => ({
    type: 'function' as const,
    function: {
      name:        tool.name,
      description: tool.description,
      parameters:  tool.parameters,
    },
  }))
}
