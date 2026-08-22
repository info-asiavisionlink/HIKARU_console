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
    action:              z.string().describe('console.update_project_status / console.create_project / console.update_project / console.add_assignment / console.remove_assignment / console.replace_assignment / console.approve_expense / console.approve_attendance / console.reject_attendance / console.reject_expense / console.create_employee / console.update_employee / console.update_employee_status / console.create_shift / console.update_shift / console.cancel_shift / console.create_estimate_from_project / console.create_invoice_from_project / console.update_invoice_status / console.convert_estimate / console.record_payment'),
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
    getInvoicesTool,
    getInvoiceDetailTool,
    proposeActionTool,
    navigateTool,
  ],
})
