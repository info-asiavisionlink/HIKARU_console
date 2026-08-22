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
  description: '勤怠修正申請の承認待ち一覧を確認する。「勤怠修正来てる？」「修正申請何件？」「未処理の勤怠申請ある？」等に使う。',
  safetyLevel: 1,
  parameters:  { type: 'object', properties: {}, required: [] },
  async execute(_, ctx): Promise<ToolResult> {
    try {
      const res   = await apiFetch('/api/attendance/corrections?status=submitted', ctx)
      if (!res.ok) return { success: false, text: '勤怠修正申請を確認できませんでした。' }
      const data  = await res.json()
      const items = Array.isArray(data?.corrections) ? data.corrections : []
      if (items.length === 0) return { success: true, text: '承認待ちの勤怠修正申請はありません。', items: [] }
      const list = items.slice(0, 5).map((e: any, i: number) => ({
        id:    e.id,
        label: `${i + 1}件目: ${e.worker?.name ?? '従業員'}、${e.attendance_record?.work_date ?? '不明'}`,
      }))
      return { success: true, text: `承認待ちの勤怠修正申請が${items.length}件あります。`, items: list }
    } catch {
      return { success: false, text: '勤怠修正申請の取得中にエラーが発生しました。' }
    }
  },
}

const getAttendanceCorrectionDetail: ConsoleAgentTool = {
  name:        'get_attendance_correction_detail',
  description: '指定した勤怠修正申請の詳細（現在値・申請値・理由）を取得する。「1件目詳しく」「この修正何を変えたいの？」「理由は？」等に使う。',
  safetyLevel: 1,
  parameters:  {
    type: 'object',
    properties: { correction_id: { type: 'string', description: '修正申請のID' } },
    required:   ['correction_id'],
  },
  async execute(params, ctx): Promise<ToolResult> {
    const corrId = params.correction_id
    if (!corrId) return { success: false, text: '修正申請IDが必要です。' }
    try {
      const res  = await apiFetch(`/api/attendance/corrections/${corrId}`, ctx)
      if (!res.ok) return { success: false, text: '修正申請情報を取得できませんでした。' }
      const data = await res.json()
      const c    = data?.correction
      if (!c) return { success: false, text: '修正申請が見つかりませんでした。' }
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
      return { success: true, text: `${parts.join('、')} [id:${corrId}]`, items: [{ id: corrId, label: `ID: ${corrId}` }] }
    } catch {
      return { success: false, text: '修正申請詳細の取得中にエラーが発生しました。' }
    }
  },
}

const getAttendanceToday: ConsoleAgentTool = {
  name:        'get_attendance_today',
  description: '今日の出勤状況を確認する。「今日誰来てる？」「今日の勤怠状況教えて」「今出勤中の人いる？」「まだ働いてる人いる？」「退勤してない人いる？」等に使う。',
  safetyLevel: 1,
  parameters:  { type: 'object', properties: {}, required: [] },
  async execute(_, ctx): Promise<ToolResult> {
    try {
      const todayJst = getJstDateString()
      const y = todayJst.slice(0, 4)
      const m = String(parseInt(todayJst.slice(5, 7), 10))
      const res = await apiFetch(`/api/attendance?year=${y}&month=${m}`, ctx)
      if (!res.ok) return { success: false, text: '勤怠情報を取得できませんでした。' }
      const data    = await res.json()
      const records: any[] = (data.data ?? []).filter((r: any) => r.work_date === todayJst)
      if (records.length === 0) return { success: true, text: `今日（${todayJst}）の打刻記録はまだありません。`, items: [] }
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
      return { success: true, text: parts.join('。') }
    } catch {
      return { success: false, text: '今日の勤怠情報の取得中にエラーが発生しました。' }
    }
  },
}

const getAttendanceRecords: ConsoleAgentTool = {
  name:        'get_attendance_records',
  description: '指定した従業員の勤怠記録詳細を取得する。「田中さん今日の勤怠教えて」「この人昨日何時に来た？」「今月の出勤記録見せて」「何時に退勤した？」等に使う。',
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
      if (!e.auth_user_id) return { success: true, text: `${e.name}さんはシステムアカウントがないため勤怠記録を確認できません。` }
      const y = params.year  ?? String(getJstYear())
      const m = params.month ?? String(getJstMonth())
      const attRes = await apiFetch(`/api/attendance?worker_id=${e.auth_user_id}&year=${y}&month=${m}`, ctx)
      if (!attRes.ok) return { success: false, text: '勤怠記録を取得できませんでした。' }
      const attData = await attRes.json()
      const records: any[] = attData.data ?? []
      if (records.length === 0) return { success: true, text: `${e.name}さんの${m}月の勤怠記録はありません。`, items: [] }
      const summary: any = (attData.summary ?? []).find((s: any) => s.worker_id === e.auth_user_id)
      const fmtTime = (ts: string | null) => ts
        ? new Date(ts).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' })
        : '--:--'
      const recent = records.slice(-5).reverse().map((r: any) =>
        `${r.work_date} ${fmtTime(r.clock_in)}〜${fmtTime(r.clock_out)}`
      )
      const hours = summary ? Math.round(summary.totalWorkMins / 60 * 10) / 10 : 0
      const items = recent.map((label, i) => ({ id: String(i), label }))
      return {
        success: true,
        text:    `${e.name}さんの${m}月: 出勤${summary?.workDays ?? records.length}日、総勤務${hours}時間。直近記録: ${recent.join(' / ')}`,
        items,
      }
    } catch {
      return { success: false, text: '勤怠記録の取得中にエラーが発生しました。' }
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

// ─── Shift Tools ─────────────────────────────────────────────

const getShifts: ConsoleAgentTool = {
  name:        'get_shifts',
  description: 'シフト一覧を取得する。「今日誰入ってる？」「明日のシフトは？」「今週のシフト教えて」「ABC案件のシフトは？」「田中さん今週いつ入ってる？」等。',
  safetyLevel: 1,
  parameters:  {
    type: 'object',
    properties: {
      date_from:   { type: 'string', description: '開始日（YYYY-MM-DD）省略時は今日' },
      date_to:     { type: 'string', description: '終了日（YYYY-MM-DD）省略時はdate_fromと同じ日' },
      employee_id: { type: 'string', description: '従業員IDで絞り込み' },
      project_id:  { type: 'string', description: '案件IDで絞り込み' },
      status:      { type: 'string', description: 'scheduled/confirmed/cancelled等' },
    },
    required: [],
  },
  async execute(params, ctx): Promise<ToolResult> {
    try {
      const todayJst = getJstDateString()
      const from = params.date_from ?? todayJst
      const to   = params.date_to   ?? from
      const q = new URLSearchParams({ date_from: from, date_to: to })
      if (params.employee_id) q.set('employee_id', params.employee_id)
      if (params.project_id)  q.set('project_id', params.project_id)
      if (params.status)      q.set('status', params.status)
      const res    = await apiFetch(`/api/shifts?${q}`, ctx)
      if (!res.ok) return { success: false, text: 'シフト情報を取得できませんでした。' }
      const data   = await res.json()
      const shifts: any[] = data.shifts ?? []
      if (shifts.length === 0) return { success: true, text: `${from === to ? from : `${from}〜${to}`}のシフトはありません。`, items: [] }
      const ST: Record<string, string> = { scheduled: '予定', confirmed: '確定', completed: '完了', cancelled: 'キャンセル', in_progress: '作業中' }
      const items = shifts.slice(0, 8).map((s: any, i: number) => {
        const name = s.assignee_type === 'employee'
          ? (s.employees?.name ?? '従業員')
          : (s.partners?.company_name ?? s.partners?.contact_person_name ?? '協力業者')
        const proj = s.projects?.name ?? '案件不明'
        const st = s.start_time?.slice(0, 5) ?? '', et = s.end_time?.slice(0, 5) ?? ''
        const stat = ST[s.status] ?? s.status ?? ''
        return { id: s.id, label: `${i + 1}件目: ${s.shift_date} ${st}〜${et} ${name}（${proj}）${stat !== '予定' ? `[${stat}]` : ''}` }
      })
      return { success: true, text: `${shifts.length}件のシフト。`, items }
    } catch {
      return { success: false, text: 'シフト一覧の取得中にエラーが発生しました。' }
    }
  },
}

const getShiftDetail: ConsoleAgentTool = {
  name:        'get_shift_detail',
  description: '指定したシフトの詳細情報を取得する。「1件目詳しく」「このシフト何時から？」「担当誰？」「どの案件？」等。',
  safetyLevel: 1,
  parameters:  {
    type: 'object',
    properties: { shift_id: { type: 'string', description: 'シフトのID' } },
    required:   ['shift_id'],
  },
  async execute(params, ctx): Promise<ToolResult> {
    if (!params.shift_id) return { success: false, text: 'シフトIDが必要です。' }
    try {
      const res  = await apiFetch(`/api/shifts/${params.shift_id}`, ctx)
      if (!res.ok) return { success: false, text: 'シフト情報を取得できませんでした。' }
      const data = await res.json()
      const s    = data?.shift
      if (!s) return { success: false, text: 'シフトが見つかりませんでした。' }
      const name = s.assignee_type === 'employee'
        ? (s.employees?.name ?? '従業員')
        : (s.partners?.company_name ?? s.partners?.contact_person_name ?? '協力業者')
      const ST: Record<string, string> = { scheduled: '予定', confirmed: '確定', completed: '完了', cancelled: 'キャンセル', in_progress: '作業中' }
      const parts = [
        `${s.shift_date} ${s.start_time?.slice(0, 5)}〜${s.end_time?.slice(0, 5)}`,
        `担当: ${name}`, `案件: ${s.projects?.name ?? '不明'}`,
        `ステータス: ${ST[s.status] ?? s.status}`,
      ]
      if (s.notes) parts.push(`備考: ${s.notes}`)
      return { success: true, text: `${parts.join('、')} [id:${params.shift_id}]`, items: [{ id: params.shift_id, label: params.shift_id }] }
    } catch {
      return { success: false, text: 'シフト詳細の取得中にエラーが発生しました。' }
    }
  },
}

const getShiftAttendanceStatus: ConsoleAgentTool = {
  name:        'get_shift_attendance_status',
  description: '今日シフトがある従業員の打刻状況を確認する。「今日シフトあるのに来てない人いる？」「シフトより遅れてる人いる？」「まだ退勤してない人いる？」等に使う。',
  safetyLevel: 1,
  parameters:  { type: 'object', properties: {}, required: [] },
  async execute(_, ctx): Promise<ToolResult> {
    try {
      const todayJst = getJstDateString()
      const y = String(getJstYear()), m = String(getJstMonth())
      const [shiftsRes, empRes, attRes] = await Promise.all([
        apiFetch(`/api/shifts?date_from=${todayJst}&date_to=${todayJst}`, ctx),
        apiFetch('/api/employees?pageSize=200', ctx),
        apiFetch(`/api/attendance?year=${y}&month=${m}`, ctx),
      ])
      const shiftsData = await shiftsRes.json()
      const empData    = empRes.ok   ? await empRes.json()  : { data: [] }
      const attData    = attRes.ok   ? await attRes.json()  : { data: [] }
      const shifts: any[] = (shiftsData.shifts ?? []).filter((s: any) => s.assignee_type === 'employee')
      if (shifts.length === 0) return { success: true, text: `今日（${todayJst}）は従業員のシフトが登録されていません。` }
      const empMap = new Map<string, string>()
      for (const e of (empData.data ?? [])) if (e.auth_user_id) empMap.set(e.id, e.auth_user_id)
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
      return { success: true, text: parts.length > 0 ? `今日（${todayJst}）のシフト対比: ${parts.join('。')}` : `今日のシフトメンバー全員が打刻済みです。` }
    } catch {
      return { success: false, text: 'シフト×勤怠比較の取得中にエラーが発生しました。' }
    }
  },
}

// ─── Report READ Tools ───────────────────────────────────────

const getReports: ConsoleAgentTool = {
  name:        'get_reports',
  description: '報告書・作業完了レポートの一覧を取得する。「報告書一覧教えて」「最近の報告書ある？」「ABC案件の報告書は？」「今月の報告書は？」等。',
  safetyLevel: 1,
  parameters: {
    type:       'object',
    properties: {
      project_id: { type: 'string', description: '案件IDで絞り込む（get_projectsで取得）' },
      date_from:  { type: 'string', description: '開始日 YYYY-MM-DD' },
      date_to:    { type: 'string', description: '終了日 YYYY-MM-DD' },
      page:       { type: 'string', description: 'ページ番号（省略時1）' },
    },
    required: [],
  },
  async execute(params, ctx): Promise<ToolResult> {
    try {
      const q = new URLSearchParams({ pageSize: '10' })
      if (params.page)      q.set('page',     params.page)
      if (params.date_from) q.set('dateFrom', params.date_from)
      if (params.date_to)   q.set('dateTo',   params.date_to)
      const res = await apiFetch(`/api/reports?${q}`, ctx)
      if (!res.ok) return { success: false, text: '報告書一覧を取得できませんでした。' }
      const data = await res.json()
      let list: any[] = data.data ?? []

      if (params.project_id) {
        list = list.filter((r: any) => r.project_id === params.project_id)
      }

      if (list.length === 0) return { success: true, text: '報告書はありません。', data }

      const lines = list.slice(0, 10).map((r: any) => {
        const projName  = r.projects?.name ?? '案件名不明'
        const workDate  = r.jobs?.work_date ?? '作業日不明'
        const score     = r.overall_score != null ? `スコア${r.overall_score}点` : 'スコアなし'
        const pdfLabel  = r.pdf_url ? 'PDF済' : 'PDF未生成'
        const emailLabel = r.email_status === 'sent' ? 'メール送信済' : ''
        const labels    = [score, pdfLabel, emailLabel].filter(Boolean).join('・')
        return `${workDate} ${projName} v${r.version} [${labels}] [id:${r.id}]`
      })
      const total = (data.count ?? list.length)
      const suffix = total > 10 ? `（全${total}件中10件表示）` : `（全${total}件）`
      const stats  = data.stats
      const statLine = stats
        ? `月間${stats.thisMonthCount}件・平均スコア${stats.avgScore ?? '--'}点`
        : ''
      return {
        success: true,
        text:    [statLine, ...lines, suffix].filter(Boolean).join('\n'),
        data,
        items:   list.slice(0, 10).map((r: any) => ({ id: r.id, label: `${r.jobs?.work_date ?? ''} ${r.projects?.name ?? ''}` })),
      }
    } catch {
      return { success: false, text: '報告書一覧の取得中にエラーが発生しました。' }
    }
  },
}

const getReportDetail: ConsoleAgentTool = {
  name:        'get_report_detail',
  description: '報告書の詳細内容を取得する。「1件目詳しく」「この報告書の内容は？」「総合評価は？」「Before/After写真ある？」「AI品質評価どう？」「スコア何点？」等。get_reportsで取得したidを使う。',
  safetyLevel: 1,
  parameters: {
    type:       'object',
    properties: {
      report_id: { type: 'string', description: '報告書ID（get_reportsのid）' },
    },
    required: ['report_id'],
  },
  async execute(params, ctx): Promise<ToolResult> {
    try {
      const { report_id } = params
      if (!report_id) return { success: false, text: 'report_idを指定してください。' }
      const res = await apiFetch(`/api/reports/${report_id}`, ctx)
      if (!res.ok) return { success: false, text: '報告書が見つかりませんでした。' }
      const data  = await res.json()
      const rep   = data.data
      if (!rep) return { success: false, text: '報告書が見つかりませんでした。' }
      const content = rep.content ?? {}
      const summary = content.summary ?? {}
      const job     = content.job ?? {}
      const parts: string[] = [`報告書 v${rep.version}（id:${rep.id}）`]

      if (content.project?.name) parts.push(`案件: ${content.project.name}`)
      if (content.store?.name)   parts.push(`場所: ${content.store.name}`)
      if (content.client?.name)  parts.push(`顧客: ${content.client.name}`)
      if (job.work_date)         parts.push(`作業日: ${job.work_date}`)
      if (job.worker_name)       parts.push(`作業者: ${job.worker_name}`)
      if (job.started_at)        parts.push(`開始: ${new Date(job.started_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`)
      if (job.completed_at)      parts.push(`完了: ${new Date(job.completed_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`)

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

      if (summary.next_recommendations?.length > 0) {
        parts.push(`次回推奨: ${summary.next_recommendations.join('、')}`)
      }

      const pdfStatus = rep.pdf_url ? 'PDF生成済み' : 'PDF未生成'
      parts.push(pdfStatus)

      return { success: true, text: parts.join('\n'), data, items: [{ id: rep.id, label: `v${rep.version} ${content.project?.name ?? ''}` }] }
    } catch {
      return { success: false, text: '報告書詳細の取得中にエラーが発生しました。' }
    }
  },
}

// ─── Invoice / Estimate READ Tools ───────────────────────────

const INVOICE_TYPE_LABELS: Record<string, string> = { quote: '見積書', invoice: '請求書' }
const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: '下書き', issued: '発行済み', accepted: '承認済み', rejected: '却下',
  sent: '送付済み', awaiting_payment: '入金待ち', overdue: '期限超過',
  paid: '入金済み', cancelled: 'キャンセル',
}

const getInvoices: ConsoleAgentTool = {
  name:        'get_invoices',
  description: '請求書・見積書の一覧を取得する。「見積書一覧」「請求書教えて」「未入金の請求は？」「ABC社の見積ある？」等。invoice_typeで絞り込み可。',
  safetyLevel: 1,
  parameters: {
    type:       'object',
    properties: {
      invoice_type: { type: 'string', description: 'quote（見積書）またはinvoice（請求書）。省略時は両方' },
      status:       { type: 'string', description: 'draft/issued/accepted/rejected/sent/awaiting_payment/overdue/paid/cancelled' },
      client_id:    { type: 'string', description: '顧客IDで絞り込む' },
      project_id:   { type: 'string', description: '案件IDで絞り込む' },
    },
    required: [],
  },
  async execute(params, ctx): Promise<ToolResult> {
    try {
      const q = new URLSearchParams()
      if (params.invoice_type) q.set('invoice_type', params.invoice_type)
      if (params.status)       q.set('status',       params.status)
      if (params.client_id)    q.set('client_id',    params.client_id)
      if (params.project_id)   q.set('project_id',   params.project_id)
      const res = await apiFetch(`/api/invoices?${q}`, ctx)
      if (!res.ok) return { success: false, text: '請求書・見積書の一覧を取得できませんでした。' }
      const data = await res.json()
      const list: any[] = data.invoices ?? []
      if (list.length === 0) {
        const typeLabel = params.invoice_type ? INVOICE_TYPE_LABELS[params.invoice_type] ?? params.invoice_type : '請求書・見積書'
        return { success: true, text: `${typeLabel}はありません。`, data }
      }
      const lines = list.slice(0, 10).map((inv: any) => {
        const type   = INVOICE_TYPE_LABELS[inv.invoice_type] ?? inv.invoice_type
        const status = INVOICE_STATUS_LABELS[inv.status] ?? inv.status
        const client = inv.clients?.name ?? '顧客不明'
        const amount = inv.total_amount != null ? `${inv.total_amount.toLocaleString()}円` : '金額不明'
        return `${inv.invoice_number ?? inv.id} ${type}（${client}）${amount} [${status}] [id:${inv.id}]`
      })
      const total = list.length > 10 ? `（全${list.length}件中10件表示）` : `（全${list.length}件）`
      return { success: true, text: `${lines.join('\n')} ${total}`, data, items: list.slice(0, 10).map((inv: any) => ({ id: inv.id, label: `${inv.invoice_number ?? inv.id} ${INVOICE_TYPE_LABELS[inv.invoice_type] ?? ''} ${inv.clients?.name ?? ''}` })) }
    } catch {
      return { success: false, text: '請求書・見積書一覧の取得中にエラーが発生しました。' }
    }
  },
}

const getInvoiceDetail: ConsoleAgentTool = {
  name:        'get_invoice_detail',
  description: '請求書または見積書の詳細を取得する。「1件目詳しく」「この見積いくら？」「支払期限いつ？」「明細は？」等。get_invoicesで取得したidを使う。',
  safetyLevel: 1,
  parameters: {
    type:       'object',
    properties: {
      invoice_id: { type: 'string', description: '請求書/見積書のID（get_invoicesのid）' },
    },
    required: ['invoice_id'],
  },
  async execute(params, ctx): Promise<ToolResult> {
    try {
      const { invoice_id } = params
      if (!invoice_id) return { success: false, text: 'invoice_idを指定してください。' }
      const res = await apiFetch(`/api/invoices/${invoice_id}`, ctx)
      if (!res.ok) return { success: false, text: '請求書・見積書が見つかりませんでした。' }
      const data = await res.json()
      const inv = data.invoice
      if (!inv) return { success: false, text: '請求書・見積書が見つかりませんでした。' }
      const type   = INVOICE_TYPE_LABELS[inv.invoice_type] ?? inv.invoice_type
      const status = INVOICE_STATUS_LABELS[inv.status] ?? inv.status
      const parts: string[] = [
        `${type}番号: ${inv.invoice_number ?? inv.id}`,
        `顧客: ${inv.clients?.name ?? '不明'}`,
        `ステータス: ${status}`,
      ]
      if (inv.projects?.name) parts.push(`案件: ${inv.projects.name}`)
      if (inv.issue_date)     parts.push(`発行日: ${inv.issue_date}`)
      if (inv.due_date)       parts.push(`支払期限: ${inv.due_date}`)
      if (inv.subtotal   != null) parts.push(`小計: ${inv.subtotal.toLocaleString()}円`)
      if (inv.tax_amount != null) parts.push(`消費税: ${inv.tax_amount.toLocaleString()}円`)
      if (inv.total_amount != null) parts.push(`合計: ${inv.total_amount.toLocaleString()}円`)
      if (inv.paid_amount  != null && inv.invoice_type === 'invoice') {
        parts.push(`入金済: ${inv.paid_amount.toLocaleString()}円`)
        const remaining = (inv.total_amount ?? 0) - (inv.paid_amount ?? 0)
        if (remaining > 0) parts.push(`残額: ${remaining.toLocaleString()}円`)
      }
      const items: any[] = inv.invoice_items ?? []
      if (items.length > 0) {
        const itemLines = items.map((it: any) =>
          `  ・${it.description} ${it.quantity}${it.unit ?? ''}×${it.unit_price?.toLocaleString()}円＝${it.amount?.toLocaleString()}円`
        )
        parts.push(`明細:\n${itemLines.join('\n')}`)
      }
      return { success: true, text: parts.join('\n'), data, items: [{ id: inv.id, label: inv.invoice_number ?? inv.id }] }
    } catch {
      return { success: false, text: '請求書・見積書詳細の取得中にエラーが発生しました。' }
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
  getShifts,
  getShiftDetail,
  getShiftAttendanceStatus,
  getPendingAttendance,
  getAttendanceCorrectionDetail,
  getAttendanceToday,
  getAttendanceRecords,
  getNotifications,
  getPendingExpenses,
  getExpenseDetail,
  getPendingRequests,
  getRevenueSummary,
  getReports,
  getReportDetail,
  getInvoices,
  getInvoiceDetail,
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
