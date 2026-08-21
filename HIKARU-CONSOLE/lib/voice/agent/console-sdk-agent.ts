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
  description: '案件・現場・仕事の一覧や状況を確認する。「案件教えて」「今どんな仕事が入ってる？」「今日動いてる現場ある？」「スポットの案件だけ見たい」等。画面を開く依頼ではなく情報を求める場合に使う。',
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
  description: '指定IDの案件担当者を実名で取得する。担当追加/変更/削除前にも使う。',
  parameters:  z.object({ project_id: z.string().describe('案件のID') }),
  execute: async ({ project_id }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const res  = await apiGet(`/api/projects/${project_id}/assignments`, ctx)
      if (!res.ok) return '担当者情報を取得できませんでした。'
      const data = await res.json()
      const assignments: { assignee_type: string; assignee_id: string }[] = Array.isArray(data?.data) ? data.data : []
      if (assignments.length === 0) return `この案件に担当者はいません。[assignments:[]|project_id:${project_id}]`

      const empIds     = assignments.filter(a => a.assignee_type === 'employee').map(a => a.assignee_id)
      const partnerIds = assignments.filter(a => a.assignee_type === 'partner').map(a => a.assignee_id)
      const empMap     = new Map<string, string>()
      const partnerMap = new Map<string, string>()

      await Promise.all([
        empIds.length > 0
          ? apiGet('/api/employees?pageSize=200', ctx).then(r => r.json()).then(d => {
              for (const e of (d.data ?? [])) empMap.set(e.id, e.name ?? e.id)
            }).catch(() => {})
          : Promise.resolve(),
        partnerIds.length > 0
          ? apiGet('/api/partners?pageSize=200', ctx).then(r => r.json()).then(d => {
              for (const p of (d.data ?? [])) partnerMap.set(p.id, p.company_name ?? p.contact_person_name ?? p.id)
            }).catch(() => {})
          : Promise.resolve(),
      ])

      const empNames:     string[] = empIds.map(id => empMap.get(id)).filter((n): n is string => !!n)
      const partnerNames: string[] = partnerIds.map(id => partnerMap.get(id)).filter((n): n is string => !!n)
      const unknownCount = assignments.length - empNames.length - partnerNames.length

      const lines: string[] = []
      if (empNames.length     > 0) lines.push(`従業員: ${empNames.join('、')}`)
      if (partnerNames.length > 0) lines.push(`協力業者: ${partnerNames.join('、')}`)
      if (unknownCount        > 0) lines.push(`${unknownCount}名の名前を確認できませんでした。`)

      const assignmentList = assignments.map(a => {
        const nameMap = a.assignee_type === 'employee' ? empMap : partnerMap
        return `${a.assignee_type}:${a.assignee_id}:${nameMap.get(a.assignee_id) ?? '不明'}`
      }).join(', ')

      return `担当: ${lines.join('、')} [project_id:${project_id}|assignments:${assignmentList}]`
    } catch { return '担当者情報の取得中にエラーが発生しました。' }
  },
})

const resolvePersonTool = tool({
  name:        'resolve_person',
  description: '名前キーワードで従業員・協力業者を検索し候補を返す。担当追加/変更前に必ず使う。AI生成ID禁止。',
  parameters:  z.object({ name: z.string().describe('検索する名前キーワード') }),
  execute: async ({ name }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    if (!name?.trim()) return '名前が必要です。'
    try {
      const [empRes, partnerRes] = await Promise.all([
        apiGet(`/api/employees?search=${encodeURIComponent(name)}&pageSize=10`, ctx),
        apiGet(`/api/partners?search=${encodeURIComponent(name)}&pageSize=10`, ctx),
      ])
      const empData     = empRes.ok     ? await empRes.json()     : { data: [] }
      const partnerData = partnerRes.ok ? await partnerRes.json() : { data: [] }
      const employees:  any[] = empData.data     ?? []
      const partners:   any[] = partnerData.data ?? []
      const total = employees.length + partners.length

      if (total === 0) return `「${name}」という担当者は見つかりませんでした。`

      const candidates = [
        ...employees.map((e: any) => `employee:${e.id}:${e.name}`),
        ...partners.map((p: any) => `partner:${p.id}:${p.company_name ?? p.contact_person_name}`),
      ].join(' / ')

      if (total === 1) {
        const type    = employees.length > 0 ? 'employee' : 'partner'
        const id      = employees.length > 0 ? employees[0].id : partners[0].id
        const resName = employees.length > 0 ? employees[0].name : (partners[0].company_name ?? partners[0].contact_person_name)
        return `1名確定: ${type}:${id}:${resName} [resolved:${type}:${id}:${resName}]`
      }
      return `「${name}」で${total}名見つかりました。どの方ですか？ [candidates: ${candidates}]`
    } catch { return '検索中にエラーが発生しました。' }
  },
})

const resolveClientTool = tool({
  name:        'resolve_client',
  description: '顧客名で検索しclient_idを返す。案件作成/編集前に必ず使う。新規顧客登録は行わない。',
  parameters:  z.object({ name: z.string().describe('顧客名キーワード') }),
  execute: async ({ name }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    if (!name?.trim()) return '顧客名が必要です。'
    try {
      const res = await apiGet(`/api/clients?search=${encodeURIComponent(name)}&pageSize=10`, ctx)
      if (!res.ok) return '顧客情報を取得できませんでした。'
      const data    = await res.json()
      const clients: any[] = data.clients ?? []

      if (clients.length === 0) {
        return `「${name}」という顧客は見つかりませんでした。新規顧客の登録は管理画面から行ってください。`
      }
      const list = clients.map((c: any) => `${c.id}:${c.name}`).join(' / ')
      if (clients.length === 1) {
        return `顧客「${clients[0].name}」確定 [clientId:${clients[0].id}|clientName:${clients[0].name}]`
      }
      return `「${name}」に一致する顧客が${clients.length}件あります。どの顧客ですか？ [candidates: ${list}]`
    } catch { return '顧客検索中にエラーが発生しました。' }
  },
})

const resolveStoreTool = tool({
  name:        'resolve_store',
  description: '店舗名で検索しstore_idを返す。client_idが決まっている場合は指定する。',
  parameters:  z.object({
    name:      z.string().describe('店舗名キーワード'),
    client_id: z.string().optional().describe('顧客ID（指定するとその顧客の店舗に絞り込む）'),
  }),
  execute: async ({ name, client_id }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    if (!name?.trim()) return '店舗名が必要です。'
    try {
      const q = new URLSearchParams({ search: name, pageSize: '10' })
      if (client_id) q.set('client_id', client_id)
      const res = await apiGet(`/api/stores?${q}`, ctx)
      if (!res.ok) return '店舗情報を取得できませんでした。'
      const data   = await res.json()
      const stores: any[] = data.stores ?? []

      if (stores.length === 0) return `「${name}」という店舗は見つかりませんでした。`

      const list = stores.map((s: any) => {
        const clientName = s.clients?.name ?? ''
        return `${s.id}:${s.name}${clientName ? `(${clientName})` : ''}`
      }).join(' / ')

      if (stores.length === 1) {
        return `店舗「${stores[0].name}」確定 [storeId:${stores[0].id}|storeName:${stores[0].name}|clientId:${stores[0].client_id}]`
      }
      return `「${name}」に一致する店舗が${stores.length}件あります。どの店舗ですか？ [candidates: ${list}]`
    } catch { return '店舗検索中にエラーが発生しました。' }
  },
})

const getNotificationsTool = tool({
  name:        'get_notifications',
  description: '管理者向け通知・未読件数を確認する。「通知ある？」「何か連絡来てる？」「未読メッセージある？」等に使う。',
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
  description: '承認待ちの経費申請一覧を取得する。「経費申請来てる？」「まだ処理してない経費ある？」「お金の申請が上がってる？」「経費確認して」等に使う。データを取得する場合に使う（画面を開く場合はnavigateを使う）。',
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
  description: '勤怠修正申請の承認待ちを確認する。「勤怠修正来てる？」「勤務時間の直しの申請ある？」「修正申請何件？」等に使う。',
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
  description: '売上情報（今月・今年・未入金・未請求）をHIKARU登録データから取得する。「今月売上いくら？」「売上どんな感じ？」「まだ入ってきてないお金ある？」「未請求はいくら？」等に使う。利益計算・今月今年以外の期間は対応不可。',
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
  description: 'L4 Write操作をユーザーに提案し確認を求める。実行はしない。propose_actionを呼んだ後、finalOutputに確認文を書くこと。',
  parameters:  z.object({
    action:              z.string().describe('console.update_project_status / console.create_project / console.update_project / console.add_assignment / console.remove_assignment / console.replace_assignment / console.approve_expense / console.approve_attendance / console.reject_expense'),
    params:              z.record(z.string(), z.string()).optional().describe('actionに必要なパラメータ（flat string値のみ）'),
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
  description: '指定のページへ移動・画面を開く。「〜開いて」「〜の画面にして」「〜に移動して」等の画面操作依頼に使う。情報を確認したい場合は移動ではなくデータ取得ツールを使う。',
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

## 自然言語理解の原則
ユーザーは機能名や画面名を正確に言わない。発話の意味・文脈から最適なToolを選ぶ。
言い換え・口語・省略表現を理解すること。

## Read vs Navigate の判断
「〜教えて」「どうなってる？」「いくら？」「何件？」「誰が？」「ある？」→ データ取得Tool
「〜開いて」「〜の画面にして」「〜に移動して」「〜見せて」→ navigate（データ取得しない）
情報を聞いている場合はNavigationだけで済ませない。画面を開く依頼ではデータ取得Toolを勝手に使わない。

## 未対応機能
まだToolが接続されていない機能（在庫数・契約詳細・報告書内容等）を聞かれた場合:
架空データを返さず「現在Voiceから確認する機能はまだ接続されていません。画面は開けます。」と答える。

## 重要なルール
- Toolで取得した情報のみを事実として扱う。ID・名前をAIで生成しない。
- 2〜3文以内で音声向けに簡潔に回答する
- 売上金額はget_revenue_summaryのTool Result以外から答えない。推測・計算禁止。
- 「利益は？」→ Tool不使用。「現在HIKARUに登録されている情報だけでは正確な利益は算出できません。」と答える。
- 「先月の売上」等の今月・今年以外の期間 → 「現在のDashboardでは今月と今年の売上を確認できます。」と答える。

## Write操作のルール（最重要）
全てのWriteはpropose_actionを使う。直接実行禁止。必ず管理者の確認を取ること。
propose_action → finalOutputに確認文 → 管理者「はい」→ Serverが実行。

## Project 操作手順
1. get_projects で一覧取得（status/project_type/search指定可）→ project_id確認
2. 詳細は get_project_detail、担当者実名は get_project_assignments
3. ステータス変更: propose_action(console.update_project_status, {projectId, status: active/paused/completed/cancelled})
4. 案件削除は音声実行不可。「管理画面から操作してください。」と答える。

## 担当者操作（add/remove/replace）
担当者ID・名前は必ずresolve_personで解決する。AI生成ID禁止。

担当追加:
1. get_project_assignments でprojectId確認・現在の担当者取得
2. resolve_person(name) → 候補確認（1件確定 or 複数の場合は選択してもらう）
3. 重複確認（すでに担当なら追加しない）
4. propose_action(console.add_assignment, {projectId, assignee_type, assignee_id, assignee_name})
   確認文例: 「この案件に田中さんを担当として追加します。よろしいですか？」

担当削除:
1. get_project_assignments で現在の担当者取得
2. 対象をresolve_personまたはassignment一覧から特定
3. propose_action(console.remove_assignment, {projectId, assignee_type, assignee_id, assignee_name})
   確認文例: 「田中さんをこの案件の担当から外します。よろしいですか？」

担当変更（from→to）:
1. 両者をresolve_personで解決
2. propose_action(console.replace_assignment, {projectId, from_type, from_id, from_name, to_type, to_id, to_name})
   確認文例: 「田中さんから佐藤さんに担当を変更します。よろしいですか？」

## 案件作成（完全版）
1. 案件名・種別(spot/recurring/hotel)を確認
2. 顧客名が分かる場合: resolve_client(name) → clientId確定
3. 店舗名が分かる場合: resolve_store(name, client_id) → storeId確定
4. propose_action(console.create_project, {name, project_type, start_date, end_date, location_name, client_id, store_id, notes})
   確認文例: 「ABC株式会社、銀座店、スポット案件『床清掃』を8月25日開始で登録します。よろしいですか？」
5. 情報が不足している場合は確認に進む前に聞く。勝手に登録しない。

## 案件編集
1. 対象案件のprojectIdを確認（get_projects等）
2. 現在値を get_project_detail で確認してから変更内容をユーザーに確認
3. 顧客/店舗変更の場合は resolve_client / resolve_store で解決
4. propose_action(console.update_project, {projectId, [変更フィールド]: 値})
   確認文例: 「『○○案件』の開始日を8月25日から8月30日に変更します。よろしいですか？」
変更可能フィールド: name / project_type / start_date / end_date / location_name / address / notes / client_id / store_id

## 顧客・店舗 Resolution
- resolve_client: 1件確定→clientId使用。複数→どの顧客か聞く。0件→「見つかりませんでした」
- resolve_store: clientId決定後にclient_id指定で絞り込む
- 解決前にpropose_actionを呼ばない。新規顧客・店舗を勝手に作らない。

## Expense Approve/Reject 手順
1. get_pending_expenses か get_expense_detail で対象IDを確認する
2. 対象が複数あり特定できない場合 → 「どの経費を承認/却下しますか？」と聞く。勝手に選ばない。
3. 却下の場合は必ず理由をユーザーから先に聞く（APIが却下理由必須のため）

## propose_actionのactionとparamsの対応
- console.update_project_status → params: { projectId, status }
- console.create_project        → params: { name, project_type, start_date?, end_date?, location_name?, client_id?, store_id?, notes? }
- console.update_project        → params: { projectId, [変更フィールド]: 値 }
- console.add_assignment        → params: { projectId, assignee_type, assignee_id, assignee_name }
- console.remove_assignment     → params: { projectId, assignee_type, assignee_id, assignee_name }
- console.replace_assignment    → params: { projectId, from_type, from_id, from_name, to_type, to_id, to_name }
- console.approve_expense       → params: { expenseId }
- console.reject_expense        → params: { expenseId, reject_reason }
- console.approve_attendance    → params: { correctionId }

## L5禁止操作（音声実行不可）
削除・権限変更・全件承認・大量操作は実行不可。
「全部承認して」等はエラーとして説明すること。
案件削除は音声禁止。「管理画面から操作してください。」と答える。`

export const consoleJarvisAgent = new Agent<ConsoleAgentSDKContext>({
  name:         'JARVIS Console',
  instructions: CONSOLE_SYSTEM_PROMPT,
  model:        'gpt-4o-mini',
  tools:        [
    getDashboardTool,
    getProjectsTool,
    getProjectDetailTool,
    getProjectAssignmentsTool,
    resolvePersonTool,
    resolveClientTool,
    resolveStoreTool,
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
