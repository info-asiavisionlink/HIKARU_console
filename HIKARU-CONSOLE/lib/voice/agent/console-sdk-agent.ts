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
      // API: { projects: { active, total, ... }, clients, employees, partners, revenue }
      if (data?.projects?.active  != null) parts.push(`進行中案件: ${data.projects.active}件`)
      if (data?.projects?.total   != null && data.projects.total !== data.projects.active)
        parts.push(`案件合計: ${data.projects.total}件`)
      if (data?.employees?.active != null) parts.push(`在籍従業員: ${data.employees.active}名`)
      return parts.length > 0 ? `現在の状況: ${parts.join('、')}` : 'ダッシュボードを確認してください。'
    } catch { return 'ダッシュボード情報の取得中にエラーが発生しました。' }
  },
})

const PROJECT_TYPE_LABELS_SDK: Record<string, string> = { spot: 'スポット', recurring: '定期', hotel: 'ホテル' }
const PROJECT_STATUS_LABELS_SDK: Record<string, string> = { active: '稼働中', paused: '停止中', completed: '完了', cancelled: 'キャンセル', scheduled_confirmed: '予定確定', scheduled_unconfirmed: '予定未確定', billing_pending: '入金待ち' }

const getProjectsTool = tool({
  name:        'get_projects',
  description: '案件一覧を取得する。status/project_type/searchでFilter可能。',
  parameters:  z.object({
    status:       z.string().optional().describe('active/paused/completed/cancelled等'),
    project_type: z.string().optional().describe('spot/recurring/hotel'),
    search:       z.string().optional().describe('案件名検索キーワード'),
  }),
  execute: async ({ status, project_type, search }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const q = new URLSearchParams()
      if (status)       q.set('status',       status)
      if (project_type) q.set('project_type', project_type)
      if (search)       q.set('search',       search)
      const res  = await apiGet(`/api/projects?${q}`, ctx)
      if (!res.ok) return '案件一覧を取得できませんでした。'
      const data  = await res.json()
      // API: { projects: [...], count: N }
      const list  = Array.isArray(data?.projects) ? data.projects : []
      const total = data?.count ?? list.length
      if (total === 0) return '案件はありません。'
      const items = list.slice(0, 5).map((p: any, i: number) => {
        const type   = PROJECT_TYPE_LABELS_SDK[p.project_type] ?? p.project_type ?? '不明'
        const stat   = PROJECT_STATUS_LABELS_SDK[p.status] ?? p.status ?? '不明'
        const client = p.stores?.clients?.name ?? ''
        const date   = p.start_date ? `、${p.start_date}` : ''
        return `${i + 1}件目: ${p.name}、${type}、${stat}${client ? `、${client}` : ''}${date} [id:${p.id}]`
      }).join(' / ')
      return `案件${total}件。${items}`
    } catch { return '案件一覧の取得中にエラーが発生しました。' }
  },
})

const getProjectDetailTool = tool({
  name:        'get_project_detail',
  description: '指定IDの案件詳細を取得する。一覧でIDを確認後に使う。',
  parameters:  z.object({ project_id: z.string().describe('案件のID') }),
  execute: async ({ project_id }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const res  = await apiGet(`/api/projects/${project_id}`, ctx)
      if (!res.ok) return '案件詳細を取得できませんでした。'
      const data = await res.json()
      const p    = data?.project
      if (!p) return '案件が見つかりませんでした。'
      const type   = PROJECT_TYPE_LABELS_SDK[p.project_type] ?? p.project_type ?? '不明'
      const stat   = PROJECT_STATUS_LABELS_SDK[p.status] ?? p.status ?? '不明'
      const client = p.clients?.name ?? ''
      const assigns = Array.isArray(p.project_assignments) ? p.project_assignments.length : 0
      const start  = p.start_date ? `、開始: ${p.start_date}` : ''
      const end    = p.end_date   ? `〜${p.end_date}` : ''
      const loc    = p.location_name ? `、場所: ${p.location_name}` : ''
      return `案件詳細 — ${p.name}、${type}、${stat}${client ? `、顧客: ${client}` : ''}${start}${end}${loc}、担当${assigns}名、ID: ${project_id}`
    } catch { return '案件詳細の取得中にエラーが発生しました。' }
  },
})

const getProjectAssignmentsTool = tool({
  name:        'get_project_assignments',
  description: '指定IDの案件担当者数・種別を取得する。',
  parameters:  z.object({ project_id: z.string().describe('案件のID') }),
  execute: async ({ project_id }, runCtx) => {
    const ctx  = runCtx!.context as ConsoleAgentSDKContext
    try {
      const res  = await apiGet(`/api/projects/${project_id}/assignments`, ctx)
      if (!res.ok) return '担当者情報を取得できませんでした。'
      const data = await res.json()
      const assignments = Array.isArray(data?.data) ? data.data : []
      if (assignments.length === 0) return 'この案件に担当者はいません。'
      const empCount     = assignments.filter((a: any) => a.assignee_type === 'employee').length
      const partnerCount = assignments.filter((a: any) => a.assignee_type === 'partner').length
      const parts: string[] = []
      if (empCount     > 0) parts.push(`従業員${empCount}名`)
      if (partnerCount > 0) parts.push(`協力業者${partnerCount}名`)
      return `担当: ${parts.join('、')}（合計${assignments.length}名）`
    } catch { return '担当者情報の取得中にエラーが発生しました。' }
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
  description: '承認待ちの経費申請一覧（申請者・金額・カテゴリ・日付・ID）を取得する',
  parameters:  z.object({}),
  execute: async (_, runCtx) => {
    const ctx   = runCtx!.context as ConsoleAgentSDKContext
    try {
      const res   = await apiGet('/api/expenses?status=submitted', ctx)
      if (!res.ok) return '経費申請を確認できませんでした。'
      const data  = await res.json()
      // API: { expenses: [...], kpi: {...} }
      const items = Array.isArray(data?.expenses) ? data.expenses : []
      if (items.length === 0) return '承認待ちの経費申請はありません。'
      const CATS: Record<string, string> = { transport: '交通費', parking: '駐車料', supplies: '備品費', consumables: '消耗品費', other: 'その他' }
      const list = items.slice(0, 5).map((e: any, i: number) => {
        const name = e.profiles?.name ?? '申請者不明'
        const cat  = CATS[e.category] ?? e.category ?? 'その他'
        const amt  = `${Number(e.amount ?? 0).toLocaleString('ja-JP')}円`
        const date = e.expense_date ? `、${e.expense_date}` : ''
        return `${i + 1}件目: ${name}、${cat}、${amt}${date} [id:${e.id}]`
      }).join(' / ')
      return `承認待ち経費が${items.length}件あります。${list}`
    } catch { return '経費申請の取得中にエラーが発生しました。' }
  },
})

const getExpenseDetailTool = tool({
  name:        'get_expense_detail',
  description: '指定IDの経費申請詳細を取得する。一覧でIDを確認後に使う。',
  parameters:  z.object({ expense_id: z.string().describe('経費申請のID') }),
  execute: async ({ expense_id }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const res  = await apiGet(`/api/expenses/${expense_id}`, ctx)
      if (!res.ok) return '経費詳細を取得できませんでした。'
      const data = await res.json()
      const exp  = data?.expense
      if (!exp) return '経費情報が見つかりませんでした。'
      const CATS: Record<string, string> = { transport: '交通費', parking: '駐車料', supplies: '備品費', consumables: '消耗品費', other: 'その他' }
      const name = exp.profiles?.name ?? '申請者不明'
      const cat  = CATS[exp.category] ?? exp.category ?? 'その他'
      const amt  = `${Number(exp.amount ?? 0).toLocaleString('ja-JP')}円`
      const date = exp.expense_date ? `、${exp.expense_date}` : ''
      const desc = exp.description ? `、用途: ${exp.description}` : (exp.title ? `、件名: ${exp.title}` : '')
      const stat = exp.status ?? '不明'
      return `経費詳細 — ${name}、${cat}、${amt}${date}${desc}、ステータス: ${stat}、ID: ${expense_id}`
    } catch { return '経費詳細の取得中にエラーが発生しました。' }
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
      // API: { corrections: [...] }
      const items = Array.isArray(data?.corrections) ? data.corrections : []
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

const getRevenueTool = tool({
  name:        'get_revenue_summary',
  description: '売上情報（今月売上・今年売上・未入金・未請求）をHIKARU登録データから取得する。売上・未入金・未請求の質問に使う。利益計算はしない。今月・今年以外の期間には対応しない。',
  parameters:  z.object({}),
  execute: async (_, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const res  = await apiGet('/api/dashboard', ctx)
      if (!res.ok) return '売上情報を取得できませんでした。'
      const data = await res.json()
      const rev  = data?.revenue
      if (!rev || typeof rev !== 'object') return '現在HIKARUに登録されている情報からは売上を確認できません。'
      // API: revenue.this_month/this_year = 税込合計、unpaid = 請求済未入金、unbilled = 未請求
      const fmt = (n: number): string => `${Math.round(n).toLocaleString('ja-JP')}円`
      const parts: string[] = []
      if (rev.this_month != null) parts.push(`今月の売上: ${fmt(rev.this_month)}`)
      if (rev.this_year  != null) parts.push(`今年の売上: ${fmt(rev.this_year)}`)
      if (rev.unpaid     != null) parts.push(`未入金: ${fmt(rev.unpaid)}`)
      if (rev.unbilled   != null) parts.push(`未請求: ${fmt(rev.unbilled)}`)
      return parts.length > 0
        ? `HIKARUのデータ — ${parts.join('、')}`
        : '売上情報を確認できませんでした。'
    } catch { return '売上情報の取得中にエラーが発生しました。' }
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
- 売上金額はget_revenue_summaryのTool Result以外から答えない。推測・計算禁止。
- 「利益は？」→ Tool不使用。「現在HIKARUに登録されている情報だけでは正確な利益は算出できません。」と答える。
- 「先月の売上」等の今月・今年以外の期間 → 「現在のDashboardでは今月と今年の売上を確認できます。」と答える。

## Write操作のルール（重要）
承認操作（経費承認・勤怠修正承認）は必ずpropose_actionを使う。
直接実行は禁止。必ず管理者の確認を取ること。

propose_action の使い方:
1. まずRead Toolで承認対象のID・詳細を確認する（例: get_pending_expenses）
2. propose_actionを呼ぶ（action, params, confirmationMessage を指定）
3. finalOutputに確認文を書く（例: 「田中さんの3,200円交通費を承認します。よろしいですか？」）
4. 管理者が「はい」と言ったら自動的にServerが実行する

## Project 操作手順
1. get_projects で一覧取得（status/project_type/search指定可）→ project_id確認
2. 詳細は get_project_detail、担当者は get_project_assignments
3. ステータス変更: propose_action(console.update_project_status, {projectId, status: active/paused/completed/cancelled})
4. 案件作成: nameを確認してから propose_action(console.create_project, {name, project_type, start_date})
5. 案件削除は音声実行不可。「管理画面から操作してください。」と答える。

## Expense Approve/Reject 手順
1. get_pending_expenses か get_expense_detail で対象IDを確認する
2. 対象が複数あり特定できない場合 → 「どの経費を承認/却下しますか？」と聞く。勝手に選ばない。
3. 却下の場合は必ず理由をユーザーから先に聞く（APIが却下理由必須のため）

## propose_actionのactionとparamsの対応
- console.update_project_status → params: { projectId, status }            「○○案件を稼働中に変更します。よろしいですか？」
- console.create_project        → params: { name, project_type, start_date } 「○○スポット案件を登録します。よろしいですか？」
- console.approve_expense       → params: { expenseId }                     「〇〇さんの〇〇円の経費申請を承認します。よろしいですか？」
- console.reject_expense        → params: { expenseId, reject_reason }      「〇〇さんの〇〇円を理由『...』で却下します。よろしいですか？」
- console.approve_attendance    → params: { correctionId }                  「〇〇さんの勤怠修正申請を承認します。よろしいですか？」

## L5禁止操作（音声実行不可）
削除・権限変更・全件承認・大量操作は実行不可。
「全部承認して」等はエラーとして説明すること。`

export const consoleJarvisAgent = new Agent<ConsoleAgentSDKContext>({
  name:         'JARVIS Console',
  instructions: CONSOLE_SYSTEM_PROMPT,
  model:        'gpt-4o-mini',
  tools:        [
    getDashboardTool,
    getProjectsTool,
    getProjectDetailTool,
    getProjectAssignmentsTool,
    getNotificationsTool,
    getPendingExpensesTool,
    getExpenseDetailTool,
    getPendingAttendanceTool,
    getPendingRequestsTool,
    getRevenueTool,
    getQualitySummaryTool,
    proposeActionTool,
    navigateTool,
  ],
})
