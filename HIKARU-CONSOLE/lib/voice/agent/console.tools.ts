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

const getProjects: ConsoleAgentTool = {
  name:        'get_projects',
  description: '案件一覧を取得する',
  safetyLevel: 1,
  parameters: {
    type:       'object',
    properties: {
      status: { type: 'string', description: 'active / inactive / all', enum: ['active', 'inactive', 'all'] },
    },
    required: [],
  },
  async execute(params, ctx): Promise<ToolResult> {
    try {
      const query = params.status && params.status !== 'all' ? `?status=${params.status}` : ''
      const res   = await apiFetch(`/api/projects${query}`, ctx)
      if (!res.ok) return { success: false, text: '案件一覧を取得できませんでした。' }
      const data  = await res.json()
      // API: { projects: [...], count: N }
      const list: Array<{ id: string; name: string }> = Array.isArray(data?.projects) ? data.projects : []
      const total = data?.count ?? list.length
      if (total === 0) return { success: true, text: '案件はありません。', items: [] }
      const items = list.slice(0, 5).map((p, i) => ({ id: p.id, label: `${i + 1}件目: ${p.name}` }))
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

const getPendingExpenses: ConsoleAgentTool = {
  name:        'get_pending_expenses',
  description: '承認待ちの経費申請件数と一覧を確認する',
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
        (e: { id: string; amount?: number; title?: string }, i: number) => ({
          id: e.id, label: `${i + 1}件目: ${e.title ?? `¥${e.amount ?? '?'}`}`,
        })
      )
      return {
        success: true,
        text:    `承認待ちの経費申請が${items.length}件あります。`,
        items:   listItems,
      }
    } catch {
      return { success: false, text: '経費申請の取得中にエラーが発生しました。' }
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
  getNotifications,
  getPendingExpenses,
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
