// ============================================================
// JARVIS CONSOLE — Agents SDK Definition
// System Agent とは完全分離。Admin/Manager Context専用。
// ============================================================

import { Agent, tool, setTracingDisabled } from '@openai/agents'
import { z } from 'zod'
import { isValidConsoleAction, getConsoleActionLevel } from '@/lib/voice/registry/console.actions'
import { getJstDateString, getJstYear, getJstMonth } from '@/lib/billing/date-utils'

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

const NOTIF_TYPE_LABELS_SDK: Record<string, string> = {
  attendance_correction_submitted: '勤怠修正申請',
  expense_submitted:               '経費申請',
  project_report_submitted:        '報告書提出',
  project_proposal_submitted:      '提案提出',
}

const getNotificationsTool = tool({
  name:        'get_notifications',
  description: '管理者向け通知一覧を取得する。「通知ある？」「未読ある？」「最近の通知は？」「経費の通知きてる？」等。このToolは通知を読み取るだけで既読にしない。',
  parameters:  z.object({
    unread_only: z.string().optional().describe('trueで未読のみ表示（省略時は全件）'),
  }),
  execute: async ({ unread_only }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const res  = await apiGet('/api/console-notifications', ctx)
      if (!res.ok) return '通知を取得できませんでした。'
      const data  = await res.json()
      let list: any[] = data.notifications ?? []
      const unread = data.unread_count ?? list.filter((n: any) => !n.is_read).length
      const total  = list.length
      if (unread_only === 'true') list = list.filter((n: any) => !n.is_read)
      if (list.length === 0) return unread_only === 'true' ? '未読の通知はありません。' : '通知はありません。'
      const lines = list.slice(0, 10).map((n: any, i: number) => {
        const typeLabel = NOTIF_TYPE_LABELS_SDK[n.type] ?? n.type ?? ''
        const readLabel = n.is_read ? '（既読）' : '【未読】'
        const title     = n.title ?? (n.body ? String(n.body).slice(0, 30) : '通知')
        const date      = n.created_at ? new Date(n.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
        return `${i + 1}件目 ${readLabel}${typeLabel}「${title}」${date} [id:${n.id}]`
      })
      return `未読:${unread}件 / 全${total}件\n${lines.join('\n')}`
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
  description: '勤怠修正申請の承認待ち一覧を確認する。「勤怠修正来てる？」「修正申請何件？」「未処理の勤怠申請ある？」等に使う。',
  parameters:  z.object({}),
  execute: async (_, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const res   = await apiGet('/api/attendance/corrections?status=submitted', ctx)
      if (!res.ok) return '勤怠修正申請を確認できませんでした。'
      const data  = await res.json()
      const items = Array.isArray(data?.corrections) ? data.corrections : []
      if (items.length === 0) return '承認待ちの勤怠修正申請はありません。'
      const list = items.slice(0, 5).map((e: any, i: number) => {
        const name = e.worker?.name ?? '従業員'
        const date = e.attendance_record?.work_date ?? '不明'
        return `${i + 1}件目: ${name}、${date} [id:${e.id}]`
      }).join(' / ')
      return `承認待ちの勤怠修正申請が${items.length}件あります。${list}`
    } catch { return '勤怠修正申請の取得中にエラーが発生しました。' }
  },
})

const getAttendanceCorrectionDetailTool = tool({
  name:        'get_attendance_correction_detail',
  description: '指定した勤怠修正申請の詳細（現在値・申請値・理由）を取得する。「1件目詳しく」「この修正何を変えたいの？」「理由は？」等に使う。',
  parameters:  z.object({ correction_id: z.string().describe('修正申請のID') }),
  execute: async ({ correction_id }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    if (!correction_id) return '修正申請IDが必要です。'
    try {
      const res = await apiGet(`/api/attendance/corrections/${correction_id}`, ctx)
      if (!res.ok) return '修正申請情報を取得できませんでした。'
      const data = await res.json()
      const c    = data?.correction
      if (!c) return '修正申請が見つかりませんでした。'
      const name   = c.worker?.name ?? '従業員'
      const date   = c.attendance_record?.work_date ?? '不明'
      const reason = c.reason ? `理由: ${c.reason}` : '理由なし'
      const fmtTime = (ts: string | null) => ts
        ? new Date(ts).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' })
        : '未設定'
      const parts: string[] = [`${name}さんの${date}の勤怠修正申請`]
      if (c.attendance_record?.clock_in || c.requested_clock_in)
        parts.push(`出勤: ${fmtTime(c.attendance_record?.clock_in)}→${fmtTime(c.requested_clock_in)}`)
      if (c.attendance_record?.clock_out || c.requested_clock_out)
        parts.push(`退勤: ${fmtTime(c.attendance_record?.clock_out)}→${fmtTime(c.requested_clock_out)}`)
      parts.push(reason)
      return `${parts.join('、')} [id:${correction_id}]`
    } catch { return '修正申請詳細の取得中にエラーが発生しました。' }
  },
})

const getAttendanceTodayTool = tool({
  name:        'get_attendance_today',
  description: '今日の出勤状況を確認する。「今日誰来てる？」「今日の勤怠状況教えて」「今出勤中の人いる？」「まだ働いてる人いる？」「退勤してない人いる？」等に使う。',
  parameters:  z.object({}),
  execute: async (_, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const todayJst = getJstDateString()
      const y = todayJst.slice(0, 4)
      const m = String(parseInt(todayJst.slice(5, 7), 10))
      const res = await apiGet(`/api/attendance?year=${y}&month=${m}`, ctx)
      if (!res.ok) return '勤怠情報を取得できませんでした。'
      const data    = await res.json()
      const records: any[] = (data.data ?? []).filter((r: any) => r.work_date === todayJst)
      if (records.length === 0) return `今日（${todayJst}）の打刻記録はまだありません。`
      const nameMap = new Map<string, string>()
      for (const s of (data.summary ?? [])) nameMap.set(s.worker_id, s.name)
      const fmtTime = (ts: string | null) => ts
        ? new Date(ts).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' })
        : null
      const working: string[] = [], done: string[] = []
      for (const r of records) {
        const name = nameMap.get(r.worker_id) ?? '従業員'
        const ci = fmtTime(r.clock_in), co = fmtTime(r.clock_out)
        if (ci && !co) working.push(`${name}(${ci}〜)`)
        else if (ci && co) done.push(`${name}(${ci}〜${co})`)
      }
      const parts: string[] = [`今日（${todayJst}）の出勤: ${records.length}名打刻済み`]
      if (working.length > 0) parts.push(`勤務中: ${working.slice(0, 5).join('、')}`)
      if (done.length    > 0) parts.push(`退勤済: ${done.slice(0, 5).join('、')}`)
      return parts.join('。')
    } catch { return '今日の勤怠情報の取得中にエラーが発生しました。' }
  },
})

const getAttendanceRecordsTool = tool({
  name:        'get_attendance_records',
  description: '指定した従業員の勤怠記録詳細を取得する。「田中さん今日の勤怠教えて」「この人昨日何時に来た？」「今月の出勤記録見せて」「何時に退勤した？」等に使う。',
  parameters:  z.object({
    employee_id: z.string().describe('従業員のID'),
    year:        z.string().optional().describe('年（例: 2026）省略時は今年'),
    month:       z.string().optional().describe('月（例: 8）省略時は今月'),
  }),
  execute: async ({ employee_id, year, month }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    if (!employee_id) return '従業員IDが必要です。'
    try {
      const empRes = await apiGet(`/api/employees/${employee_id}`, ctx)
      if (!empRes.ok) return '従業員情報を取得できませんでした。'
      const empData = await empRes.json()
      const e = empData?.data
      if (!e) return '従業員が見つかりませんでした。'
      if (!e.auth_user_id) return `${e.name}さんはシステムアカウントがないため勤怠記録を確認できません。`
      const y = year  ?? String(getJstYear())
      const m = month ?? String(getJstMonth())
      const attRes = await apiGet(`/api/attendance?worker_id=${e.auth_user_id}&year=${y}&month=${m}`, ctx)
      if (!attRes.ok) return '勤怠記録を取得できませんでした。'
      const attData = await attRes.json()
      const records: any[] = attData.data ?? []
      if (records.length === 0) return `${e.name}さんの${m}月の勤怠記録はありません。`
      const summary: any = (attData.summary ?? []).find((s: any) => s.worker_id === e.auth_user_id)
      const fmtTime = (ts: string | null) => ts
        ? new Date(ts).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' })
        : '--:--'
      const recent = records.slice(-5).reverse().map((r: any) =>
        `${r.work_date} ${fmtTime(r.clock_in)}〜${fmtTime(r.clock_out)}`
      ).join(' / ')
      const hours = summary ? Math.round(summary.totalWorkMins / 60 * 10) / 10 : 0
      return `${e.name}さんの${m}月: 出勤${summary?.workDays ?? records.length}日、総勤務${hours}時間。直近記録: ${recent}`
    } catch { return '勤怠記録の取得中にエラーが発生しました。' }
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
  description: '品質KPIサマリーを取得する。「品質状況教えて」「最近の品質どう？」「平均スコアは？」「低評価どれくらいある？」「高優先度アラートある？」等。',
  parameters:  z.object({
    period: z.string().optional().describe('7d/30d/90d/ytd（省略時30d）'),
  }),
  execute: async ({ period }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const p = period ?? '30d'
      const res  = await apiGet(`/api/quality?period=${p}`, ctx)
      if (!res.ok) return '品質情報を取得できませんでした。'
      const data = await res.json()
      const kpi  = data.kpi ?? {}
      if (kpi.response_count === 0 && (kpi.total_completed ?? 0) === 0) {
        return `指定期間（${p}）の品質評価データはありません。`
      }
      const parts: string[] = []
      if (kpi.total_completed    != null) parts.push(`完了作業: ${kpi.total_completed}件`)
      if (kpi.response_count     != null) parts.push(`顧客アンケート: ${kpi.response_count}件（回答率${kpi.response_rate ?? 0}%）`)
      if (kpi.avg_hqs            != null) parts.push(`HIKARU品質スコア: ${Math.round((kpi.avg_hqs as number) * 10) / 10}点`)
      if (kpi.avg_ai_score       != null) parts.push(`AI評価平均: ${Math.round((kpi.avg_ai_score as number) * 10) / 10}点`)
      if (kpi.avg_rating         != null) parts.push(`顧客評価平均: ★${Math.round((kpi.avg_rating as number) * 10) / 10}（5段階）`)
      if (kpi.five_star_rate     != null) parts.push(`5つ星率: ${kpi.five_star_rate}%`)
      if ((kpi.low_rating_count  as number) > 0) parts.push(`低評価（1-2点）: ${kpi.low_rating_count}件（${kpi.low_rating_rate}%）`)
      if ((kpi.high_priority_count as number) > 0) parts.push(`高優先度アラート: ${kpi.high_priority_count}件`)
      return parts.join('\n')
    } catch { return '品質評価情報の取得中にエラーが発生しました。' }
  },
})

// ─── Client Tools ────────────────────────────────────────────

const getClientsTool = tool({
  name:        'get_clients',
  description: '顧客・取引先の一覧や状況を確認する。「顧客一覧教えて」「取引先どんな会社ある？」「ABC社って登録されてる？」「何社取引してる？」等。画面を開く依頼ではなく情報を求める場合に使う。',
  parameters:  z.object({
    search: z.string().optional().describe('顧客名・コード・メールで検索'),
  }),
  execute: async ({ search }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const q = new URLSearchParams({ pageSize: '10' })
      if (search) q.set('search', search)
      const res  = await apiGet(`/api/clients?${q}`, ctx)
      if (!res.ok) return '顧客情報を取得できませんでした。'
      const data    = await res.json()
      const clients: any[] = data.clients ?? []
      const total   = data.count ?? clients.length
      if (total === 0) return search ? `「${search}」という顧客は見つかりませんでした。` : '顧客は登録されていません。'
      const items = clients.slice(0, 5).map((c: any, i: number) => {
        const status = c.is_active === false ? '停止中' : '稼働中'
        return `${i + 1}件目: ${c.name}${c.code ? `（${c.code}）` : ''}、${status} [id:${c.id}]`
      }).join(' / ')
      return `顧客${total}社。${items}`
    } catch { return '顧客一覧の取得中にエラーが発生しました。' }
  },
})

const getClientDetailTool = tool({
  name:        'get_client_detail',
  description: '指定した顧客の詳細情報（連絡先・住所・担当者等）を取得する。「この会社の情報教えて」「電話番号は？」「メールアドレスは？」「住所は？」等。一覧でIDを確認後に使う。',
  parameters:  z.object({ client_id: z.string().describe('顧客のID') }),
  execute: async ({ client_id }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    if (!client_id) return '顧客IDが必要です。'
    try {
      const res  = await apiGet(`/api/clients/${client_id}`, ctx)
      if (!res.ok) return '顧客情報を取得できませんでした。'
      const data = await res.json()
      const c    = data?.data
      if (!c) return '顧客が見つかりませんでした。'
      const status   = c.is_active === false ? '停止中' : '稼働中'
      const phone    = c.phone    ? `、電話: ${c.phone}`         : ''
      const email    = c.email    ? `、メール: ${c.email}`       : ''
      const address  = c.address  ? `、住所: ${c.address}`       : ''
      const contact  = c.contact_name ? `、担当: ${c.contact_name}` : ''
      const notes    = c.notes    ? `、備考: ${c.notes}`         : ''
      return `顧客詳細 — ${c.name}${c.code ? `（${c.code}）` : ''}、${status}${phone}${email}${address}${contact}${notes} [id:${client_id}]`
    } catch { return '顧客詳細の取得中にエラーが発生しました。' }
  },
})

const getClientStoresTool = tool({
  name:        'get_client_stores',
  description: '指定した顧客に紐づく店舗一覧を取得する。「この会社の店舗教えて」「このお客さんの拠点は？」「どこに店舗ある？」等。',
  parameters:  z.object({ client_id: z.string().describe('顧客のID') }),
  execute: async ({ client_id }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    if (!client_id) return '顧客IDが必要です。'
    try {
      const res  = await apiGet(`/api/stores?client_id=${client_id}&pageSize=20`, ctx)
      if (!res.ok) return '店舗情報を取得できませんでした。'
      const data   = await res.json()
      const stores: any[] = data.stores ?? []
      if (stores.length === 0) return 'この顧客に紐づく店舗は登録されていません。'
      const items = stores.slice(0, 8).map((s: any, i: number) =>
        `${i + 1}件目: ${s.name}${s.address ? `、${s.address}` : ''} [id:${s.id}]`
      ).join(' / ')
      return `店舗${stores.length}件。${items}`
    } catch { return '店舗情報の取得中にエラーが発生しました。' }
  },
})

const getClientProjectsTool = tool({
  name:        'get_client_projects',
  description: '指定した顧客に紐づく案件一覧を取得する。「この会社の案件教えて」「この顧客の仕事は？」「今この会社で動いてる現場ある？」等。',
  parameters:  z.object({ client_id: z.string().describe('顧客のID') }),
  execute: async ({ client_id }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    if (!client_id) return '顧客IDが必要です。'
    try {
      const res  = await apiGet(`/api/projects?client_id=${client_id}&pageSize=10`, ctx)
      if (!res.ok) return '案件情報を取得できませんでした。'
      const data     = await res.json()
      const projects: any[] = data.projects ?? []
      const total    = data.count ?? projects.length
      if (total === 0) return 'この顧客に紐づく案件はありません。'
      const PT: Record<string, string> = { spot: 'スポット', recurring: '定期', hotel: 'ホテル' }
      const ST: Record<string, string> = { active: '稼働中', paused: '停止中', completed: '完了', cancelled: 'キャンセル' }
      const items = projects.slice(0, 5).map((p: any, i: number) =>
        `${i + 1}件目: ${p.name}、${PT[p.project_type] ?? p.project_type}、${ST[p.status] ?? p.status} [id:${p.id}]`
      ).join(' / ')
      return `案件${total}件。${items}`
    } catch { return '案件情報の取得中にエラーが発生しました。' }
  },
})

// ─── Manual Tools ───────────────────────────────────────────

const getManualsTool = tool({
  name:        'get_manuals',
  description: 'マニュアル・手順書・作業資料の一覧を確認・検索する。「マニュアル一覧教えて」「床清掃のマニュアルある？」「FAQマニュアルは？」「カテゴリ○○のマニュアルは？」等。',
  parameters:  z.object({
    search:   z.string().optional().describe('タイトル・本文で検索'),
    type:     z.string().optional().describe('text/faq/note/pdf/image/video'),
    category: z.string().optional().describe('カテゴリ名で絞り込み（自由テキスト）'),
  }),
  execute: async ({ search, type: manualType, category }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const q = new URLSearchParams()
      if (search)     q.set('search', search)
      if (manualType) q.set('type', manualType)
      if (category)   q.set('category', category)
      const res  = await apiGet(`/api/manuals?${q}`, ctx)
      if (!res.ok) return 'マニュアル情報を取得できませんでした。'
      const data     = await res.json()
      const manuals: any[] = data.data ?? []
      if (manuals.length === 0) return search ? `「${search}」に関するマニュアルは見つかりませんでした。` : 'マニュアルは登録されていません。'
      const TYPE_LABEL: Record<string, string> = { text: '文章', faq: 'FAQ', note: '注意事項', pdf: 'PDF', image: '画像', video: '動画' }
      const items = manuals.slice(0, 5).map((m: any, i: number) => {
        const t   = TYPE_LABEL[m.type] ?? m.type
        const cat = m.category ? `、${m.category}` : ''
        return `${i + 1}件目: ${m.title}（${t}${cat}） [id:${m.id}]`
      }).join(' / ')
      const suffix = manuals.length > 5 ? `（最初の5件）` : ''
      return `マニュアル${manuals.length}件${suffix}。${items}`
    } catch { return 'マニュアル一覧の取得中にエラーが発生しました。' }
  },
})

const getManualDetailTool = tool({
  name:        'get_manual_detail',
  description: '指定したマニュアルの詳細情報（タイトル・種別・カテゴリ・本文概要等）を取得する。「1件目詳しく」「このマニュアルの内容教えて」「カテゴリは？」等。一覧でIDを確認後に使う。',
  parameters:  z.object({ manual_id: z.string().describe('マニュアルのID') }),
  execute: async ({ manual_id }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    if (!manual_id) return 'マニュアルIDが必要です。'
    try {
      const res  = await apiGet(`/api/manuals/${manual_id}`, ctx)
      if (!res.ok) return 'マニュアル情報を取得できませんでした。'
      const data = await res.json()
      const m    = data?.data
      if (!m) return 'マニュアルが見つかりませんでした。'
      const TYPE_LABEL: Record<string, string> = { text: '文章', faq: 'FAQ', note: '注意事項', pdf: 'PDF', image: '画像', video: '動画' }
      const parts: string[] = [`「${m.title}」、種別: ${TYPE_LABEL[m.type] ?? m.type}`]
      if (m.category)    parts.push(`カテゴリ: ${m.category}`)
      if (m.is_template) parts.push('テンプレート')
      if (m.projects?.name) parts.push(`案件: ${m.projects.name}`)
      if (m.content) {
        const preview = m.content.slice(0, 150)
        parts.push(`内容: ${preview}${m.content.length > 150 ? '…（続きは管理画面で確認してください）' : ''}`)
      } else if (m.type === 'pdf' || m.type === 'image' || m.type === 'video') {
        parts.push(`${TYPE_LABEL[m.type]}ファイル（内容は管理画面で確認してください）`)
      }
      return `${parts.join('、')} [id:${manual_id}]`
    } catch { return 'マニュアル詳細の取得中にエラーが発生しました。' }
  },
})

const resolveManualTool = tool({
  name:        'resolve_manual',
  description: 'タイトルや検索語からマニュアルのIDを解決する。Write操作前に必ず使う。「床清掃マニュアルを見つけて」等。',
  parameters:  z.object({ search: z.string().describe('タイトルや内容で検索するキーワード') }),
  execute: async ({ search }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    if (!search) return '検索キーワードが必要です。'
    try {
      const res  = await apiGet(`/api/manuals?search=${encodeURIComponent(search)}`, ctx)
      if (!res.ok) return 'マニュアルを検索できませんでした。'
      const data     = await res.json()
      const manuals: any[] = data.data ?? []
      if (manuals.length === 0) return `「${search}」に関するマニュアルは見つかりませんでした。`
      const TYPE_LABEL: Record<string, string> = { text: '文章', faq: 'FAQ', note: '注意事項', pdf: 'PDF', image: '画像', video: '動画' }
      if (manuals.length === 1) {
        const m = manuals[0]
        return `manual:${m.id}:${m.title}（${TYPE_LABEL[m.type] ?? m.type}）`
      }
      const list = manuals.slice(0, 5).map((m: any, i: number) => {
        const t = TYPE_LABEL[m.type] ?? m.type
        const cat = m.category ? `、${m.category}` : ''
        return `${i + 1}件目: ${m.title}（${t}${cat}） [id:${m.id}]`
      }).join(' / ')
      return `「${search}」で${manuals.length}件見つかりました。どのマニュアルですか？ ${list}`
    } catch { return 'マニュアルの解決中にエラーが発生しました。' }
  },
})

// ─── Partner Tools ──────────────────────────────────────────

const getPartnersTool = tool({
  name:        'get_partners',
  description: '協力業者・外注先・パートナーの一覧を確認する。「協力業者一覧教えて」「登録してる外注業者は？」「○○会社って登録されてる？」「有効な協力業者は？」等。',
  parameters:  z.object({
    search: z.string().optional().describe('会社名・担当者名・メールで検索'),
    status: z.string().optional().describe('active=契約中 / suspended=一時停止 / terminated=契約終了'),
  }),
  execute: async ({ search, status }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const q = new URLSearchParams({ pageSize: '10' })
      if (search) q.set('search', search)
      if (status) q.set('status', status)
      const res  = await apiGet(`/api/partners?${q}`, ctx)
      if (!res.ok) return '協力業者情報を取得できませんでした。'
      const data     = await res.json()
      const partners: any[] = data.data ?? []
      const total    = data.count ?? partners.length
      if (total === 0) return search ? `「${search}」という協力業者は見つかりませんでした。` : '協力業者は登録されていません。'
      const ST: Record<string, string> = { active: '契約中', suspended: '一時停止', terminated: '契約終了' }
      const items = partners.slice(0, 5).map((p: any, i: number) => {
        const contact = p.contact_person_name ? `、担当: ${p.contact_person_name}` : ''
        return `${i + 1}件目: ${p.company_name}${contact}、${ST[p.status] ?? p.status} [id:${p.id}]`
      }).join(' / ')
      return `協力業者${total}社。${items}`
    } catch { return '協力業者一覧の取得中にエラーが発生しました。' }
  },
})

const getPartnerDetailTool = tool({
  name:        'get_partner_detail',
  description: '指定した協力業者の詳細情報（連絡先・担当者・住所・担当案件等）を取得する。「この会社の情報教えて」「電話番号は？」「担当者は？」「この業者の案件ある？」等。一覧でIDを確認後に使う。',
  parameters:  z.object({ partner_id: z.string().describe('協力業者のID') }),
  execute: async ({ partner_id }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    if (!partner_id) return '協力業者IDが必要です。'
    try {
      const res  = await apiGet(`/api/partners/${partner_id}`, ctx)
      if (!res.ok) return '協力業者情報を取得できませんでした。'
      const data = await res.json()
      const p    = data?.data
      if (!p) return '協力業者が見つかりませんでした。'
      const ST: Record<string, string> = { active: '契約中', suspended: '一時停止', terminated: '契約終了' }
      const parts: string[] = [`${p.company_name}、${ST[p.status] ?? p.status ?? '不明'}`]
      if (p.contact_person_name) parts.push(`担当: ${p.contact_person_name}`)
      if (p.phone)               parts.push(`電話: ${p.phone}`)
      if (p.email)               parts.push(`メール: ${p.email}`)
      if (p.address)             parts.push(`住所: ${p.address}`)
      const assignCount = Array.isArray(p.assignments) ? p.assignments.length : 0
      if (assignCount > 0) {
        const ST2: Record<string, string> = { active: '稼働中', paused: '停止中', completed: '完了', cancelled: 'キャンセル' }
        const aList = p.assignments.slice(0, 3).map((a: any) => {
          const proj = a.projects
          return proj ? `${proj.name}（${ST2[proj.status] ?? proj.status}）` : '不明案件'
        }).join('、')
        parts.push(`担当案件${assignCount}件: ${aList}`)
      }
      return `${parts.join('、')} [id:${partner_id}]`
    } catch { return '協力業者詳細の取得中にエラーが発生しました。' }
  },
})

const resolvePartnerTool = tool({
  name:        'resolve_partner',
  description: '会社名や担当者名から協力業者のIDを解決する。Write操作前に必ず使う。「○○会社のID教えて」「○○建設を見つけて」等。',
  parameters:  z.object({ name: z.string().describe('検索する会社名または担当者名キーワード') }),
  execute: async ({ name }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    if (!name) return '検索キーワードが必要です。'
    try {
      const res  = await apiGet(`/api/partners?search=${encodeURIComponent(name)}&pageSize=10`, ctx)
      if (!res.ok) return '協力業者を検索できませんでした。'
      const data     = await res.json()
      const partners: any[] = data.data ?? []
      const total    = data.count ?? partners.length
      if (total === 0) return `「${name}」という協力業者は見つかりませんでした。`
      const ST: Record<string, string> = { active: '契約中', suspended: '一時停止', terminated: '契約終了' }
      if (total === 1) {
        const p = partners[0]
        const contact = p.contact_person_name ? `、担当: ${p.contact_person_name}` : ''
        return `partner:${p.id}:${p.company_name}${contact}`
      }
      const list = partners.slice(0, 5).map((p: any, i: number) => {
        const contact = p.contact_person_name ? `（担当: ${p.contact_person_name}）` : ''
        const st = ST[p.status] ?? p.status ?? '不明'
        return `${i + 1}件目: ${p.company_name}${contact}、${st} [id:${p.id}]`
      }).join(' / ')
      return `「${name}」で${total}件見つかりました。どの業者ですか？ ${list}`
    } catch { return '協力業者の解決中にエラーが発生しました。' }
  },
})

// ─── Employee Tools ─────────────────────────────────────────

const getEmployeesTool = tool({
  name:        'get_employees',
  description: '従業員・スタッフの一覧を取得する。「従業員一覧教えて」「今誰が登録されてる？」「スタッフどんな人いる？」「田中さんって登録されてる？」等。',
  parameters:  z.object({
    search: z.string().optional().describe('名前・かな・メール・社員番号で検索'),
    status: z.string().optional().describe('active/on_leave/resigned/suspended'),
  }),
  execute: async ({ search, status }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const q = new URLSearchParams({ pageSize: '10' })
      if (search) q.set('search', search)
      if (status) q.set('status', status)
      const res  = await apiGet(`/api/employees?${q}`, ctx)
      if (!res.ok) return '従業員情報を取得できませんでした。'
      const data      = await res.json()
      const employees: any[] = data.data ?? []
      const total     = data.count ?? employees.length
      if (total === 0) return search ? `「${search}」という従業員は見つかりませんでした。` : '従業員は登録されていません。'
      const ST: Record<string, string> = { active: '在籍中', on_leave: '休職中', resigned: '退職', suspended: '利用停止' }
      const items = employees.slice(0, 5).map((e: any, i: number) => {
        const num = e.employee_number ? `（${e.employee_number}）` : ''
        const dept = e.department ? `、${e.department}` : ''
        return `${i + 1}件目: ${e.name}${num}、${ST[e.status] ?? e.status}${dept} [id:${e.id}]`
      }).join(' / ')
      return `従業員${total}名。${items}`
    } catch { return '従業員一覧の取得中にエラーが発生しました。' }
  },
})

const getEmployeeDetailTool = tool({
  name:        'get_employee_detail',
  description: '指定した従業員の詳細情報（連絡先・役職・入社日等）を取得する。「田中さんの情報教えて」「電話番号は？」「この人の役職は？」「いつ入社した？」等。一覧でIDを確認後に使う。',
  parameters:  z.object({ employee_id: z.string().describe('従業員のID') }),
  execute: async ({ employee_id }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    if (!employee_id) return '従業員IDが必要です。'
    try {
      const res  = await apiGet(`/api/employees/${employee_id}`, ctx)
      if (!res.ok) return '従業員情報を取得できませんでした。'
      const data = await res.json()
      const e    = data?.data
      if (!e) return '従業員が見つかりませんでした。'
      const ST: Record<string, string> = { active: '在籍中', on_leave: '休職中', resigned: '退職', suspended: '利用停止' }
      const parts: string[] = [`${e.name}${e.employee_number ? `（${e.employee_number}）` : ''}、${ST[e.status] ?? e.status}`]
      if (e.department) parts.push(`部署: ${e.department}`)
      if (e.position)   parts.push(`役職: ${e.position}`)
      if (e.phone)      parts.push(`電話: ${e.phone}`)
      if (e.email)      parts.push(`メール: ${e.email}`)
      if (e.hire_date)  parts.push(`入社: ${e.hire_date}`)
      const assignCount = Array.isArray(e.assignments) ? e.assignments.length : 0
      if (assignCount > 0) parts.push(`担当案件: ${assignCount}件`)
      return `${parts.join('、')} [id:${employee_id}]`
    } catch { return '従業員詳細の取得中にエラーが発生しました。' }
  },
})

const getEmployeeProjectsTool = tool({
  name:        'get_employee_projects',
  description: '指定した従業員が担当している案件を取得する。「この人の担当案件は？」「田中さん今どの現場入ってる？」「この人の仕事は？」等。',
  parameters:  z.object({ employee_id: z.string().describe('従業員のID') }),
  execute: async ({ employee_id }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    if (!employee_id) return '従業員IDが必要です。'
    try {
      const res  = await apiGet(`/api/employees/${employee_id}`, ctx)
      if (!res.ok) return '従業員情報を取得できませんでした。'
      const data        = await res.json()
      const assignments: any[] = data?.data?.assignments ?? []
      if (assignments.length === 0) return 'この従業員に紐づく担当案件はありません。'
      const ST: Record<string, string> = { active: '稼働中', paused: '停止中', completed: '完了', cancelled: 'キャンセル' }
      const items = assignments.slice(0, 5).map((a: any, i: number) => {
        const p = a.projects
        if (!p) return `${i + 1}件目: 不明`
        return `${i + 1}件目: ${p.name}、${ST[p.status] ?? p.status} [id:${p.id}]`
      }).join(' / ')
      return `担当案件${assignments.length}件。${items}`
    } catch { return '担当案件の取得中にエラーが発生しました。' }
  },
})

const getEmployeeAttendanceTool = tool({
  name:        'get_employee_attendance_summary',
  description: '指定した従業員の勤怠概要（出勤日数・勤務時間）を取得する。「この人今月何日出勤した？」「田中さんの勤務状況は？」「今月の出勤状況は？」等。',
  parameters:  z.object({
    employee_id: z.string().describe('従業員のID'),
    year:        z.string().optional().describe('年（例: 2026）省略時は今年'),
    month:       z.string().optional().describe('月（例: 8）省略時は今月'),
  }),
  execute: async ({ employee_id, year, month }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    if (!employee_id) return '従業員IDが必要です。'
    try {
      const empRes = await apiGet(`/api/employees/${employee_id}`, ctx)
      if (!empRes.ok) return '従業員情報を取得できませんでした。'
      const empData = await empRes.json()
      const e = empData?.data
      if (!e) return '従業員が見つかりませんでした。'
      if (!e.auth_user_id) return `${e.name}さんはシステムアカウントがないため勤怠データを確認できません。`
      const y = year  ?? String(getJstYear())
      const m = month ?? String(getJstMonth())
      const attRes = await apiGet(`/api/attendance?worker_id=${e.auth_user_id}&year=${y}&month=${m}`, ctx)
      if (!attRes.ok) return '勤怠情報を取得できませんでした。'
      const attData  = await attRes.json()
      const summary: any[] = attData.summary ?? []
      const ws = summary.find((s: any) => s.worker_id === e.auth_user_id)
      if (!ws) return `${e.name}さんの${m}月の勤怠記録はありません。`
      const hours = Math.round(ws.totalWorkMins / 60 * 10) / 10
      return `${e.name}さんの${m}月の勤怠: 出勤${ws.workDays}日、合計${hours}時間`
    } catch { return '勤怠情報の取得中にエラーが発生しました。' }
  },
})

const getEmployeeShiftsTool = tool({
  name:        'get_employee_shifts',
  description: '指定した従業員のシフト一覧を取得する。「この人今週のシフトは？」「田中さん次いつ入ってる？」「この人明日入ってる？」等。',
  parameters:  z.object({
    employee_id: z.string().describe('従業員のID'),
    date_from:   z.string().optional().describe('開始日（YYYY-MM-DD）省略時は今日'),
    date_to:     z.string().optional().describe('終了日（YYYY-MM-DD）省略時は1週間後'),
  }),
  execute: async ({ employee_id, date_from, date_to }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    if (!employee_id) return '従業員IDが必要です。'
    try {
      const todayJst = getJstDateString()
      const from     = date_from ?? todayJst
      const end7     = new Date(todayJst)
      end7.setDate(end7.getDate() + 7)
      const toDate   = date_to ?? end7.toISOString().slice(0, 10)
      const q    = new URLSearchParams({ employee_id, date_from: from, date_to: toDate })
      const res  = await apiGet(`/api/shifts?${q}`, ctx)
      if (!res.ok) return 'シフト情報を取得できませんでした。'
      const data   = await res.json()
      const shifts: any[] = data.shifts ?? []
      if (shifts.length === 0) return 'この期間のシフトは登録されていません。'
      const items = shifts.slice(0, 7).map((s: any) => {
        const start = s.start_time ? s.start_time.slice(0, 5) : ''
        const end   = s.end_time   ? s.end_time.slice(0, 5)   : ''
        const proj  = s.projects?.name ?? ''
        return `${s.shift_date} ${start}〜${end}${proj ? `（${proj}）` : ''}`
      }).join(' / ')
      return `${shifts.length}件のシフト。${items}`
    } catch { return 'シフト情報の取得中にエラーが発生しました。' }
  },
})

const getEmployeeQualityTool = tool({
  name:        'get_employee_quality_summary',
  description: '指定した従業員の品質評価サマリーを取得する。「田中さんの品質どう？」「この人の評価は？」「平均スコアは？」等。評価は案件単位で個人帰属が明確なデータのみ使用。',
  parameters:  z.object({
    employee_id: z.string().describe('従業員のID'),
    days:        z.string().optional().describe('集計対象日数（例: 30）省略時は30日'),
  }),
  execute: async ({ employee_id, days }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    if (!employee_id) return '従業員IDが必要です。'
    try {
      const empRes = await apiGet(`/api/employees/${employee_id}`, ctx)
      if (!empRes.ok) return '従業員情報を取得できませんでした。'
      const empData = await empRes.json()
      const e = empData?.data
      if (!e) return '従業員が見つかりませんでした。'
      if (!e.auth_user_id) return `${e.name}さんはシステムアカウントがないため品質評価データを確認できません。`
      const d = days ? Math.min(parseInt(days, 10), 365) : 30
      const qRes = await apiGet(`/api/quality/workers?worker_id=${e.auth_user_id}&days=${d}`, ctx)
      if (!qRes.ok) return '品質情報を取得できませんでした。'
      const qData   = await qRes.json()
      const workers: any[] = qData.workers ?? []
      const w = workers.find((x: any) => x.worker_id === e.auth_user_id)
      if (!w || w.job_count === 0) return `${e.name}さんの過去${d}日間に完了した仕事の品質評価データはありません。`
      const parts: string[] = [`${e.name}さんの品質評価（過去${d}日間）`]
      parts.push(`評価件数: ${w.job_count}件`)
      if (w.avg_hqs         != null) parts.push(`HIKARUスコア: ${Math.round(w.avg_hqs * 10) / 10}点`)
      if (w.avg_ai_score    != null) parts.push(`AI評価平均: ${Math.round(w.avg_ai_score * 10) / 10}点`)
      if (w.avg_customer_score != null) parts.push(`顧客評価平均: ${Math.round(w.avg_customer_score * 10) / 10}点`)
      return parts.join('、')
    } catch { return '品質情報の取得中にエラーが発生しました。' }
  },
})

// ─── Shift Tools ─────────────────────────────────────────────

const getShiftsTool = tool({
  name:        'get_shifts',
  description: 'シフト一覧を取得する。「今日誰入ってる？」「明日のシフトは？」「今週のシフト教えて」「ABC案件のシフトは？」「田中さん今週いつ入ってる？」等。',
  parameters:  z.object({
    date_from:   z.string().optional().describe('開始日（YYYY-MM-DD）省略時は今日'),
    date_to:     z.string().optional().describe('終了日（YYYY-MM-DD）省略時はdate_fromと同じ日'),
    employee_id: z.string().optional().describe('従業員IDで絞り込み'),
    project_id:  z.string().optional().describe('案件IDで絞り込み'),
    status:      z.string().optional().describe('scheduled/confirmed/cancelled等'),
  }),
  execute: async ({ date_from, date_to, employee_id, project_id, status }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const todayJst = getJstDateString()
      const from = date_from ?? todayJst
      const to   = date_to   ?? from
      const q = new URLSearchParams({ date_from: from, date_to: to })
      if (employee_id) q.set('employee_id', employee_id)
      if (project_id)  q.set('project_id', project_id)
      if (status)      q.set('status', status)
      const res    = await apiGet(`/api/shifts?${q}`, ctx)
      if (!res.ok) return 'シフト情報を取得できませんでした。'
      const data   = await res.json()
      const shifts: any[] = data.shifts ?? []
      if (shifts.length === 0) return `${from === to ? from : `${from}〜${to}`}のシフトはありません。`
      const ST: Record<string, string> = { scheduled: '予定', confirmed: '確定', completed: '完了', cancelled: 'キャンセル', in_progress: '作業中' }
      const items = shifts.slice(0, 8).map((s: any, i: number) => {
        const name = s.assignee_type === 'employee'
          ? (s.employees?.name ?? '従業員')
          : (s.partners?.company_name ?? s.partners?.contact_person_name ?? '協力業者')
        const proj = s.projects?.name ?? '案件不明'
        const st = s.start_time?.slice(0, 5) ?? '', et = s.end_time?.slice(0, 5) ?? ''
        const stat = ST[s.status] ?? s.status ?? ''
        return `${i + 1}件目: ${s.shift_date} ${st}〜${et} ${name}（${proj}）${stat !== '予定' ? `[${stat}]` : ''} [id:${s.id}]`
      }).join(' / ')
      return `${shifts.length}件のシフト。${items}`
    } catch { return 'シフト一覧の取得中にエラーが発生しました。' }
  },
})

const getShiftDetailTool = tool({
  name:        'get_shift_detail',
  description: '指定したシフトの詳細情報を取得する。「1件目詳しく」「このシフト何時から？」「担当誰？」「どの案件？」等。一覧でIDを確認後に使う。',
  parameters:  z.object({ shift_id: z.string().describe('シフトのID') }),
  execute: async ({ shift_id }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    if (!shift_id) return 'シフトIDが必要です。'
    try {
      const res  = await apiGet(`/api/shifts/${shift_id}`, ctx)
      if (!res.ok) return 'シフト情報を取得できませんでした。'
      const data = await res.json()
      const s    = data?.shift
      if (!s) return 'シフトが見つかりませんでした。'
      const name = s.assignee_type === 'employee'
        ? (s.employees?.name ?? '従業員')
        : (s.partners?.company_name ?? s.partners?.contact_person_name ?? '協力業者')
      const ST: Record<string, string> = { scheduled: '予定', confirmed: '確定', completed: '完了', cancelled: 'キャンセル', in_progress: '作業中' }
      const parts = [
        `${s.shift_date} ${s.start_time?.slice(0, 5)}〜${s.end_time?.slice(0, 5)}`,
        `担当: ${name}`,
        `案件: ${s.projects?.name ?? '不明'}`,
        `ステータス: ${ST[s.status] ?? s.status}`,
      ]
      if (s.notes) parts.push(`備考: ${s.notes}`)
      return `${parts.join('、')} [id:${shift_id}]`
    } catch { return 'シフト詳細の取得中にエラーが発生しました。' }
  },
})

const getShiftAttendanceStatusTool = tool({
  name:        'get_shift_attendance_status',
  description: '今日シフトがある従業員の打刻状況を確認する。「今日シフトあるのに来てない人いる？」「シフトより遅れてる人いる？」「まだ退勤してない人いる？」等に使う。',
  parameters:  z.object({}),
  execute: async (_, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const todayJst = getJstDateString()
      const y = String(getJstYear()), m = String(getJstMonth())
      const [shiftsRes, empRes, attRes] = await Promise.all([
        apiGet(`/api/shifts?date_from=${todayJst}&date_to=${todayJst}`, ctx),
        apiGet('/api/employees?pageSize=200', ctx),
        apiGet(`/api/attendance?year=${y}&month=${m}`, ctx),
      ])
      if (!shiftsRes.ok || !attRes.ok) return 'データの取得中にエラーが発生しました。'
      const shiftsData = await shiftsRes.json()
      const empData    = empRes.ok ? await empRes.json() : { data: [] }
      const attData    = await attRes.json()
      const shifts: any[] = (shiftsData.shifts ?? []).filter((s: any) => s.assignee_type === 'employee')
      if (shifts.length === 0) return `今日（${todayJst}）は従業員のシフトが登録されていません。`
      const empMap = new Map<string, string>()
      for (const e of (empData.data ?? [])) if (e.auth_user_id) empMap.set(e.id, e.auth_user_id)
      const clockedWorkerIds = new Set<string>(
        (attData.data ?? []).filter((r: any) => r.work_date === todayJst && r.clock_in).map((r: any) => r.worker_id)
      )
      const noShow: string[] = [], working: string[] = [], done: string[] = []
      const fmtTime = (ts: string) => new Date(ts).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' })
      for (const s of shifts) {
        const empName = s.employees?.name ?? '従業員'
        const authId  = empMap.get(s.employee_id)
        if (!authId) continue
        const attRecord = (attData.data ?? []).find((r: any) => r.work_date === todayJst && r.worker_id === authId)
        if (!attRecord) {
          noShow.push(`${empName}（${s.start_time?.slice(0, 5)}〜${s.end_time?.slice(0, 5)})`)
        } else if (!attRecord.clock_out) {
          working.push(`${empName}（${fmtTime(attRecord.clock_in)}〜）`)
        } else {
          done.push(`${empName}（〜${fmtTime(attRecord.clock_out)}退勤）`)
        }
      }
      const parts: string[] = []
      if (noShow.length  > 0) parts.push(`打刻なし: ${noShow.join('、')}`)
      if (working.length > 0) parts.push(`勤務中: ${working.join('、')}`)
      if (done.length    > 0) parts.push(`退勤済: ${done.join('、')}`)
      return parts.length > 0 ? `今日（${todayJst}）のシフト対比: ${parts.join('。')}` : `今日のシフトメンバー全員が打刻済みです。`
    } catch { return 'シフト×勤怠比較の取得中にエラーが発生しました。' }
  },
})

const getSettingsTool = tool({
  name:        'get_settings',
  description: '会社設定・会社情報を取得する。「設定どうなってる？」「会社名は？」「電話番号は？」「住所は？」「メールは？」「印鑑は？」等。',
  parameters:  z.object({}),
  execute: async (_, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const res = await apiGet('/api/settings', ctx)
      if (!res.ok) return '設定情報を取得できませんでした。'
      const data = await res.json()
      const c    = data.data
      if (!c) return '設定情報が見つかりませんでした。'
      const parts = ['【会社設定】']
      if (c.name)    parts.push(`会社名: ${c.name}`)
      if (c.address) parts.push(`住所: ${c.address}`)
      if (c.phone)   parts.push(`電話: ${c.phone}`)
      if (c.email)   parts.push(`メール: ${c.email}`)
      if (c.postal_code) parts.push(`郵便番号: ${c.postal_code}`)
      parts.push(`電子印: ${c.has_seal ? '登録済み' : '未登録'}`)
      if (c.bank_name) parts.push('銀行情報: 登録済み（詳細は管理画面で確認）')
      if (c.invoice_registration_number) parts.push('インボイス登録番号: 登録済み（詳細は管理画面で確認）')
      return parts.join('\n')
    } catch { return '設定情報の取得中にエラーが発生しました。' }
  },
})

const getAnalyticsTool = tool({
  name:        'get_analytics',
  description: 'AI分析・品質・業務の総合データを取得する。「AI分析して」「全体的にどう？」「ランキングは？」「品質分布は？」「月次推移は？」「一番品質高い店舗は？」「評価が低い作業者は？」等。全期間集計。',
  parameters:  z.object({
    focus: z.string().optional().describe('overview/store/worker/distribution/trends/spots（省略時は全体）'),
  }),
  execute: async ({ focus }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const res = await apiGet('/api/analytics', ctx)
      if (!res.ok) return 'AI分析データを取得できませんでした。'
      const data = await res.json()
      const { overview, trends, storeRankings, workerRankings, distribution, spotRankings } = data
      const f = focus ?? 'overview'
      const parts: string[] = []

      if (!focus || f === 'overview') {
        if (overview) {
          parts.push('【概要（全期間）】')
          parts.push(`案件数: ${overview.totalProjects ?? 0}件・店舗数: ${overview.totalStores ?? 0}店`)
          parts.push(`作業件数合計: ${overview.totalJobs ?? 0}件（完了: ${overview.completedJobs ?? 0}・進行中: ${overview.activeJobs ?? 0}）`)
          parts.push(`今月の作業: ${overview.thisMonthJobs ?? 0}件`)
          if (overview.avgQualityScore != null) parts.push(`AI品質スコア平均: ${overview.avgQualityScore}点（0-100）`)
          if ((overview.totalEvaluations ?? 0) > 0) {
            parts.push(`AI評価: ${overview.totalEvaluations}件（合格${overview.passRate}%・やり直し${overview.redoRate}%）`)
          }
          parts.push(`報告書: ${overview.totalReports ?? 0}件・写真: ${overview.totalPhotos ?? 0}枚`)
        }
      }

      if (!focus || f === 'overview' || f === 'trends') {
        const recentTrends = ((trends ?? []) as any[]).slice(-3).filter((t: any) => t.jobCount > 0)
        if (recentTrends.length > 0) {
          parts.push('【最近3ヶ月のトレンド】')
          for (const t of recentTrends) {
            parts.push(`${t.label}: 作業${t.jobCount}件 ${t.avgScore != null ? 'スコア' + t.avgScore + '点' : 'スコアなし'}`)
          }
        }
      }

      if (!focus || f === 'store') {
        const topStores = ((storeRankings ?? []) as any[]).slice(0, 5)
        if (topStores.length > 0) {
          parts.push('【店舗品質ランキング（上位5件）】')
          topStores.forEach((s: any, i: number) => {
            parts.push(`${i + 1}位 ${s.storeName}: ${s.avgScore != null ? s.avgScore + '点' : '--'} （${s.jobCount}件）`)
          })
        }
      }

      if (!focus || f === 'worker') {
        const topWorkers = ((workerRankings ?? []) as any[]).slice(0, 5)
        if (topWorkers.length > 0) {
          parts.push('【作業者品質ランキング（上位5件）】')
          topWorkers.forEach((w: any, i: number) => {
            parts.push(`${i + 1}位 ${w.workerName}: ${w.avgScore != null ? w.avgScore + '点' : '--'} 合格率${w.passRate}% （${w.jobCount}件）`)
          })
        }
      }

      if (!focus || f === 'distribution') {
        const dist: any[] = (distribution ?? []) as any[]
        if (dist.some((d: any) => d.count > 0)) {
          parts.push('【品質スコア分布】')
          for (const d of dist) {
            if (d.count > 0) parts.push(`${d.label}: ${d.count}件（${d.pct}%）`)
          }
        }
      }

      if (f === 'spots') {
        const topSpots = ((spotRankings ?? []) as any[]).slice(0, 3)
        if (topSpots.length > 0) {
          parts.push('【撮影箇所別スコア（上位3件）】')
          topSpots.forEach((s: any, i: number) => {
            parts.push(`${i + 1}位 ${s.spotName}: ${s.avgScore}点 やり直し率${s.redoRate}%`)
          })
        }
      }

      return parts.length > 0 ? parts.join('\n') : '分析データがありません。'
    } catch { return 'AI分析データの取得中にエラーが発生しました。' }
  },
})

const getSurveysTool = tool({
  name:        'get_surveys',
  description: '顧客アンケート・満足度調査の一覧を取得する。「顧客満足度どう？」「低い評価ある？」「クレームある？」「1星の評価ある？」「ABC案件の評価は？」等。',
  parameters:  z.object({
    project_id: z.string().optional().describe('案件IDで絞り込む'),
    rating:     z.string().optional().describe('星評価で絞り込む (1-5)'),
    date_from:  z.string().optional().describe('開始日 YYYY-MM-DD'),
    date_to:    z.string().optional().describe('終了日 YYYY-MM-DD'),
  }),
  execute: async ({ project_id, rating, date_from, date_to }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const q = new URLSearchParams({ limit: '10' })
      if (project_id) q.set('project_id', project_id)
      if (rating)     q.set('rating',     rating)
      if (date_from)  q.set('date_from',  date_from)
      if (date_to)    q.set('date_to',    date_to)
      const res = await apiGet(`/api/surveys?${q}`, ctx)
      if (!res.ok) return 'アンケートデータを取得できませんでした。'
      const data = await res.json()
      const surveys: any[] = data.surveys ?? []
      const total = data.total ?? 0
      if (surveys.length === 0) return '顧客アンケートはありません。'
      const starMap = ['', '★☆☆☆☆', '★★☆☆☆', '★★★☆☆', '★★★★☆', '★★★★★']
      const lines = surveys.slice(0, 10).map((s: any) => {
        const star    = starMap[s.rating] ?? `${s.rating}点`
        const proj    = s.jobs?.projects?.name ?? '案件不明'
        const worker  = s.jobs?.worker?.name ?? ''
        const date    = s.jobs?.work_date ?? ''
        const comment = s.comment ? `「${String(s.comment).slice(0, 40)}...」` : ''
        return `${date} ${proj} ${worker} ${star} ${comment}`
      })
      const suffix = total > 10 ? `（全${total}件中10件）` : `（全${total}件）`
      return `${lines.join('\n')}\n${suffix}`
    } catch { return '顧客アンケートの取得中にエラーが発生しました。' }
  },
})

const getWorkersQualityTool = tool({
  name:        'get_workers_quality',
  description: '作業者別の品質集計を取得する。「作業者の品質ランキングは？」「評価が高い作業者は？」「品質が低い作業者いる？」等。',
  parameters:  z.object({
    days: z.string().optional().describe('集計対象日数（省略時30日）'),
  }),
  execute: async ({ days }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const d = days ?? '30'
      const res = await apiGet(`/api/quality/workers?days=${d}`, ctx)
      if (!res.ok) return '作業者品質データを取得できませんでした。'
      const data = await res.json()
      const workers: any[] = data.workers ?? []
      if (workers.length === 0) return `過去${d}日間の品質評価データはありません。`
      const lines = workers.slice(0, 10).map((w: any, i: number) => {
        const hqs  = w.avg_hqs      != null ? `HQS:${Math.round(w.avg_hqs)}点` : ''
        const ai   = w.avg_ai_score != null ? `AI:${Math.round(w.avg_ai_score)}点` : ''
        const cust = w.avg_rating   != null ? `顧客:★${(w.avg_rating as number).toFixed(1)}` : ''
        const low  = w.low_rating_count > 0 ? `低評価:${w.low_rating_count}件` : ''
        return `${i + 1}位 ${w.name}（${w.job_count}件）${[hqs, ai, cust, low].filter(Boolean).join('・')}`
      })
      return `作業者品質（過去${d}日）:\n${lines.join('\n')}`
    } catch { return '作業者品質の取得中にエラーが発生しました。' }
  },
})

const getProjectQualityTool = tool({
  name:        'get_project_quality',
  description: '案件別の品質トレンドを取得する。「ABC案件の品質どう？」「この現場の評価は？」等。project_idが必要。get_projectsで取得したidを使う。',
  parameters:  z.object({
    project_id: z.string().describe('案件ID（get_projectsのid）'),
    days:       z.string().optional().describe('集計日数（省略時90日）'),
  }),
  execute: async ({ project_id, days }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const d = days ?? '90'
      const res = await apiGet(`/api/quality/trends?project_id=${project_id}&days=${d}`, ctx)
      if (!res.ok) return '案件品質データを取得できませんでした。'
      const data = await res.json()
      const trends: any[] = data.trends ?? []
      if (trends.length === 0) return `この案件の過去${d}日間の品質評価データはありません。`
      const scores = trends.map((t: any) => t.hqs).filter((v: any) => v != null) as number[]
      const avgHqs = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
      const latest = trends[trends.length - 1]
      const parts  = [
        `作業${trends.length}回（過去${d}日間）`,
        avgHqs != null ? `平均HQS: ${avgHqs}点` : '',
        latest?.hqs        != null ? `最新スコア: ${Math.round(latest.hqs)}点（${latest.work_date}）` : '',
        latest?.ai_score   != null ? `最新AI評価: ${Math.round(latest.ai_score)}点` : '',
        latest?.rating     != null ? `最新顧客評価: ★${latest.rating}` : '',
      ].filter(Boolean)
      return parts.join('\n')
    } catch { return '案件品質の取得中にエラーが発生しました。' }
  },
})

const CONTRACT_STATUS_LABELS_SDK: Record<string, string> = {
  draft: '下書き', active: '有効', signed: '締結済み', reviewing: '確認中',
  expired: '期限切れ', terminated: '解約',
}
const CONTRACT_TYPE_LABELS_SDK: Record<string, string> = {
  service: 'サービス', maintenance: 'メンテナンス', spot: 'スポット',
  lease: 'リース', nda: 'NDA', other: 'その他',
}

const getContractsTool = tool({
  name:        'get_contracts',
  description: '契約一覧を取得する。「契約一覧」「ABC社の契約」「有効な契約」「もうすぐ期限切れ」「今月終わる契約」等。',
  parameters:  z.object({
    search:        z.string().optional().describe('契約名・番号の検索キーワード'),
    status:        z.string().optional().describe('draft/active/signed/reviewing/expired/terminated'),
    contract_type: z.string().optional().describe('service/maintenance/spot/lease/nda/other'),
    counterparty:  z.string().optional().describe('client または partner'),
    expiring_days: z.string().optional().describe('期限が何日以内か (例: 30)'),
  }),
  execute: async ({ search, status, contract_type, counterparty, expiring_days }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const q = new URLSearchParams()
      if (search)        q.set('search',        search)
      if (status)        q.set('status',        status)
      if (contract_type) q.set('contract_type', contract_type)
      if (counterparty)  q.set('counterparty_type', counterparty)
      if (expiring_days) q.set('expiring_days', expiring_days)
      const res = await apiGet(`/api/contracts?${q}`, ctx)
      if (!res.ok) return '契約一覧を取得できませんでした。'
      const data = await res.json()
      const contracts: any[] = data.contracts ?? []
      const kpi = data.kpi ?? {}
      if (contracts.length === 0) return '契約はありません。'
      const lines = contracts.slice(0, 10).map((c: any) => {
        const stat  = CONTRACT_STATUS_LABELS_SDK[c.status] ?? c.status
        const party = c.counterparty_type === 'client' ? (c.clients?.name ?? '顧客不明') : (c.partners?.company_name ?? '業者不明')
        const end   = c.end_date ? `終了:${c.end_date}` : '期限なし'
        const days  = c.deadline?.daysUntilExpiry != null
          ? (c.deadline.daysUntilExpiry < 0 ? '期限切れ' : `残${c.deadline.daysUntilExpiry}日`)
          : ''
        return `${c.title}（${party}）[${stat}] ${end}${days ? ' ' + days : ''} [id:${c.id}]`
      })
      const suffix  = contracts.length > 10 ? `（全${contracts.length}件中10件）` : `（全${contracts.length}件）`
      const kpiLine = `有効:${kpi.active ?? 0}件・30日以内期限:${kpi.expiring30d ?? 0}件・期限切れ:${kpi.expired ?? 0}件`
      return [kpiLine, ...lines, suffix].join('\n')
    } catch { return '契約一覧の取得中にエラーが発生しました。' }
  },
})

const getContractDetailTool = tool({
  name:        'get_contract_detail',
  description: '契約の詳細を取得する。「詳しく」「いつまで？」「更新日は？」「金額は？」「状況は？」等。get_contractsで取得したidを使う。',
  parameters:  z.object({
    contract_id: z.string().describe('契約ID（get_contractsのid）'),
  }),
  execute: async ({ contract_id }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const res = await apiGet(`/api/contracts/${contract_id}`, ctx)
      if (!res.ok) return '契約が見つかりませんでした。'
      const data     = await res.json()
      const contract = data.contract
      if (!contract) return '契約が見つかりませんでした。'
      const status = CONTRACT_STATUS_LABELS_SDK[contract.status] ?? contract.status
      const ctype  = CONTRACT_TYPE_LABELS_SDK[contract.contract_type] ?? contract.contract_type
      const party  = contract.counterparty_type === 'client'
        ? (contract.clients?.name ?? '顧客不明')
        : (contract.partners?.company_name ?? '業者不明')
      const parts = [
        `契約: ${contract.title}`,
        `相手: ${party}（${contract.counterparty_type === 'client' ? '顧客' : '協力業者'}）`,
        `種別: ${ctype}`,
        `ステータス: ${status}`,
      ]
      if (contract.contract_number) parts.push(`契約番号: ${contract.contract_number}`)
      if (contract.projects?.name)  parts.push(`案件: ${contract.projects.name}`)
      if (contract.start_date)      parts.push(`開始日: ${contract.start_date}`)
      if (contract.end_date)        parts.push(`終了日: ${contract.end_date}`)
      if (contract.renewal_date)    parts.push(`更新日: ${contract.renewal_date}`)
      if (contract.auto_renewal != null) parts.push(`自動更新: ${contract.auto_renewal ? 'あり' : 'なし'}`)
      const dl = contract.deadline
      if (dl?.daysUntilExpiry != null) {
        const dLabel = dl.daysUntilExpiry < 0 ? `${Math.abs(dl.daysUntilExpiry)}日超過` : `残${dl.daysUntilExpiry}日`
        parts.push(`期限: ${dLabel}（${dl.label ?? dl.urgency}）`)
      }
      if (contract.notes) parts.push(`備考: ${contract.notes}`)
      return parts.join('\n')
    } catch { return '契約詳細の取得中にエラーが発生しました。' }
  },
})

const STOCK_STATUS_LABELS_SDK: Record<string, string> = {
  normal: '正常', low_stock: '在庫少', out_of_stock: '在庫切れ', inactive: '無効',
}

const getInventoryTool = tool({
  name:        'get_inventory',
  description: '在庫品目の一覧を取得する。「在庫一覧教えて」「ワックスの在庫ある？」「洗剤どれくらいある？」「在庫少ないものある？」等。',
  parameters:  z.object({
    search:   z.string().optional().describe('品目名の検索キーワード'),
    category: z.string().optional().describe('カテゴリで絞り込む'),
    status:   z.string().optional().describe('low_stock / out_of_stock / normal'),
  }),
  execute: async ({ search, category, status }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const q = new URLSearchParams()
      if (search)   q.set('search',   search)
      if (category) q.set('category', category)
      if (status)   q.set('status',   status)
      const res = await apiGet(`/api/inventory?${q}`, ctx)
      if (!res.ok) return '在庫一覧を取得できませんでした。'
      const data = await res.json()
      const items: any[] = data.items ?? []
      const kpi = data.kpi ?? {}
      if (items.length === 0) return '在庫品目はありません。'
      const lines = items.slice(0, 10).map((item: any) => {
        const st      = STOCK_STATUS_LABELS_SDK[item.stock_status] ?? item.stock_status
        const minNote = item.stock_quantity <= item.min_stock && item.min_stock > 0 ? '要補充' : ''
        return `${item.name}（${item.category}）在庫:${item.stock_quantity}${item.unit} 最低:${item.min_stock}${item.unit} [${st}]${minNote ? '⚠️' + minNote : ''} [id:${item.id}]`
      })
      const suffix  = items.length > 10 ? `（全${items.length}件中10件表示）` : `（全${items.length}件）`
      const kpiLine = `在庫少:${kpi.low_stock ?? 0}件・在庫切れ:${kpi.out_of_stock ?? 0}件`
      return [kpiLine, ...lines, suffix].join('\n')
    } catch { return '在庫一覧の取得中にエラーが発生しました。' }
  },
})

const getInventoryDetailTool = tool({
  name:        'get_inventory_detail',
  description: '在庫品目の詳細を取得する。「現在庫何個？」「最低在庫数は？」「詳しく」「単位は？」「仕入先は？」等。get_inventoryで取得したidを使う。',
  parameters:  z.object({
    inventory_id: z.string().describe('在庫品目ID（get_inventoryのid）'),
  }),
  execute: async ({ inventory_id }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const res = await apiGet(`/api/inventory/${inventory_id}`, ctx)
      if (!res.ok) return '在庫品目が見つかりませんでした。'
      const data = await res.json()
      const item = data.item
      if (!item) return '在庫品目が見つかりませんでした。'
      const status = STOCK_STATUS_LABELS_SDK[item.stock_status] ?? item.stock_status
      const parts  = [
        `品目: ${item.name}（${item.category}）`,
        `現在庫: ${item.stock_quantity}${item.unit}`,
        `最低在庫: ${item.min_stock}${item.unit}`,
        `ステータス: ${status}`,
      ]
      if (item.storage_location) parts.push(`保管場所: ${item.storage_location}`)
      if (item.supplier_name)    parts.push(`仕入先: ${item.supplier_name}`)
      if (item.unit_price != null) parts.push(`単価: ${Number(item.unit_price).toLocaleString()}円`)
      if (item.notes)            parts.push(`備考: ${item.notes}`)
      return parts.join('\n')
    } catch { return '在庫詳細の取得中にエラーが発生しました。' }
  },
})

const getInventoryHistoryTool = tool({
  name:        'get_inventory_history',
  description: '在庫品目の入出庫履歴を取得する。「この商品の履歴教えて」「最近の入出庫は？」「最後に出庫したのいつ？」等。',
  parameters:  z.object({
    inventory_id: z.string().describe('在庫品目ID（get_inventoryのid）'),
  }),
  execute: async ({ inventory_id }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const res = await apiGet(`/api/inventory/${inventory_id}/transactions?limit=10`, ctx)
      if (!res.ok) return '在庫履歴を取得できませんでした。'
      const data = await res.json()
      const txs: any[] = data.transactions ?? []
      if (txs.length === 0) return 'まだ入出庫履歴はありません。'
      const TYPE_LABELS: Record<string, string> = { in: '入庫', out: '出庫', adjustment: '調整', usage: '使用' }
      const lines = txs.map((tx: any) => {
        const typeLabel = TYPE_LABELS[tx.transaction_type] ?? tx.transaction_type
        const qty       = tx.quantity > 0 ? `+${tx.quantity}` : `${tx.quantity}`
        const who       = tx.performer?.name ?? '不明'
        const date      = tx.performed_at ? new Date(tx.performed_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
        const note      = tx.reason ? `（${tx.reason}）` : ''
        return `${date} ${typeLabel}${qty} ${who}${note}`
      })
      return `直近${txs.length}件の履歴:\n${lines.join('\n')}`
    } catch { return '在庫履歴の取得中にエラーが発生しました。' }
  },
})

const getReportsTool = tool({
  name:        'get_reports',
  description: '報告書・作業完了レポートの一覧を取得する。「報告書一覧教えて」「最近の報告書ある？」「ABC案件の報告書は？」「今月の報告書は？」等。',
  parameters:  z.object({
    project_id: z.string().optional().describe('案件IDで絞り込む'),
    date_from:  z.string().optional().describe('開始日 YYYY-MM-DD'),
    date_to:    z.string().optional().describe('終了日 YYYY-MM-DD'),
    page:       z.string().optional().describe('ページ番号'),
  }),
  execute: async ({ project_id, date_from, date_to, page }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const q = new URLSearchParams({ pageSize: '10' })
      if (page)      q.set('page',     page)
      if (date_from) q.set('dateFrom', date_from)
      if (date_to)   q.set('dateTo',   date_to)
      const res = await apiGet(`/api/reports?${q}`, ctx)
      if (!res.ok) return '報告書一覧を取得できませんでした。'
      const data = await res.json()
      let list: any[] = data.data ?? []
      if (project_id) list = list.filter((r: any) => r.project_id === project_id)
      if (list.length === 0) return '報告書はありません。'
      const lines = list.slice(0, 10).map((r: any) => {
        const projName  = r.projects?.name ?? '案件名不明'
        const workDate  = r.jobs?.work_date ?? '作業日不明'
        const score     = r.overall_score != null ? `スコア${r.overall_score}点` : 'スコアなし'
        const pdfLabel  = r.pdf_url ? 'PDF済' : 'PDF未生成'
        return `${workDate} ${projName} v${r.version} [${score}・${pdfLabel}] [id:${r.id}]`
      })
      const total  = data.count ?? list.length
      const suffix = total > 10 ? `（全${total}件中10件表示）` : `（全${total}件）`
      const stats  = data.stats
      const statLine = stats ? `月間${stats.thisMonthCount}件・平均スコア${stats.avgScore ?? '--'}点` : ''
      return [statLine, ...lines, suffix].filter(Boolean).join('\n')
    } catch { return '報告書一覧の取得中にエラーが発生しました。' }
  },
})

const getReportDetailTool = tool({
  name:        'get_report_detail',
  description: '報告書の詳細内容を取得する。「詳しく」「内容は？」「総合評価は？」「Before写真何枚？」「After写真ある？」「AI品質評価どう？」「スコア何点？」「PDF出てる？」等。get_reportsで取得したidを使う。',
  parameters:  z.object({
    report_id: z.string().describe('報告書ID（get_reportsのid）'),
  }),
  execute: async ({ report_id }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const res = await apiGet(`/api/reports/${report_id}`, ctx)
      if (!res.ok) return '報告書が見つかりませんでした。'
      const data    = await res.json()
      const rep     = data.data
      if (!rep) return '報告書が見つかりませんでした。'
      const content = rep.content ?? {}
      const summary = content.summary ?? {}
      const job     = content.job ?? {}
      const parts: string[] = [`報告書 v${rep.version}（id:${rep.id}）`]
      if (content.project?.name) parts.push(`案件: ${content.project.name}`)
      if (content.store?.name)   parts.push(`場所: ${content.store.name}`)
      if (content.client?.name)  parts.push(`顧客: ${content.client.name}`)
      if (job.work_date)         parts.push(`作業日: ${job.work_date}`)
      if (job.worker_name)       parts.push(`作業者: ${job.worker_name}`)
      if (summary.overall_score != null) parts.push(`総合スコア: ${summary.overall_score}点`)
      if (summary.total_spots   != null) parts.push(`撮影箇所: ${summary.total_spots}箇所（合格${summary.passed_count ?? 0}・要確認${summary.check_count ?? 0}・やり直し${summary.redo_count ?? 0}）`)
      if (summary.quality_assessment)    parts.push(`品質評価: ${summary.quality_assessment}`)
      if (summary.work_summary)          parts.push(`作業概要: ${summary.work_summary}`)
      if (summary.total_comment)         parts.push(`総括: ${summary.total_comment}`)
      const spots: any[] = content.spots ?? []
      if (spots.length > 0) {
        const spotsWithBefore = spots.filter((s: any) => s.before_url).length
        const spotsWithAfter  = spots.filter((s: any) => s.after_url).length
        parts.push(`Before写真: ${spotsWithBefore}箇所、After写真: ${spotsWithAfter}箇所`)
        const issueSpots = spots.filter((s: any) => s.recommendation === 'check' || s.recommendation === 'redo')
        if (issueSpots.length > 0) {
          parts.push(`要注意箇所: ${issueSpots.map((s: any) => `${s.name}（${s.recommendation}）`).join('・')}`)
        }
      }
      if ((summary.next_recommendations ?? []).length > 0) {
        parts.push(`次回推奨: ${summary.next_recommendations.join('、')}`)
      }
      parts.push(rep.pdf_url ? 'PDF生成済み' : 'PDF未生成')
      return parts.join('\n')
    } catch { return '報告書詳細の取得中にエラーが発生しました。' }
  },
})

const INVOICE_TYPE_LABELS_SDK: Record<string, string> = { quote: '見積書', invoice: '請求書' }
const INVOICE_STATUS_LABELS_SDK: Record<string, string> = {
  draft: '下書き', issued: '発行済み', accepted: '承認済み', rejected: '却下',
  sent: '送付済み', awaiting_payment: '入金待ち', overdue: '期限超過',
  paid: '入金済み', cancelled: 'キャンセル',
}

const getInvoicesTool = tool({
  name:        'get_invoices',
  description: '請求書・見積書の一覧を取得する。「見積書一覧」「請求書教えて」「未入金の請求は？」「ABC社の見積ある？」等。invoice_typeで絞り込み可。',
  parameters:  z.object({
    invoice_type: z.string().optional().describe('quote（見積書）またはinvoice（請求書）。省略時は両方'),
    status:       z.string().optional().describe('draft/issued/accepted/rejected/sent/awaiting_payment/overdue/paid/cancelled'),
    client_id:    z.string().optional().describe('顧客IDで絞り込む'),
    project_id:   z.string().optional().describe('案件IDで絞り込む'),
  }),
  execute: async ({ invoice_type, status, client_id, project_id }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const q = new URLSearchParams()
      if (invoice_type) q.set('invoice_type', invoice_type)
      if (status)       q.set('status',       status)
      if (client_id)    q.set('client_id',    client_id)
      if (project_id)   q.set('project_id',   project_id)
      const res = await apiGet(`/api/invoices?${q}`, ctx)
      if (!res.ok) return '請求書・見積書の一覧を取得できませんでした。'
      const data = await res.json()
      const list: any[] = data.invoices ?? []
      if (list.length === 0) {
        const typeLabel = invoice_type ? INVOICE_TYPE_LABELS_SDK[invoice_type] ?? invoice_type : '請求書・見積書'
        return `${typeLabel}はありません。`
      }
      const lines = list.slice(0, 10).map((inv: any) => {
        const type   = INVOICE_TYPE_LABELS_SDK[inv.invoice_type] ?? inv.invoice_type
        const stat   = INVOICE_STATUS_LABELS_SDK[inv.status] ?? inv.status
        const client = inv.clients?.name ?? '顧客不明'
        const amount = inv.total_amount != null ? `${Number(inv.total_amount).toLocaleString()}円` : '金額不明'
        return `${inv.invoice_number ?? inv.id} ${type}（${client}）${amount} [${stat}] [id:${inv.id}]`
      })
      const total = list.length > 10 ? `（全${list.length}件中10件表示）` : `（全${list.length}件）`
      return `${lines.join('\n')} ${total}`
    } catch { return '請求書・見積書一覧の取得中にエラーが発生しました。' }
  },
})

const getInvoiceDetailTool = tool({
  name:        'get_invoice_detail',
  description: '請求書または見積書の詳細を取得する。「1件目詳しく」「この見積いくら？」「支払期限いつ？」「明細は？」「入金状況は？」等。get_invoicesで取得したidを使う。',
  parameters:  z.object({
    invoice_id: z.string().describe('請求書/見積書のID（get_invoicesのid）'),
  }),
  execute: async ({ invoice_id }, runCtx) => {
    const ctx = runCtx!.context as ConsoleAgentSDKContext
    try {
      const res = await apiGet(`/api/invoices/${invoice_id}`, ctx)
      if (!res.ok) return '請求書・見積書が見つかりませんでした。'
      const data = await res.json()
      const inv = data.invoice
      if (!inv) return '請求書・見積書が見つかりませんでした。'
      const type   = INVOICE_TYPE_LABELS_SDK[inv.invoice_type] ?? inv.invoice_type
      const status = INVOICE_STATUS_LABELS_SDK[inv.status] ?? inv.status
      const parts: string[] = [
        `${type}番号: ${inv.invoice_number ?? inv.id}`,
        `顧客: ${inv.clients?.name ?? '不明'}`,
        `ステータス: ${status}`,
      ]
      if (inv.projects?.name) parts.push(`案件: ${inv.projects.name}`)
      if (inv.issue_date)     parts.push(`発行日: ${inv.issue_date}`)
      if (inv.due_date)       parts.push(`支払期限: ${inv.due_date}`)
      if (inv.subtotal   != null) parts.push(`小計: ${Number(inv.subtotal).toLocaleString()}円`)
      if (inv.tax_amount != null) parts.push(`消費税: ${Number(inv.tax_amount).toLocaleString()}円`)
      if (inv.total_amount != null) parts.push(`合計: ${Number(inv.total_amount).toLocaleString()}円`)
      if (inv.paid_amount  != null && inv.invoice_type === 'invoice') {
        parts.push(`入金済: ${Number(inv.paid_amount).toLocaleString()}円`)
        const remaining = (inv.total_amount ?? 0) - (inv.paid_amount ?? 0)
        if (remaining > 0) parts.push(`残額: ${remaining.toLocaleString()}円`)
      }
      const items: any[] = inv.invoice_items ?? []
      if (items.length > 0) {
        const itemLines = items.map((it: any) =>
          `  ・${it.description} ${it.quantity}${it.unit ?? ''}×${Number(it.unit_price).toLocaleString()}円＝${Number(it.amount).toLocaleString()}円`
        )
        parts.push(`明細:\n${itemLines.join('\n')}`)
      }
      return parts.join('\n')
    } catch { return '請求書・見積書詳細の取得中にエラーが発生しました。' }
  },
})

const proposeActionTool = tool({
  name:        'propose_action',
  description: 'L4 Write操作をユーザーに提案し確認を求める。実行はしない。propose_actionを呼んだ後、finalOutputに確認文を書くこと。',
  parameters:  z.object({
    action:              z.string().describe('console.update_project_status / console.create_project / console.update_project / console.add_assignment / console.remove_assignment / console.replace_assignment / console.approve_expense / console.approve_attendance / console.reject_attendance / console.reject_expense / console.create_employee / console.update_employee / console.update_employee_status / console.create_shift / console.update_shift / console.cancel_shift / console.create_estimate_from_project / console.create_invoice_from_project / console.update_invoice_status / console.convert_estimate / console.record_payment / console.create_partner / console.update_partner / console.update_partner_status / console.create_manual / console.update_manual'),
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

## 顧客操作手順
顧客一覧: get_clients（search指定可）→ clientId確認
顧客詳細: get_client_detail（clientIdが必要）
顧客の店舗: get_client_stores（clientIdが必要）
顧客の案件: get_client_projects（clientIdが必要）
顧客登録: name確認後 → propose_action(console.create_client, {name, phone?, email?, address?, contact_name?, notes?})
  確認文例: 「ABC株式会社、担当者田中様で登録します。よろしいですか？」
顧客編集: get_client_detailで現在値確認 → propose_action(console.update_client, {clientId, [変更フィールド]: 値})
  確認文例: 「電話番号を03-xxxx-xxxxに変更します。よろしいですか？」
顧客削除: 音声で実行不可。「管理画面から操作してください。」と答える。

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

## シフト操作手順
シフト一覧: get_shifts（date_from/date_to省略時は今日。employee_id/project_id/statusで絞り込み可）
シフト詳細: get_shift_detail（shiftIdが必要）
シフト×勤怠比較: get_shift_attendance_status（今日シフトがある人の打刻状況）
シフト登録: 案件・担当者・日時確認後 → propose_action(console.create_shift, {projectId, assignee_type, assignee_id, assignee_name, project_name, shift_date, start_time, end_time, notes?})
  start_time/end_timeはHH:MM形式。曖昧な時刻は必ず聞き直す。
  ※登録前に重複チェックを自動実施。重複があれば登録せず報告する。
シフト変更: propose_action(console.update_shift, {shiftId, [変更フィールド]})
  変更可能: shift_date/start_time/end_time/notes/assignee_type+assignee_id+assignee_name
シフト取消: propose_action(console.cancel_shift, {shiftId, assignee_name?, shift_date?})
シフト削除: 不可。取消（cancel）を案内する。
shiftIdは必ずget_shiftsのresultから取得する。AI生成ID禁止。

## 勤怠操作手順
今日の出勤状況: get_attendance_today（全従業員の今日の打刻状況）
従業員別勤怠記録: get_attendance_records（employeeIdが必要、year/month省略時は今月）
修正申請一覧: get_pending_attendance（承認待ちのみ → correctionId取得）
修正申請詳細: get_attendance_correction_detail（correctionIdが必要）
承認: 対象確認後 → propose_action(console.approve_attendance, {correctionId})
  確認文例: 「田中さんの8月22日の勤怠修正申請を承認します。よろしいですか？」
却下: 却下理由を先にユーザーから聞く → propose_action(console.reject_attendance, {correctionId, reject_reason})
  確認文例: 「田中さんの修正申請を『打刻ミスのため』で却下します。よろしいですか？」
勤怠直接編集: 不可。「修正申請フローを使ってください」と回答。
代理打刻: 不可。「本人打刻はHIKARUシステムから」と回答。
correctionIdは必ずget_pending_attendanceのresultから取得する。AI生成ID禁止。

## マニュアル操作手順
マニュアル一覧: get_manuals（search/type/category指定可）→ manualId確認
マニュアル詳細: get_manual_detail（manualIdが必要）
マニュアル検索: get_manuals(search=キーワード) — title/content全文検索
マニュアル種別: text=文章 / faq=FAQ / note=注意事項 ← 音声作成/編集可
  ※pdf/image/video はファイルアップロードが必要なため音声では作成・編集不可
マニュアル作成: title・type(text/faq/note)確認後 → propose_action(console.create_manual, {title, type, content?, category?})
  確認文例: 「『床洗浄 基本手順』というタイトルでFAQタイプのマニュアルを作成します。よろしいですか？」
  ※本文が長い場合、全文読み上げず概要のみ確認する。
マニュアル編集: get_manual_detailで現在値確認 → propose_action(console.update_manual, {manualId, [変更フィールド]})
  変更可能: title/content/category/type(text/faq/noteのみ)
  確認文例: 「タイトルを『○○手順 改訂版』に変更します。よろしいですか？」
マニュアル削除: 音声実行不可。「管理画面から操作してください。」と答える。
公開状態: マニュアルに公開/非公開フィールドなし。「公開状態の管理機能はありません。」と答える。
「床の汚れはどう落とす？」等の知識質問 → Manual AI（ConsoleでのVoice未対応）→「管理画面の質問機能を使ってください。」と答える。
「マニュアル管理開いて」→ navigate(console.open_manuals)
manualIdは必ずget_manualsまたはresolve_manualのresultから取得する。AI生成ID禁止。

## 協力業者操作手順
協力業者一覧: get_partners（search/status指定可）→ partnerId確認
協力業者詳細: get_partner_detail（partnerIdが必要）
担当案件確認: get_partner_detailのassignmentsに含まれる
協力業者登録: company_name確認後 → propose_action(console.create_partner, {company_name, contact_person_name?, phone?, email?, address?, notes?})
  確認文例: 「○○株式会社、担当者田中様で協力業者登録します。よろしいですか？」
  ※ログイン・パスワード設定は管理画面から。AIでパスワード生成禁止。
協力業者編集: get_partner_detailで現在値確認 → propose_action(console.update_partner, {partnerId, [変更フィールド]})
  変更可能: company_name/company_name_kana/contact_person_name/phone/email/address/notes
  確認文例: 「電話番号を03-xxxx-xxxxに変更します。よろしいですか？」
ステータス変更: get_partner_detailで現在status確認 → propose_action(console.update_partner_status, {partnerId, status})
  status: active=契約中 / suspended=一時停止 / terminated=契約終了 ※deletedは禁止
  同じstatusへの変更はWriteしない。
  確認文例: 「○○株式会社を一時停止に変更します。よろしいですか？」
協力業者削除: 音声実行不可。「管理画面から操作してください。」と答える。
partnerIdは必ずget_partnersまたはresolve_partnerのresultから取得する。AI生成ID禁止。
同名業者が複数: 「どちらの業者ですか？」と確認してから操作する。

## 従業員操作手順
従業員一覧: get_employees（search/status指定可）→ employeeId確認
従業員詳細: get_employee_detail（employeeIdが必要）
担当案件: get_employee_projects（employeeIdが必要）
勤怠概要: get_employee_attendance_summary（employeeIdが必要）
シフト: get_employee_shifts（employeeIdが必要）
品質評価: get_employee_quality_summary（employeeIdが必要、データなし時は正直に回答）
従業員登録: name確認後 → propose_action(console.create_employee, {name, phone?, email?, name_kana?, hire_date?, department?, position?, notes?})
  確認文例: 「田中太郎さんを従業員登録します。よろしいですか？」
  ※パスワード・ログイン設定は管理画面から。AIでパスワード生成禁止。
従業員編集: get_employee_detailで現在値確認 → propose_action(console.update_employee, {employeeId, [変更フィールド]})
  変更可能: name/phone/email/name_kana/hire_date/department/position/notes
ステータス変更: propose_action(console.update_employee_status, {employeeId, status})
  status: active/on_leave/resigned/suspended ※deletedは禁止
従業員削除: 音声実行不可。「管理画面から操作してください。」と答える。
権限変更: 音声実行不可。「権限変更は管理画面から操作してください。」と答える。
employeeIdは必ずget_employeesの結果から取得する。AI生成ID禁止。

## 設定操作手順
設定確認: get_settings（会社名/住所/電話/メール/郵便番号/印鑑有無）
  ※銀行口座番号・インボイス番号・法人番号は「登録済み」確認のみ。生値は読み上げない。
会社情報変更（Class B）: get_settingsで現在値確認 → propose_action(console.update_company_setting, {field, value, current_value?})
  変更可能: name/address/phone/email/postal_code のみ
  ※会社名は必須フィールドのため空にできない
  確認文例: 「会社の電話番号を03-1234-5678に変更します。現在の番号はXXXXです。よろしいですか？」
財務情報変更（Class C）: Voice禁止。「管理画面から操作してください。」
  対象: bank_account_number/bank_account_holder/invoice_registration_number/corporate_number 等
電子印（seal）: Voice変更禁止（ファイルアップロード不可）
通知設定: 現在設定APIなし。「通知設定は管理画面から操作してください。」
AI設定: 現在設定APIなし。「AI設定は管理画面から操作してください。」
権限・ユーザー管理: Voice禁止。「管理画面から操作してください。」
APIキー・Secret: Voice読み上げ・変更禁止。「セキュリティ上、認証情報は音声では操作できません。」

## AI分析操作手順
総合AI分析: get_analytics（focus=overview/store/worker/distribution/trends/spots）
  ・全期間集計データ（期間フィルタなし）
  ・スコア: AI評価 0-100点。顧客評価とは別系統。
  ・「AI分析して」「ランキングは？」「全体的にどう？」→ get_analytics
  ・「品質スコア分布は？」→ get_analytics(focus=distribution)
  ・「店舗別ランキングは？」→ get_analytics(focus=store)
  ・「月次推移は？」→ get_analytics(focus=trends)
品質KPI（満足度含む）: get_quality_summary（期間指定可）
作業者品質詳細: get_workers_quality / get_employee_quality_summary
案件品質トレンド: get_project_quality
売上: get_revenue_summary（AIが売上を推測しない）
数値の根拠: 全数値は実APIデータ。LLMが計算・推測した数値を事実として述べない。
WHY回答: 観察事実→関連指標→可能性の順。因果断定禁止。
予測: 正式予測モデルなし。「来月の予測は現在実装されていません。」と回答。
AI分析画面を開く: navigate(console.open_analytics)

## 通知操作手順
通知一覧: get_notifications（unread_only=trueで未読のみ）
  ※このToolはREADのみ。呼ぶだけで既読にならない。「読んで」はREAD、「既読にして」はWRITE。
通知種別: attendance_correction_submitted=勤怠修正申請・expense_submitted=経費申請・
          project_report_submitted=報告書提出・project_proposal_submitted=提案提出
通知既読化: get_notificationsで対象idを確認 → propose_action(console.mark_notification_read, {notificationId, title?})
  確認文例: 「経費申請の通知『田中さんの交通費申請』を既読にします。よろしいですか？」
  ※すでに既読の場合は変更不要と回答。
一括既読: 現在APIなし。「通知管理画面から一括既読操作を行ってください。」と回答。
通知送信: 現在APIなし。LINE通知は自動送信される。「手動通知送信は現在Voice非対応です。」と回答。
通知削除: Voice実行不可。「通知管理画面から操作してください。」と回答。
notificationIdは必ずget_notificationsのresultから取得する。AI生成ID禁止。

## 品質・満足度操作手順
品質KPI全体: get_quality_summary（period=7d/30d/90d/ytd、省略時30d）
  ・スコア仕様: AI評価=0-100点、顧客評価=1-5星（×20で0-100換算）、HQS=両方の加重平均
  ・低評価: 顧客評価★1-2が低評価アラート対象
顧客満足度・アンケート: get_surveys（project_id/rating/date_from/date_to指定可）
  ・「クレームある？」→ rating=1 または rating=2 で絞り込む
  ・アンケートはcustomer portalから顧客が回答するもの。管理者は読み取り専用。
作業者別品質: get_workers_quality（days=30など）
  ・「田中さんの品質は？」→ get_employee_quality_summary（employeeIdが必要）
  ・「作業者全体のランキングは？」→ get_workers_quality
案件別品質: get_project_quality（project_idが必要、days=90など）
  ・「ABC案件の品質どう？」→ get_projects でprojectId確認→ get_project_quality
AI評価詳細: Report内のAI評価は get_report_detail（spots.score/recommendation）
写真のBefore/After比較: get_report_detailのspots内に含まれる
品質WRITE: 現在なし。品質評価・アンケートは管理者書き込み不可。
  ・「評価を変更して」→ 「品質評価の変更は管理画面から操作できません。」と回答。
品質スコアを推測しない。取得できない場合は「確認できません」と回答。

## 契約操作手順
契約一覧: get_contracts（search/status/contract_type/counterparty/expiring_days指定可）
  ・「もうすぐ期限切れ」→ expiring_days=30
  ・「期限切れ」→ status=expired
  ・顧客との契約 → counterparty=client
契約詳細: get_contract_detail（contract_idが必要）
顧客別: get_contracts後にclientIdが分かればclient_idで絞り込む。または先にresolve_clientでclientIdを確定。
期限確認: get_contract_detailのdeadline.daysUntilExpiry / urgencyが実データ
新規契約: resolve_clientまたはresolve_partnerでIDを確定 → propose_action(console.create_contract, {...})
  必須: title, counterparty_type(client|partner), client_id または partner_id
  任意: project_id, contract_type, start_date, end_date, renewal_date, auto_renewal, notes
  ※金額フィールドなし（契約条件は文書で管理）
  確認文例: 「ABC社との『清掃サービス契約』を登録します。開始日○月○日。よろしいですか？」
契約編集: get_contract_detailで現在値確認 → propose_action(console.update_contract, {contractId, [変更フィールド]})
  変更可: title/contract_number/contract_type/start_date/end_date/renewal_date/auto_renewal/notes/status
  ※status変更はこのactionで対応（同一PUT endpoint）
  確認文例: 「この契約の終了日を12月31日に変更します。よろしいですか？」
status変更候補: draft/active/signed/reviewing/expired/terminated
  ※terminated（解約）はVoiceでも可だが確認文に「この操作は取り消せません」を含める
契約終了・解約: propose_action(console.update_contract, {contractId, status: 'terminated'})
  ※status→terminatedは論理削除相当。確認必須。
削除（物理）: 音声実行不可。「契約の削除は管理画面から操作してください。」と答える。
contractIdは必ずget_contractsのresultから取得する。AI生成ID禁止。

## 在庫操作手順
在庫一覧: get_inventory（search/category/status指定可。status=low_stockで在庫少一覧）
在庫詳細: get_inventory_detail（inventory_idが必要）
在庫履歴: get_inventory_history（inventory_idが必要。直近10件）
入庫: get_inventory_detailで現在庫確認 → propose_action(console.inventory_stock_in, {inventoryId, quantity, item_name?, reason?})
  確認文例: 「ワックスを10個入庫します。現在20個なので入庫後は30個になる予定です。よろしいですか？」
  ※quantityは正の整数。AI補完禁止。
出庫: get_inventory_detailで現在庫確認 → 在庫不足チェック → propose_action(console.inventory_stock_out, {inventoryId, quantity, item_name?, reason?})
  確認文例: 「ワックスを5個出庫します。現在20個なので出庫後は15個になる予定です。よろしいですか？」
  ※quantity > current_stockの場合は提案しない。「現在X個しかないためY個は出庫できません」と回答。
在庫調整（棚卸し）: get_inventory_detailで現在庫確認 → propose_action(console.adjust_inventory, {inventoryId, target_quantity, reason, item_name?})
  ※target_quantityは調整後の目標数（絶対値）。差分はサーバー側で計算。reason必須。
  確認文例: 「棚卸し結果10個に合わせます。現在12個なので2個減少します。よろしいですか？」
在庫品目登録: name確認後 → propose_action(console.create_inventory_item, {name, category?, unit?, min_stock?, storage_location?, notes?})
  確認文例: 「ワックス（清掃用品）を新規登録します。よろしいですか？」
  ※初期在庫は0。登録後は入庫で追加。
在庫品目編集: get_inventory_detailで現在値確認 → propose_action(console.update_inventory_item, {inventoryId, [変更フィールド]})
  変更可能: name/category/unit/min_stock/storage_location/supplier_name/notes
  ※在庫数量はここでは変更不可。入庫/出庫/調整を使う。
在庫削除: 音声実行不可。「管理画面から操作してください。」と答える。
inventoryIdは必ずget_inventoryのresultから取得する。AI生成ID禁止。

## 報告書操作手順
報告書一覧: get_reports（project_id/date_from/date_to/page指定可）
報告書詳細: get_report_detail（report_idが必要 — get_reportsのidを使う）
Before/After写真: get_report_detailの返答内にspotsのbefore/after枚数が含まれる。写真URLは音声で読み上げない。写真確認はナビゲーションで報告書画面を開く。
AI品質評価: get_report_detailの返答内のsummary.overall_score、quality_assessment、各spotのscoreが含まれる。
PDF生成: get_report_detailでPDF状態確認 → propose_action(console.generate_report_pdf, {reportId, report_number?})
  確認文例: 「この報告書のPDFを生成します。よろしいですか？」
  ※PDFは既存テンプレートで生成する。AIが独自フォーマットを作らない。
報告書生成・再生成: Console管理者はVoiceから報告書を生成できません。「報告書の生成は作業者がWorkerアプリから行います。」と回答。
報告書削除: 音声実行不可。「報告書の削除は管理画面から操作してください。」と回答。
reportIdは必ずget_reportsのresultから取得する。AI生成ID禁止。

## 見積書（quote）操作手順
見積書一覧: get_invoices(invoice_type='quote', status?, client_id?)
見積書詳細: get_invoice_detail(invoice_id)
見積書作成: get_projects で案件確認 → propose_action(console.create_estimate_from_project, {projectId, project_name?})
  ※金額はサーバーが案件の料金情報から計算する。AIが金額を計算・入力禁止。
  ※料金情報未登録の案件は作成不可。APIがエラーを返す。
  確認文例: 「ABC株式会社の『銀座店 床清掃』案件の見積書を作成します。よろしいですか？」
見積書ステータス変更: get_invoice_detail で現在ステータス確認 → propose_action(console.update_invoice_status, {invoiceId, status})
  quote の有効遷移: draft→issued/cancelled、issued→accepted/rejected/cancelled、accepted→cancelled、rejected→draft/cancelled
  確認文例: 「見積書QT-2026-001を発行済みに変更します。よろしいですか？」
見積書→請求書変換: get_invoice_detail で見積書確認（issued/acceptedのみ変換可）→ propose_action(console.convert_estimate, {invoiceId, invoice_number?})
  ※金額は見積書のSnapshotを引き継ぐ。AIが金額を変更禁止。
  確認文例: 「見積書QT-2026-001を請求書に変換します。よろしいですか？」
見積書削除: 不可。「管理画面から操作してください。」と答える。

## 請求書（invoice）操作手順
請求書一覧: get_invoices(invoice_type='invoice', status?, client_id?)
請求書詳細: get_invoice_detail(invoice_id)
請求書作成（スポット案件）: get_projects で案件確認 → propose_action(console.create_invoice_from_project, {projectId, project_name?})
  ※完了済み作業がある案件のみ作成可能。スポット案件専用API。
  ※金額はサーバーが計算（見積書Snapshotまたはproject_pricesから）。AIが金額を計算・入力禁止。
  確認文例: 「ABC株式会社の『銀座店 床清掃』案件の請求書を作成します。よろしいですか？」
請求書ステータス変更: get_invoice_detail で現在ステータス確認 → propose_action(console.update_invoice_status, {invoiceId, status, cancel_reason?})
  invoice の有効遷移: draft→issued/cancelled、issued→sent/awaiting_payment/cancelled、sent→awaiting_payment/cancelled、awaiting_payment→paid/overdue/cancelled、overdue→paid/cancelled
  確認文例: 「請求書INV-2026-001を発行済みに変更します。よろしいですか？」
入金記録: get_invoice_detail で残額確認 → propose_action(console.record_payment, {invoiceId, amount, paid_at, payment_method?, notes?})
  ※paid_atはYYYY-MM-DD形式。amountは数値文字列。
  ※AIが金額を推測禁止。ユーザーが「全額」と言った場合は残額をget_invoice_detailで確認してから提案する。
  確認文例: 「請求書INV-2026-001に50,000円の入金を記録します。よろしいですか？」
請求書削除: 不可。キャンセル操作を案内する。

## propose_actionのactionとparamsの対応
- console.update_project_status    → params: { projectId, status }
- console.create_project           → params: { name, project_type, start_date?, end_date?, location_name?, client_id?, store_id?, notes? }
- console.update_project           → params: { projectId, [変更フィールド]: 値 }
- console.add_assignment           → params: { projectId, assignee_type, assignee_id, assignee_name }
- console.remove_assignment        → params: { projectId, assignee_type, assignee_id, assignee_name }
- console.replace_assignment       → params: { projectId, from_type, from_id, from_name, to_type, to_id, to_name }
- console.create_client            → params: { name, code?, phone?, email?, address?, contact_name?, notes? }
- console.update_client            → params: { clientId, [変更フィールド]: 値 } ※変更可: name/code/phone/email/address/contact_name/notes/is_active
- console.approve_expense          → params: { expenseId }
- console.reject_expense           → params: { expenseId, reject_reason }
- console.approve_attendance       → params: { correctionId }
- console.reject_attendance        → params: { correctionId, reject_reason }
- console.create_shift             → params: { projectId, assignee_type, assignee_id, assignee_name, project_name?, shift_date, start_time, end_time, notes? }
- console.update_shift             → params: { shiftId, shift_date?, start_time?, end_time?, notes?, assignee_type?, assignee_id?, assignee_name? }
- console.cancel_shift             → params: { shiftId, assignee_name?, shift_date? }
- console.create_employee          → params: { name, phone?, email?, name_kana?, hire_date?, department?, position?, notes? }
- console.update_employee          → params: { employeeId, [変更フィールド]: 値 } ※変更可: name/phone/email/name_kana/hire_date/department/position/notes
- console.update_employee_status   → params: { employeeId, status: active/on_leave/resigned/suspended }
- console.create_estimate_from_project → params: { projectId, project_name? }
- console.create_invoice_from_project  → params: { projectId, project_name? }
- console.update_invoice_status        → params: { invoiceId, status, cancel_reason? }
- console.convert_estimate             → params: { invoiceId, invoice_number? }
- console.record_payment               → params: { invoiceId, amount, paid_at, payment_method?, notes?, invoice_number? }
- console.generate_report_pdf          → params: { reportId, report_number? }
- console.update_company_setting        → params: { field, value, current_value? } ※field: name/address/phone/email/postal_code のみ
- console.mark_notification_read       → params: { notificationId, title? }
- console.create_contract              → params: { title, counterparty_type, client_id?, partner_id?, project_id?, contract_type?, start_date?, end_date?, renewal_date?, auto_renewal?, notes?, client_name? }
- console.update_contract              → params: { contractId, title?, contract_number?, contract_type?, start_date?, end_date?, renewal_date?, auto_renewal?, status?, notes?, contract_title? }
- console.inventory_stock_in           → params: { inventoryId, quantity, item_name?, reason? }
- console.inventory_stock_out          → params: { inventoryId, quantity, item_name?, reason? }
- console.adjust_inventory             → params: { inventoryId, target_quantity, reason, item_name?, current_quantity? }
- console.create_inventory_item        → params: { name, category?, unit?, min_stock?, storage_location?, notes? }
- console.update_inventory_item        → params: { inventoryId, name?, category?, unit?, min_stock?, storage_location?, supplier_name?, notes? }
- console.create_partner               → params: { company_name, contact_person_name?, phone?, email?, address?, notes? }
- console.update_partner               → params: { partnerId, [変更フィールド]: 値 } ※変更可: company_name/company_name_kana/contact_person_name/phone/email/address/notes
- console.update_partner_status        → params: { partnerId, status: active/suspended/terminated }
- console.create_manual               → params: { title, type: text/faq/note, content?, category? }
- console.update_manual               → params: { manualId, title?, content?, category?, type? } ※type変更はtext/faq/noteのみ

## L5禁止操作（音声実行不可）
削除・権限変更・全件承認・大量操作は実行不可。
「全部承認して」等はエラーとして説明すること。
案件削除は音声禁止。「管理画面から操作してください。」と答える。
従業員削除・権限変更は音声禁止。「管理画面から操作してください。」と答える。`

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
    getClientsTool,
    getClientDetailTool,
    getClientStoresTool,
    getClientProjectsTool,
    getManualsTool,
    getManualDetailTool,
    resolveManualTool,
    getPartnersTool,
    getPartnerDetailTool,
    resolvePartnerTool,
    getNotificationsTool,
    getPendingExpensesTool,
    getExpenseDetailTool,
    getPendingAttendanceTool,
    getAttendanceCorrectionDetailTool,
    getAttendanceTodayTool,
    getAttendanceRecordsTool,
    getPendingRequestsTool,
    getRevenueTool,
    getQualitySummaryTool,
    getEmployeesTool,
    getEmployeeDetailTool,
    getEmployeeProjectsTool,
    getEmployeeAttendanceTool,
    getEmployeeShiftsTool,
    getEmployeeQualityTool,
    getShiftsTool,
    getShiftDetailTool,
    getShiftAttendanceStatusTool,
    getSettingsTool,
    getAnalyticsTool,
    getSurveysTool,
    getWorkersQualityTool,
    getProjectQualityTool,
    getContractsTool,
    getContractDetailTool,
    getInventoryTool,
    getInventoryDetailTool,
    getInventoryHistoryTool,
    getReportsTool,
    getReportDetailTool,
    getInvoicesTool,
    getInvoiceDetailTool,
    proposeActionTool,
    navigateTool,
  ],
})
