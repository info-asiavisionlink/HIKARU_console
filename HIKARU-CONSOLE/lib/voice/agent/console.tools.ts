// ============================================================
// JARVIS CONSOLE Tool Registry — DAY1 Read-only Tools
// System Tools とは完全分離。Admin/Manager Context専用。
// Agentが直接Supabase queryすることは禁止。
// ============================================================

import type { ConsoleAgentTool, ConsoleAgentContext, ToolResult } from './types'

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
  description: '案件一覧を取得する。status/project_type/searchでFilter可能。',
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
  description: '管理者向け通知・未読件数を確認する',
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
  description: '承認待ちの経費申請一覧（申請者・金額・カテゴリ・日付・ID）を取得する',
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
  description: '勤怠修正申請の承認待ち件数を確認する',
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
  description: '売上情報（今月売上・今年売上・未入金・未請求）をHIKARU登録データから取得する',
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
  description: '指定のページへ移動する',
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

// ─── Registry ────────────────────────────────────────────────
export const CONSOLE_AGENT_TOOLS: ConsoleAgentTool[] = [
  getDashboardSummary,
  getProjects,
  getProjectDetail,
  getProjectAssignments,
  resolvePerson,
  resolveClient,
  resolveStore,
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
