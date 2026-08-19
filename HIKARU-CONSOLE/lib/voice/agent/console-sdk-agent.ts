// ============================================================
// JARVIS CONSOLE — Agents SDK Definition
// System Agent とは完全分離。Admin/Manager Context専用。
// ============================================================

import { Agent, tool, setTracingDisabled } from '@openai/agents'
import { z } from 'zod'
import { isValidConsoleAction, getConsoleActionLevel } from '@/lib/voice/registry/console.actions'

// HIKARU業務データをOpenAIトレーシングへ送信しない
setTracingDisabled(true)

export type ConsoleAgentSDKContext = {
  userId:      string
  companyId:   string
  cookieHeader: string
  baseUrl:     string
}

async function apiGet(path: string, ctx: ConsoleAgentSDKContext): Promise<Response> {
  return fetch(`${ctx.baseUrl}${path}`, {
    headers: { Cookie: ctx.cookieHeader },
  })
}

// ─── Tools ───────────────────────────────────────────────────

const getDashboardTool = tool({
  name:        'get_dashboard_summary',
  description: 'ダッシュボードの今日の状況サマリーを取得する',
  parameters:  z.object({}),
  execute: async (_, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const res  = await apiGet('/api/dashboard', ctx)
      if (!res.ok) return 'ダッシュボード情報を取得できませんでした。'
      const data = await res.json()
      const parts: string[] = []
      if (data?.activeProjects   != null) parts.push(`進行中案件: ${data.activeProjects}件`)
      if (data?.pendingExpenses  != null) parts.push(`承認待ち経費: ${data.pendingExpenses}件`)
      if (data?.pendingAttendance != null && data.pendingAttendance > 0)
        parts.push(`勤怠修正申請: ${data.pendingAttendance}件`)
      return parts.length > 0 ? `現在の状況: ${parts.join('、')}` : 'ダッシュボードを確認してください。'
    } catch { return 'ダッシュボード情報の取得中にエラーが発生しました。' }
  },
})

const getProjectsTool = tool({
  name:        'get_projects',
  description: '案件一覧を取得する',
  parameters:  z.object({
    status: z.enum(['active', 'inactive', 'all']).optional(),
  }),
  execute: async ({ status }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const query = status && status !== 'all' ? `?status=${status}` : ''
      const res   = await apiGet(`/api/projects${query}`, ctx)
      if (!res.ok) return '案件一覧を取得できませんでした。'
      const data = await res.json()
      const list: Array<{ id: string; name: string }> = Array.isArray(data?.data) ? data.data : []
      if (list.length === 0) return '案件はありません。'
      const items = list.slice(0, 5).map((p, i) => `${i + 1}件目: ${p.name} (id:${p.id})`).join(', ')
      return `案件が${list.length}件あります。一覧: ${items}`
    } catch { return '案件一覧の取得中にエラーが発生しました。' }
  },
})

const getNotificationsTool = tool({
  name:        'get_notifications',
  description: '管理者向け通知・未読件数を確認する',
  parameters:  z.object({}),
  execute: async (_, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const res  = await apiGet('/api/console-notifications', ctx)
      if (!res.ok) return '通知を取得できませんでした。'
      const data  = await res.json()
      const list  = data.notifications ?? []
      const unread = data.unread_count ?? list.filter((n: { is_read: boolean }) => !n.is_read).length
      if (unread === 0) return '未読の通知はありません。'
      return `未読の通知が${unread}件あります。`
    } catch { return '通知の取得中にエラーが発生しました。' }
  },
})

const getPendingExpensesTool = tool({
  name:        'get_pending_expenses',
  description: '承認待ちの経費申請件数と一覧を確認する',
  parameters:  z.object({}),
  execute: async (_, runCtx) => {
    const ctx   = runCtx!.context as ConsoleAgentSDKContext
    try {
      const res   = await apiGet('/api/expenses?status=submitted', ctx)
      if (!res.ok) return '経費申請を確認できませんでした。'
      const data  = await res.json()
      const items = Array.isArray(data?.data) ? data.data : []
      if (items.length === 0) return '承認待ちの経費申請はありません。'
      return `承認待ちの経費申請が${items.length}件あります。`
    } catch { return '経費申請の取得中にエラーが発生しました。' }
  },
})

const getPendingAttendanceTool = tool({
  name:        'get_pending_attendance',
  description: '勤怠修正申請の承認待ち件数を確認する',
  parameters:  z.object({}),
  execute: async (_, runCtx) => {
    const ctx   = runCtx!.context as ConsoleAgentSDKContext
    try {
      const res   = await apiGet('/api/attendance/corrections?status=pending', ctx)
      if (!res.ok) return '勤怠修正申請を確認できませんでした。'
      const data  = await res.json()
      const items = Array.isArray(data?.data) ? data.data : []
      if (items.length === 0) return '承認待ちの勤怠修正申請はありません。'
      return `承認待ちの勤怠修正申請が${items.length}件あります。`
    } catch { return '勤怠修正申請の取得中にエラーが発生しました。' }
  },
})

const getPendingRequestsTool = tool({
  name:        'get_pending_requests',
  description: '案件依頼・未対応件数を確認する',
  parameters:  z.object({}),
  execute: async (_, runCtx) => {
    const ctx   = runCtx!.context as ConsoleAgentSDKContext
    try {
      const res   = await apiGet('/api/project-requests?status=pending&count=true', ctx)
      if (!res.ok) return '案件依頼を確認できませんでした。'
      const data  = await res.json()
      const count = data.count ?? (data.data?.length ?? 0)
      if (count === 0) return '未対応の案件依頼はありません。'
      return `未対応の案件依頼が${count}件あります。`
    } catch { return '案件依頼の取得中にエラーが発生しました。' }
  },
})

const navigateTool = tool({
  name:        'navigate',
  description: '指定のページへ移動する',
  parameters:  z.object({
    action: z.string().describe('console.go_dashboard / console.open_projects 等'),
  }),
  execute: async ({ action }) => {
    if (isValidConsoleAction(action) && getConsoleActionLevel(action) >= 3) {
      return `このAction（${action}）は現在音声では実行できません。`
    }
    return JSON.stringify({ __navigate: true, action })
  },
})

// ─── Agent（モジュールレベル1インスタンス）───────────────────
const CONSOLE_SYSTEM_PROMPT = `あなたはHIKARU Console管理者アシスタント「JARVIS」です。
清掃業務管理システムの管理者・マネージャーをサポートする音声アシスタントです。

## 役割
- 案件・顧客・従業員・協力業者の状況確認
- 承認待ち経費・勤怠修正の件数確認
- 必要なページへのナビゲーション提案

## 重要なルール
- Toolで取得した情報のみを事実として扱う
- 承認・変更・削除などのWrite操作は現在対応していない（DAY2で追加予定）
- 2〜3文以内で音声向けに簡潔に回答する`

export const consoleJarvisAgent = new Agent<ConsoleAgentSDKContext>({
  name:         'JARVIS Console',
  instructions: CONSOLE_SYSTEM_PROMPT,
  model:        'gpt-4o',
  tools:        [
    getDashboardTool,
    getProjectsTool,
    getNotificationsTool,
    getPendingExpensesTool,
    getPendingAttendanceTool,
    getPendingRequestsTool,
    navigateTool,
  ],
})
