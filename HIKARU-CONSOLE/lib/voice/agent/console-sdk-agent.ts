// ============================================================
// JARVIS CONSOLE — Agents SDK Definition
// System Agent とは完全分離。Admin/Manager Context専用。
// ============================================================

import { Agent, tool, setTracingDisabled } from '@openai/agents'
import { z } from 'zod'
import { isValidConsoleAction, getConsoleActionLevel } from '@/lib/voice/registry/console.actions'

const CONFIRMATION_EXPIRY_MS = 5 * 60 * 1000

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

const getQualitySummaryTool = tool({
  name:        'get_quality_summary',
  description: '今日・最近の品質評価サマリーを取得する。低スコア案件の確認等。',
  parameters:  z.object({
    date: z.string().optional().describe('確認日（YYYY-MM-DD形式。省略時は今日）'),
  }),
  execute: async ({ date }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const query = date ? `?date=${date}` : ''
      const res   = await apiGet(`/api/quality${query}`, ctx)
      if (!res.ok) return '品質評価データを取得できませんでした。'
      const data  = await res.json()
      const items = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
      if (items.length === 0) return '品質評価データはありません。'
      const low = items.filter((e: { score?: number }) => (e.score ?? 100) < 80)
      if (low.length === 0) return `本日${items.length}件の品質評価があります。全て基準を満たしています。`
      return `本日${items.length}件中、${low.length}件がスコア80未満です。品質管理画面で確認してください。`
    } catch { return '品質評価情報の取得中にエラーが発生しました。' }
  },
})

const proposeActionTool = tool({
  name:        'propose_action',
  description: 'L4 Write操作（経費承認・勤怠修正承認等）をユーザーに提案し確認を求める。実行はしない。propose_actionを呼んだ後、finalOutputに確認文を書くこと。',
  parameters:  z.object({
    action:              z.string().describe('console.approve_expense / console.approve_attendance 等'),
    params:              z.record(z.string(), z.string()).optional().describe('actionに必要なパラメータ（expenseId, correctionId等）'),
    confirmationMessage: z.string().describe('管理者への確認文（例：「田中さんの3,200円の交通費を承認します。よろしいですか？」）'),
  }),
  execute: async ({ action, params = {}, confirmationMessage }) => {
    if (!isValidConsoleAction(action)) return `不明なAction: ${action}`
    const level = getConsoleActionLevel(action)
    if (level < 3) return `${action}はConfirmation不要です。`
    if (level >= 5) return 'この操作は音声での実行が禁止されています。'
    return JSON.stringify({
      __pendingConfirmation: true,
      action,
      params,
      safetyLevel: level,
      message:     confirmationMessage,
      expiresAt:   Date.now() + CONFIRMATION_EXPIRY_MS,
    })
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
- 品質評価サマリーの確認
- 必要なページへのナビゲーション提案
- 経費申請・勤怠修正申請の承認（Confirmation必須）

## 重要なルール
- Toolで取得した情報のみを事実として扱う
- 2〜3文以内で音声向けに簡潔に回答する

## Write操作のルール（重要）
承認操作（経費承認・勤怠修正承認）は必ずpropose_actionを使う。
直接実行は禁止。必ず管理者の確認を取ること。

propose_action の使い方:
1. まずRead Toolで承認対象のID・詳細を確認する（例: get_pending_expenses）
2. propose_actionを呼ぶ（action, params, confirmationMessage を指定）
3. finalOutputに確認文を書く（例: 「田中さんの3,200円交通費を承認します。よろしいですか？」）
4. 管理者が「はい」と言ったら自動的にServerが実行する

## propose_actionのactionとparamsの対応
- console.approve_expense    → params: { expenseId }    「〇〇さんの〇〇円の経費申請を承認します。よろしいですか？」
- console.approve_attendance → params: { correctionId } 「〇〇さんの勤怠修正申請を承認します。よろしいですか？」

## L5禁止操作（音声実行不可）
削除・権限変更・全件承認・大量操作は実行不可。
「全部承認して」等はエラーとして説明すること。`

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
    getQualitySummaryTool,
    proposeActionTool,
    navigateTool,
  ],
})
