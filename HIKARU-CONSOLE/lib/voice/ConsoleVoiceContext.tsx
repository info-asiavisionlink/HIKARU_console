'use client'
// ============================================================
// ConsoleVoiceContext — CONSOLE Persistent Voice Provider
// ConsoleLayoutに1つだけ配置。ページ遷移後もSessionを維持する。
// Realtime(WebRTC)を標準Voice Engine。失敗時はBrowser STTへfallback。
// SystemのSystemVoiceContextとは完全分離（CONSOLE業務専用）。
// useConsoleJarvis() で各Pageから消費する。
// ============================================================

import * as React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { browserTTS }            from '@/lib/voice/tts/browser'
import type {
  VoiceMode, VoiceEngineMode, ConversationContext, LastResultData, VoiceSettings, PendingConfirmation,
} from '@/lib/voice/state/types'
import type { ConsoleActionName } from '@/lib/voice/registry/console.actions'
import {
  CONSOLE_NAV_DESTINATIONS, executeConsoleNavigation,
} from '@/lib/voice/registry/console.navigation'

// ─── CONSOLE Realtime定数 ─────────────────────────────────────
// gpt-realtime-2.1 = @openai/agents-realtime v0.17 のデフォルトモデル（Worker準拠）。
const RT_MODEL = 'gpt-realtime-2.1'

const RT_SYSTEM_PROMPT = `あなたはHIKARU Console管理者アシスタント「JARVIS」です。
管理者・マネージャーの業務をサポートする音声アシスタントです。
回答は2〜3文以内で日本語で簡潔に。

## Navigation（「開いて」「移動して」「表示して」）
navigate_to(destination) を使う。destinationは以下のenum値のみ使用。任意URLは絶対使用しない。
dashboard=ダッシュボード / projects=案件管理 / project_requests=案件依頼 / clients=顧客管理 /
stores=店舗管理 / employees=従業員管理 / workers=作業者管理 / partners=協力業者管理 /
shifts=シフト管理 / attendance=勤怠管理 / expenses=経費管理 / invoices=請求管理 /
notifications=通知 / quality=品質管理 / manuals=マニュアル管理 / reports=報告書 /
analytics=AI分析 / inventory=在庫管理 / contracts=契約管理 / settings=設定 / back=前の画面

## 自然言語理解の原則
ユーザーは機能名や画面名を正確に言わない。発話の意味・文脈から最適なToolを選ぶ。
言い換え・口語・省略表現を理解すること。

## Read vs Navigate の判断
「〜教えて」「どうなってる？」「いくら？」「何件？」「誰が？」「ある？」→ データ取得Tool
「〜開いて」「〜の画面にして」「〜に移動して」「〜見せて」→ navigate_to
情報を聞いている場合はNavigationだけで済ませない。画面を開く依頼ではデータ取得Toolを勝手に使わない。

## 未対応機能
まだToolが接続されていない機能（在庫数・契約詳細・報告書内容等）を聞かれた場合:
架空データを返さず「現在Voiceから確認する機能はまだ接続されていません。画面は開けます。」と答える。

## Data Read（代表例 — 言い換えも意味から判断する）
NavigationせずにDataツールを使う。
案件・現場・仕事の状況 → get_projects（status/project_type/search指定可）
案件詳細 → get_project_detail（project_idを指定）
担当者 → get_project_assignments（project_idを指定）→ 実名を返す
経費申請・処理待ちの申請 → get_pending_expenses（申請者・金額・カテゴリ付きで返す）
経費詳細 → get_expense_detail（expense_idを指定）
勤怠修正申請 → get_pending_attendance
通知・連絡 → get_notifications
ダッシュボード → get_dashboard_summary
売上・未入金・未請求 → get_revenue_summary（navigationしない）
従業員一覧・スタッフ情報 → get_employees（search/status指定可）
従業員詳細・連絡先 → get_employee_detail（employee_idを指定）
従業員の担当案件 → get_employee_projects（employee_idを指定）
従業員の勤怠概要 → get_employee_attendance_summary（employee_idを指定）
従業員のシフト → get_employee_shifts（employee_idを指定）
従業員の品質評価 → get_employee_quality_summary（employee_idを指定）

## 従業員操作手順
従業員一覧: get_employees（search/status指定可）→ employeeId確認
従業員詳細: get_employee_detail（employeeIdが必要）
担当案件: get_employee_projects（employeeIdが必要）
勤怠概要: get_employee_attendance_summary（employeeIdが必要）
シフト: get_employee_shifts（employeeIdが必要）
品質評価: get_employee_quality_summary（employeeIdが必要、データなし時は正直に回答）
従業員登録: name確認後 → 確認後 execute_confirmed_action(console.create_employee, {name, phone?, email?, name_kana?, hire_date?, department?, position?, notes?})
  確認文例: 「田中太郎さんを従業員登録します。よろしいですか？」
  ※パスワード・ログイン設定は管理画面から実施。AIでパスワード生成禁止。
従業員編集: get_employee_detailで現在値確認 → 確認後 execute_confirmed_action(console.update_employee, {employeeId, [変更フィールド]: 値})
  変更可能: name/phone/email/name_kana/hire_date/department/position/notes
  確認文例: 「電話番号を03-xxxx-xxxxに変更します。よろしいですか？」
ステータス変更: 確認後 execute_confirmed_action(console.update_employee_status, {employeeId, status})
  status値: active=在籍中 / on_leave=休職中 / resigned=退職 / suspended=利用停止
  ※deleted（削除）は音声禁止。退職≠削除を混同しない。
従業員削除: 音声で実行不可。「従業員削除は管理画面から操作してください。」と答える。
権限変更（admin/worker）: 音声で実行不可。「権限変更は管理画面から操作してください。」と答える。

## 従業員IDルール（最重要）
employeeIdは必ずget_employeesのresultから取得する。AI生成employeeId禁止。
同名従業員が複数いる場合: 「どの方ですか？」と聞いてから操作する。
Write時は特に厳格に実IDを確認してから実行する。

## 顧客操作手順
顧客一覧: get_clients（search指定可）→ clientId確認
顧客詳細: get_client_detail（clientIdが必要）
顧客の店舗: get_client_stores（clientIdが必要）
顧客の案件: get_client_projects（clientIdが必要）
顧客登録: name確認後 → 確認後 execute_confirmed_action(console.create_client, {name, phone?, email?, address?, contact_name?, notes?})
  確認文例: 「ABC株式会社、担当者田中様で登録します。よろしいですか？」
顧客編集: get_client_detailで現在値確認 → 確認後 execute_confirmed_action(console.update_client, {clientId, [変更フィールド]: 値})
  変更可能: name/code/phone/email/address/contact_name/notes/is_active
  確認文例: 「電話番号を03-xxxx-xxxxに変更します。よろしいですか？」
顧客削除: 音声で実行不可。「管理画面から操作してください。」と答える。

## Project Create/Status（重要手順）
1. 対象案件が不明な場合 → 「どの案件ですか？」と聞く。勝手に選ばない。
2. ステータス変更: 確認後 execute_confirmed_action(console.update_project_status, {projectId, status}) — status: active/paused/completed/cancelled
3. 案件削除は音声で実行不可。「案件削除は管理画面から操作してください。」と答える。

## 担当者操作（add/remove/replace）（重要）
担当者ID・名前は必ず resolve_person で解決する。AI生成ID絶対禁止。

担当追加:
1. get_project_assignments でprojectId確認・現在担当取得
2. resolve_person(name) → 1件確定 or 複数は選択させる
3. 重複確認（すでに担当なら追加しない）
4. 確認文: 「この案件に○○さんを担当として追加します。よろしいですか？」
5. 確認後: execute_confirmed_action(console.add_assignment, {projectId, assignee_type, assignee_id, assignee_name})

担当削除:
1. get_project_assignments で現在担当取得・対象特定
2. 確認文: 「○○さんをこの案件の担当から外します。よろしいですか？」
3. 確認後: execute_confirmed_action(console.remove_assignment, {projectId, assignee_type, assignee_id, assignee_name})

担当変更（from→to）:
1. 両者をresolve_personで解決
2. 確認文: 「○○さんから△△さんに担当を変更します。よろしいですか？」
3. 確認後: execute_confirmed_action(console.replace_assignment, {projectId, from_type, from_id, from_name, to_type, to_id, to_name})

## 案件作成（完全版）
1. 案件名・種別(spot/recurring/hotel)を確認
2. 顧客名が分かる場合: resolve_client(name) → clientId確定
3. 店舗名が分かる場合: resolve_store(name, client_id) → storeId確定
4. 確認文: 「○○株式会社、○○店、スポット案件『○○』を8月25日開始で登録します。よろしいですか？」
5. 確認後: execute_confirmed_action(console.create_project, {name, project_type, start_date?, end_date?, location_name?, client_id?, store_id?, notes?})

## 案件編集
1. 対象案件のprojectIdを確認（get_projects等）
2. get_project_detailで現在値を確認してから変更内容を確認
3. 確認後: execute_confirmed_action(console.update_project, {projectId, [変更フィールド]: 値})
変更可能フィールド: name / project_type / start_date / end_date / location_name / address / notes / client_id / store_id

## Expense Approve/Reject（重要手順）
1. まずget_pending_expensesかget_expense_detailで対象expenseIdを確認する
2. 対象が複数あり特定できない場合 → 「どの経費を承認/却下しますか？」と聞く。勝手に選ばない。
3. 承認: 確認後 execute_confirmed_action(action='console.approve_expense', params={expenseId})
4. 却下: 却下理由を先にユーザーから聞く → 確認後 execute_confirmed_action(action='console.reject_expense', params={expenseId, reject_reason})
5. 確認文例（承認）: 「田中さんの交通費1,200円を承認します。よろしいですか？」

## 売上・利益・期間のルール（厳守）
- 売上金額はget_revenue_summaryのTool Result以外から答えない。推測・計算禁止。
- 「利益は？」→ Tool不使用。「現在HIKARUに登録されている情報だけでは正確な利益は算出できません。」と答える。
- 「先月の売上」等、今月・今年以外の期間 → 「現在のDashboardでは今月と今年の売上を確認できます。」と答える。

## Write操作（最重要）
全てのWriteは必ずユーザーの確認を取ってから execute_confirmed_action を呼ぶ。確認なしに実行ツールを呼ばない。

## actionとparamsの対応
- console.update_project_status → params: { projectId, status }
- console.create_project        → params: { name, project_type, start_date?, end_date?, location_name?, client_id?, store_id?, notes? }
- console.update_project        → params: { projectId, [変更フィールド]: 値 }
- console.add_assignment        → params: { projectId, assignee_type, assignee_id, assignee_name }
- console.remove_assignment     → params: { projectId, assignee_type, assignee_id, assignee_name }
- console.replace_assignment    → params: { projectId, from_type, from_id, from_name, to_type, to_id, to_name }
- console.approve_expense          → params: { expenseId }
- console.reject_expense           → params: { expenseId, reject_reason }
- console.approve_attendance       → params: { correctionId }
- console.create_employee          → params: { name, phone?, email?, name_kana?, hire_date?, department?, position?, notes? }
- console.update_employee          → params: { employeeId, [変更フィールド]: 値 } ※変更可: name/phone/email/name_kana/hire_date/department/position/notes
- console.update_employee_status   → params: { employeeId, status: active/on_leave/resigned/suspended }`

// toolFactory = SDK の tool() 関数。FunctionTool(type:'function'+invoke付き)を生成するために必須。
// plain objectでは RealtimeSession の tool.type==='function' フィルタに通らない。
function buildConsoleRealtimeTools(
  router: ReturnType<typeof useRouter>,
  toolFactory: (opts: any) => any,
) {
  const apiFetch = async (path: string) => {
    const res = await fetch(path, { credentials: 'include' })
    if (!res.ok) return null
    return res.json()
  }
  return [
    toolFactory({
      name: 'get_dashboard_summary', description: 'ダッシュボードの今日の状況サマリーを取得する',
      parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
      execute: async () => {
        const data = await apiFetch('/api/dashboard')
        if (!data) return 'ダッシュボード情報を取得できませんでした。'
        const parts: string[] = []
        // API: { projects: { active, total, ... }, clients, employees, partners, revenue }
        if (data?.projects?.active  != null) parts.push(`進行中案件: ${data.projects.active}件`)
        if (data?.projects?.total   != null && data.projects.total !== data.projects.active)
          parts.push(`案件合計: ${data.projects.total}件`)
        if (data?.employees?.active != null) parts.push(`在籍従業員: ${data.employees.active}名`)
        return parts.length > 0 ? `現在: ${parts.join('、')}` : 'ダッシュボードを確認してください。'
      },
    }),
    toolFactory({
      name: 'get_projects',
      description: '案件・現場・仕事の一覧や状況を確認する。「案件教えて」「今どんな仕事が入ってる？」「今日動いてる現場ある？」「スポットの案件だけ見たい」等。画面を開く依頼ではなく情報を求める場合に使う。',
      parameters: {
        type: 'object',
        properties: {
          status:       { type: 'string', description: 'active/paused/completed/cancelled等' },
          project_type: { type: 'string', description: 'spot/recurring/hotel' },
          search:       { type: 'string', description: '案件名検索キーワード' },
        },
        required: [],
        additionalProperties: false,
      },
      execute: async ({ status, project_type, search }: { status?: string; project_type?: string; search?: string }) => {
        const q = new URLSearchParams()
        if (status)       q.set('status',       status)
        if (project_type) q.set('project_type', project_type)
        if (search)       q.set('search',       search)
        const data = await apiFetch(`/api/projects?${q}`)
        if (!data) return '案件一覧を取得できませんでした。'
        // API: { projects: [...], count: N }
        const list  = Array.isArray(data?.projects) ? data.projects : []
        const total = data?.count ?? list.length
        if (total === 0) return '案件はありません。'
        const PT: Record<string, string> = { spot: 'スポット', recurring: '定期', hotel: 'ホテル' }
        const ST: Record<string, string> = { active: '稼働中', paused: '停止中', completed: '完了', cancelled: 'キャンセル', scheduled_confirmed: '予定確定', scheduled_unconfirmed: '予定未確定', billing_pending: '入金待ち' }
        const items = list.slice(0, 5).map((p: any, i: number) => {
          const type   = PT[p.project_type] ?? p.project_type ?? '不明'
          const stat   = ST[p.status] ?? p.status ?? '不明'
          const client = p.stores?.clients?.name ?? p.stores?.name ?? ''
          const date   = p.start_date ? `、${p.start_date}` : ''
          return `${i + 1}件目: ${p.name}、${type}、${stat}${client ? `、${client}` : ''}${date} [id:${p.id}]`
        }).join(' / ')
        const suffix = list.length < total ? `（最初の${list.length}件）` : ''
        return `案件${total}件${suffix}。${items}`
      },
    }),
    toolFactory({
      name: 'get_project_detail',
      description: '指定IDの案件詳細を取得する。一覧でIDを確認後に使う。',
      parameters: {
        type: 'object',
        properties: { project_id: { type: 'string', description: '案件のID' } },
        required: ['project_id'], additionalProperties: false,
      },
      execute: async ({ project_id }: { project_id: string }) => {
        if (!project_id) return '案件IDが必要です。'
        const data = await apiFetch(`/api/projects/${project_id}`)
        if (!data) return '案件詳細を取得できませんでした。'
        const p = data?.project
        if (!p) return '案件が見つかりませんでした。'
        const PT: Record<string, string> = { spot: 'スポット', recurring: '定期', hotel: 'ホテル' }
        const ST: Record<string, string> = { active: '稼働中', paused: '停止中', completed: '完了', cancelled: 'キャンセル', scheduled_confirmed: '予定確定', scheduled_unconfirmed: '予定未確定', billing_pending: '入金待ち' }
        const type   = PT[p.project_type] ?? p.project_type ?? '不明'
        const stat   = ST[p.status] ?? p.status ?? '不明'
        const client = p.clients?.name ?? ''
        const assigns = Array.isArray(p.project_assignments) ? p.project_assignments.length : 0
        const start  = p.start_date ? `、開始: ${p.start_date}` : ''
        const end    = p.end_date   ? `〜${p.end_date}` : ''
        const loc    = p.location_name ? `、場所: ${p.location_name}` : ''
        return `案件詳細 — ${p.name}、${type}、${stat}${client ? `、顧客: ${client}` : ''}${start}${end}${loc}、担当${assigns}名、ID: ${project_id}`
      },
    }),
    toolFactory({
      name: 'get_project_assignments',
      description: '指定IDの案件担当者を実名で取得する。担当追加/変更/削除前にも使う。',
      parameters: {
        type: 'object',
        properties: { project_id: { type: 'string', description: '案件のID' } },
        required: ['project_id'], additionalProperties: false,
      },
      execute: async ({ project_id }: { project_id: string }) => {
        if (!project_id) return '案件IDが必要です。'
        const data = await apiFetch(`/api/projects/${project_id}/assignments`)
        if (!data) return '担当者情報を取得できませんでした。'
        const assignments: { assignee_type: string; assignee_id: string }[] = Array.isArray(data?.data) ? data.data : []
        if (assignments.length === 0) return `この案件に担当者はいません。[project_id:${project_id}|assignments:[]]`

        const empIds     = assignments.filter(a => a.assignee_type === 'employee').map(a => a.assignee_id)
        const partnerIds = assignments.filter(a => a.assignee_type === 'partner').map(a => a.assignee_id)
        const empMap     = new Map<string, string>()
        const partnerMap = new Map<string, string>()

        await Promise.all([
          empIds.length > 0
            ? apiFetch('/api/employees?pageSize=200').then(d => {
                if (d) for (const e of (d.data ?? [])) empMap.set(e.id, e.name ?? e.id)
              }).catch(() => {})
            : Promise.resolve(),
          partnerIds.length > 0
            ? apiFetch('/api/partners?pageSize=200').then(d => {
                if (d) for (const p of (d.data ?? [])) partnerMap.set(p.id, p.company_name ?? p.contact_person_name ?? p.id)
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
      },
    }),
    toolFactory({
      name: 'resolve_person',
      description: '名前キーワードで従業員・協力業者を検索し候補を返す。担当追加/変更前に必ず使う。AI生成ID禁止。',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: '検索する名前キーワード' } },
        required: ['name'], additionalProperties: false,
      },
      execute: async ({ name }: { name: string }) => {
        if (!name?.trim()) return '名前が必要です。'
        const [empData, partnerData] = await Promise.all([
          apiFetch(`/api/employees?search=${encodeURIComponent(name)}&pageSize=10`),
          apiFetch(`/api/partners?search=${encodeURIComponent(name)}&pageSize=10`),
        ])
        const employees: any[] = empData?.data     ?? []
        const partners:  any[] = partnerData?.data ?? []
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
      },
    }),
    toolFactory({
      name: 'resolve_client',
      description: '顧客名で検索しclient_idを返す。案件作成/編集前に必ず使う。新規顧客登録は行わない。',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: '顧客名キーワード' } },
        required: ['name'], additionalProperties: false,
      },
      execute: async ({ name }: { name: string }) => {
        if (!name?.trim()) return '顧客名が必要です。'
        const data = await apiFetch(`/api/clients?search=${encodeURIComponent(name)}&pageSize=10`)
        if (!data) return '顧客情報を取得できませんでした。'
        const clients: any[] = data.clients ?? []
        if (clients.length === 0) return `「${name}」という顧客は見つかりませんでした。新規顧客の登録は管理画面から行ってください。`
        const list = clients.map((c: any) => `${c.id}:${c.name}`).join(' / ')
        if (clients.length === 1) return `顧客「${clients[0].name}」確定 [clientId:${clients[0].id}|clientName:${clients[0].name}]`
        return `「${name}」に一致する顧客が${clients.length}件あります。どの顧客ですか？ [candidates: ${list}]`
      },
    }),
    toolFactory({
      name: 'resolve_store',
      description: '店舗名で検索しstore_idを返す。client_idが決まっている場合は指定する。',
      parameters: {
        type: 'object',
        properties: {
          name:      { type: 'string', description: '店舗名キーワード' },
          client_id: { type: 'string', description: '顧客ID（指定するとその顧客の店舗に絞り込む）' },
        },
        required: ['name'], additionalProperties: false,
      },
      execute: async ({ name, client_id }: { name: string; client_id?: string }) => {
        if (!name?.trim()) return '店舗名が必要です。'
        const q = new URLSearchParams({ search: name, pageSize: '10' })
        if (client_id) q.set('client_id', client_id)
        const data = await apiFetch(`/api/stores?${q}`)
        if (!data) return '店舗情報を取得できませんでした。'
        const stores: any[] = data.stores ?? []
        if (stores.length === 0) return `「${name}」という店舗は見つかりませんでした。`
        const list = stores.map((s: any) => {
          const cn = s.clients?.name ?? ''
          return `${s.id}:${s.name}${cn ? `(${cn})` : ''}`
        }).join(' / ')
        if (stores.length === 1) return `店舗「${stores[0].name}」確定 [storeId:${stores[0].id}|storeName:${stores[0].name}|clientId:${stores[0].client_id}]`
        return `「${name}」に一致する店舗が${stores.length}件あります。どの店舗ですか？ [candidates: ${list}]`
      },
    }),
    // ─── Client Tools ──────────────────────────────────────
    toolFactory({
      name: 'get_clients',
      description: '顧客・取引先の一覧や状況を確認する。「顧客一覧教えて」「取引先どんな会社ある？」「ABC社って登録されてる？」「何社取引してる？」等。画面を開く依頼ではなく情報を求める場合に使う。',
      parameters: {
        type: 'object',
        properties: { search: { type: 'string', description: '顧客名・コード・メールで検索' } },
        required: [], additionalProperties: false,
      },
      execute: async ({ search }: { search?: string }) => {
        const q = new URLSearchParams({ pageSize: '10' })
        if (search) q.set('search', search)
        const data = await apiFetch(`/api/clients?${q}`)
        if (!data) return '顧客情報を取得できませんでした。'
        const clients: any[] = data.clients ?? []
        const total = data.count ?? clients.length
        if (total === 0) return search ? `「${search}」という顧客は見つかりませんでした。` : '顧客は登録されていません。'
        const items = clients.slice(0, 5).map((c: any, i: number) => {
          const status = c.is_active === false ? '停止中' : '稼働中'
          return `${i + 1}件目: ${c.name}${c.code ? `（${c.code}）` : ''}、${status} [id:${c.id}]`
        }).join(' / ')
        return `顧客${total}社。${items}`
      },
    }),
    toolFactory({
      name: 'get_client_detail',
      description: '指定した顧客の詳細情報（連絡先・住所・担当者等）を取得する。「この会社の情報教えて」「電話番号は？」「メールアドレスは？」「住所は？」等。一覧でIDを確認後に使う。',
      parameters: {
        type: 'object',
        properties: { client_id: { type: 'string', description: '顧客のID' } },
        required: ['client_id'], additionalProperties: false,
      },
      execute: async ({ client_id }: { client_id: string }) => {
        if (!client_id) return '顧客IDが必要です。'
        const data = await apiFetch(`/api/clients/${client_id}`)
        if (!data) return '顧客情報を取得できませんでした。'
        const c = data?.data
        if (!c) return '顧客が見つかりませんでした。'
        const status = c.is_active === false ? '停止中' : '稼働中'
        const parts: string[] = [`顧客詳細 — ${c.name}${c.code ? `（${c.code}）` : ''}、${status}`]
        if (c.contact_name) parts.push(`担当: ${c.contact_name}`)
        if (c.phone)        parts.push(`電話: ${c.phone}`)
        if (c.email)        parts.push(`メール: ${c.email}`)
        if (c.address)      parts.push(`住所: ${c.address}`)
        return `${parts.join('、')} [id:${client_id}]`
      },
    }),
    toolFactory({
      name: 'get_client_stores',
      description: '指定した顧客に紐づく店舗一覧を取得する。「この会社の店舗教えて」「このお客さんの拠点は？」「どこに店舗ある？」等。',
      parameters: {
        type: 'object',
        properties: { client_id: { type: 'string', description: '顧客のID' } },
        required: ['client_id'], additionalProperties: false,
      },
      execute: async ({ client_id }: { client_id: string }) => {
        if (!client_id) return '顧客IDが必要です。'
        const data = await apiFetch(`/api/stores?client_id=${client_id}&pageSize=20`)
        if (!data) return '店舗情報を取得できませんでした。'
        const stores: any[] = data.stores ?? []
        if (stores.length === 0) return 'この顧客に紐づく店舗は登録されていません。'
        const items = stores.slice(0, 8).map((s: any, i: number) =>
          `${i + 1}件目: ${s.name}${s.address ? `、${s.address}` : ''} [id:${s.id}]`
        ).join(' / ')
        return `店舗${stores.length}件。${items}`
      },
    }),
    toolFactory({
      name: 'get_client_projects',
      description: '指定した顧客に紐づく案件一覧を取得する。「この会社の案件教えて」「この顧客の仕事は？」「今この会社で動いてる現場ある？」等。',
      parameters: {
        type: 'object',
        properties: { client_id: { type: 'string', description: '顧客のID' } },
        required: ['client_id'], additionalProperties: false,
      },
      execute: async ({ client_id }: { client_id: string }) => {
        if (!client_id) return '顧客IDが必要です。'
        const data = await apiFetch(`/api/projects?client_id=${client_id}&pageSize=10`)
        if (!data) return '案件情報を取得できませんでした。'
        const projects: any[] = data.projects ?? []
        const total = data.count ?? projects.length
        if (total === 0) return 'この顧客に紐づく案件はありません。'
        const PT: Record<string, string> = { spot: 'スポット', recurring: '定期', hotel: 'ホテル' }
        const ST: Record<string, string> = { active: '稼働中', paused: '停止中', completed: '完了', cancelled: 'キャンセル' }
        const items = projects.slice(0, 5).map((p: any, i: number) =>
          `${i + 1}件目: ${p.name}、${PT[p.project_type] ?? p.project_type}、${ST[p.status] ?? p.status} [id:${p.id}]`
        ).join(' / ')
        return `案件${total}件。${items}`
      },
    }),
    toolFactory({
      name: 'get_pending_expenses', description: '承認待ちの経費申請一覧を取得する。「経費申請来てる？」「まだ処理してない経費ある？」「お金の申請が上がってる？」等に使う。データを取得する場合に使う（画面を開く場合はnavigate_toを使う）。',
      parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
      execute: async () => {
        const data = await apiFetch('/api/expenses?status=submitted')
        if (!data) return '経費申請を確認できませんでした。'
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
      },
    }),
    toolFactory({
      name: 'get_expense_detail', description: '指定IDの経費申請詳細を取得する。一覧でIDを確認後に使う。',
      parameters: {
        type: 'object',
        properties: { expense_id: { type: 'string', description: '経費申請のID' } },
        required: ['expense_id'], additionalProperties: false,
      },
      execute: async ({ expense_id }: { expense_id: string }) => {
        if (!expense_id) return '経費IDが必要です。'
        const data = await apiFetch(`/api/expenses/${expense_id}`)
        if (!data) return '経費詳細を取得できませんでした。'
        const exp = data?.expense
        if (!exp) return '経費情報が見つかりませんでした。'
        const CATS: Record<string, string> = { transport: '交通費', parking: '駐車料', supplies: '備品費', consumables: '消耗品費', other: 'その他' }
        const name = exp.profiles?.name ?? '申請者不明'
        const cat  = CATS[exp.category] ?? exp.category ?? 'その他'
        const amt  = `${Number(exp.amount ?? 0).toLocaleString('ja-JP')}円`
        const date = exp.expense_date ? `、${exp.expense_date}` : ''
        const desc = exp.description ? `、用途: ${exp.description}` : (exp.title ? `、件名: ${exp.title}` : '')
        const stat = exp.status ?? '不明'
        return `経費詳細 — ${name}、${cat}、${amt}${date}${desc}、ステータス: ${stat}、ID: ${expense_id}`
      },
    }),
    toolFactory({
      name: 'get_pending_attendance', description: '勤怠修正申請の承認待ちを確認する。「勤怠修正来てる？」「勤務時間の直しの申請ある？」「修正申請何件？」等に使う。',
      parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
      execute: async () => {
        const data = await apiFetch('/api/attendance/corrections?status=pending')
        if (!data) return '勤怠修正申請を確認できませんでした。'
        // API: { corrections: [...] }（enriched: correction + worker { name } + attendance_record）
        const items = Array.isArray(data?.corrections) ? data.corrections : []
        if (items.length === 0) return '承認待ちの勤怠修正申請はありません。'
        const list = items.slice(0, 3).map((e: any, i: number) => `${i + 1}: ${e.worker?.name ?? '従業員'} [id:${e.id}]`).join(', ')
        return `承認待ちの勤怠修正申請が${items.length}件あります。${list}`
      },
    }),
    toolFactory({
      name: 'get_notifications', description: '管理者向け通知・未読件数を確認する。「通知ある？」「何か連絡来てる？」「未読メッセージある？」等に使う。',
      parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
      execute: async () => {
        const data = await apiFetch('/api/console-notifications')
        if (!data) return '通知を取得できませんでした。'
        const unread = data.unread_count ?? 0
        return unread === 0 ? '未読の通知はありません。' : `未読の通知が${unread}件あります。`
      },
    }),
    toolFactory({
      name: 'get_revenue_summary',
      description: '売上情報（今月・今年・未入金・未請求）をHIKARU登録データから取得する。「今月売上いくら？」「売上どんな感じ？」「まだ入ってきてないお金ある？」「未請求はいくら？」等に使う。利益計算・今月今年以外の期間は対応不可。',
      parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
      execute: async () => {
        const data = await apiFetch('/api/dashboard')
        if (!data) return '売上情報を取得できませんでした。'
        const rev = data?.revenue
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
      },
    }),
    toolFactory({
      name:        'navigate_to',
      description: '管理画面の指定ページへ移動・画面を開く。「〜開いて」「〜の画面にして」「〜に移動して」等の画面操作依頼に使う。情報を確認したい場合は移動ではなくデータ取得ツールを使う。destination enumのみ使用。任意URLは使用不可。',
      parameters:  {
        type:       'object',
        properties: {
          destination: {
            type: 'string',
            enum: [...CONSOLE_NAV_DESTINATIONS],
            description: '移動先。enumの値のみ使用。',
          },
        },
        required:             ['destination'],
        additionalProperties: false,
      },
      execute: async ({ destination }: { destination: string }) =>
        executeConsoleNavigation(destination, router),
    }),
    // ─── Employee Tools ─────────────────────────────────────
    toolFactory({
      name: 'get_employees',
      description: '従業員・スタッフの一覧を取得する。「従業員一覧教えて」「今誰が登録されてる？」「スタッフどんな人いる？」「田中さんって登録されてる？」「何名いる？」等。画面を開く依頼ではなく情報を求める場合に使う。',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: '名前・名前かな・メール・社員番号で検索' },
          status: { type: 'string', description: 'active=在籍中 / on_leave=休職中 / resigned=退職 / suspended=利用停止' },
        },
        required: [], additionalProperties: false,
      },
      execute: async ({ search, status }: { search?: string; status?: string }) => {
        const q = new URLSearchParams({ pageSize: '10' })
        if (search) q.set('search', search)
        if (status) q.set('status', status)
        const data = await apiFetch(`/api/employees?${q}`)
        if (!data) return '従業員情報を取得できませんでした。'
        const employees: any[] = data.data ?? []
        const total = data.count ?? employees.length
        if (total === 0) return search ? `「${search}」という従業員は見つかりませんでした。` : '従業員は登録されていません。'
        const ST: Record<string, string> = { active: '在籍中', on_leave: '休職中', resigned: '退職', suspended: '利用停止' }
        const items = employees.slice(0, 5).map((e: any, i: number) => {
          const num = e.employee_number ? `（${e.employee_number}）` : ''
          const st  = ST[e.status] ?? e.status ?? '不明'
          const dept = e.department ? `、${e.department}` : ''
          return `${i + 1}件目: ${e.name}${num}、${st}${dept} [id:${e.id}]`
        }).join(' / ')
        return `従業員${total}名。${items}`
      },
    }),
    toolFactory({
      name: 'get_employee_detail',
      description: '指定した従業員の詳細情報（連絡先・役職・入社日・担当案件数等）を取得する。「田中さんの情報教えて」「この人の電話番号は？」「メールは？」「いつ入社した？」「この人の役職は？」等。一覧でIDを確認後に使う。',
      parameters: {
        type: 'object',
        properties: { employee_id: { type: 'string', description: '従業員のID' } },
        required: ['employee_id'], additionalProperties: false,
      },
      execute: async ({ employee_id }: { employee_id: string }) => {
        if (!employee_id) return '従業員IDが必要です。'
        const data = await apiFetch(`/api/employees/${employee_id}`)
        if (!data) return '従業員情報を取得できませんでした。'
        const e = data?.data
        if (!e) return '従業員が見つかりませんでした。'
        const ST: Record<string, string> = { active: '在籍中', on_leave: '休職中', resigned: '退職', suspended: '利用停止' }
        const parts: string[] = [`${e.name}${e.employee_number ? `（${e.employee_number}）` : ''}、${ST[e.status] ?? e.status ?? '不明'}`]
        if (e.department) parts.push(`部署: ${e.department}`)
        if (e.position)   parts.push(`役職: ${e.position}`)
        if (e.phone)      parts.push(`電話: ${e.phone}`)
        if (e.email)      parts.push(`メール: ${e.email}`)
        if (e.hire_date)  parts.push(`入社: ${e.hire_date}`)
        const assignCount = Array.isArray(e.assignments) ? e.assignments.length : 0
        if (assignCount > 0) parts.push(`担当案件: ${assignCount}件`)
        return `${parts.join('、')} [id:${employee_id}]`
      },
    }),
    toolFactory({
      name: 'get_employee_projects',
      description: '指定した従業員が担当している案件一覧を取得する。「この人の担当案件は？」「田中さん今どの現場入ってる？」「この人の仕事は？」等。',
      parameters: {
        type: 'object',
        properties: { employee_id: { type: 'string', description: '従業員のID' } },
        required: ['employee_id'], additionalProperties: false,
      },
      execute: async ({ employee_id }: { employee_id: string }) => {
        if (!employee_id) return '従業員IDが必要です。'
        const data = await apiFetch(`/api/employees/${employee_id}`)
        if (!data) return '従業員情報を取得できませんでした。'
        const assignments: any[] = data?.data?.assignments ?? []
        if (assignments.length === 0) return 'この従業員に紐づく担当案件はありません。'
        const ST: Record<string, string> = { active: '稼働中', paused: '停止中', completed: '完了', cancelled: 'キャンセル' }
        const items = assignments.slice(0, 5).map((a: any, i: number) => {
          const p = a.projects
          if (!p) return `${i + 1}件目: 不明`
          const st = ST[p.status] ?? p.status ?? '不明'
          return `${i + 1}件目: ${p.name}、${st} [id:${p.id}]`
        }).join(' / ')
        return `担当案件${assignments.length}件。${items}`
      },
    }),
    toolFactory({
      name: 'get_employee_attendance_summary',
      description: '指定した従業員の勤怠概要（出勤日数・勤務時間）を取得する。「この人今月何日出勤した？」「田中さんの勤務状況は？」「この人今月どれくらい働いてる？」等。',
      parameters: {
        type: 'object',
        properties: {
          employee_id: { type: 'string', description: '従業員のID' },
          year:        { type: 'string', description: '年（例: 2026）省略時は今年' },
          month:       { type: 'string', description: '月（例: 8）省略時は今月' },
        },
        required: ['employee_id'], additionalProperties: false,
      },
      execute: async ({ employee_id, year, month }: { employee_id: string; year?: string; month?: string }) => {
        if (!employee_id) return '従業員IDが必要です。'
        const empData = await apiFetch(`/api/employees/${employee_id}`)
        if (!empData) return '従業員情報を取得できませんでした。'
        const e = empData?.data
        if (!e) return '従業員が見つかりませんでした。'
        if (!e.auth_user_id) return `${e.name}さんはシステムアカウントがないため勤怠データを確認できません。`
        const jstDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
        const y = year  ?? jstDate.slice(0, 4)
        const m = month ?? String(parseInt(jstDate.slice(5, 7), 10))
        const attData = await apiFetch(`/api/attendance?worker_id=${e.auth_user_id}&year=${y}&month=${m}`)
        if (!attData) return '勤怠情報を取得できませんでした。'
        const summary: any[] = attData.summary ?? []
        const ws = summary.find((s: any) => s.worker_id === e.auth_user_id)
        if (!ws) return `${e.name}さんの${m}月の勤怠記録はありません。`
        const hours = Math.round(ws.totalWorkMins / 60 * 10) / 10
        return `${e.name}さんの${m}月の勤怠: 出勤${ws.workDays}日、合計${hours}時間`
      },
    }),
    toolFactory({
      name: 'get_employee_shifts',
      description: '指定した従業員のシフト一覧を取得する。「この人今週のシフトは？」「田中さん次いつ入ってる？」「この人明日入ってる？」「いつシフト入ってる？」等。',
      parameters: {
        type: 'object',
        properties: {
          employee_id: { type: 'string', description: '従業員のID' },
          date_from:   { type: 'string', description: '開始日（YYYY-MM-DD）省略時は今日' },
          date_to:     { type: 'string', description: '終了日（YYYY-MM-DD）省略時は1週間後' },
        },
        required: ['employee_id'], additionalProperties: false,
      },
      execute: async ({ employee_id, date_from, date_to }: { employee_id: string; date_from?: string; date_to?: string }) => {
        if (!employee_id) return '従業員IDが必要です。'
        const todayJst = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
        const from = date_from ?? todayJst
        const end7 = new Date(todayJst)
        end7.setDate(end7.getDate() + 7)
        const toDate = date_to ?? end7.toISOString().slice(0, 10)
        const q = new URLSearchParams({ employee_id, date_from: from, date_to: toDate })
        const data = await apiFetch(`/api/shifts?${q}`)
        if (!data) return 'シフト情報を取得できませんでした。'
        const shifts: any[] = data.shifts ?? []
        if (shifts.length === 0) return `この期間のシフトは登録されていません。`
        const items = shifts.slice(0, 7).map((s: any) => {
          const date  = s.shift_date ?? '不明'
          const start = s.start_time ? s.start_time.slice(0, 5) : ''
          const end   = s.end_time   ? s.end_time.slice(0, 5)   : ''
          const proj  = s.projects?.name ?? ''
          return `${date} ${start}〜${end}${proj ? `（${proj}）` : ''}`
        }).join(' / ')
        return `${shifts.length}件のシフト。${items}`
      },
    }),
    toolFactory({
      name: 'get_employee_quality_summary',
      description: '指定した従業員の品質評価サマリー（平均スコア・評価件数）を取得する。「田中さんの品質どう？」「この人の評価は？」「平均スコアは？」「最近の品質評価教えて」等。評価は案件単位で個人帰属が明確なデータのみ使用。',
      parameters: {
        type: 'object',
        properties: {
          employee_id: { type: 'string', description: '従業員のID' },
          days:        { type: 'string', description: '集計対象日数（例: 30）省略時は30日' },
        },
        required: ['employee_id'], additionalProperties: false,
      },
      execute: async ({ employee_id, days }: { employee_id: string; days?: string }) => {
        if (!employee_id) return '従業員IDが必要です。'
        const empData = await apiFetch(`/api/employees/${employee_id}`)
        if (!empData) return '従業員情報を取得できませんでした。'
        const e = empData?.data
        if (!e) return '従業員が見つかりませんでした。'
        if (!e.auth_user_id) return `${e.name}さんはシステムアカウントがないため品質評価データを確認できません。`
        const d = days ? Math.min(parseInt(days, 10), 365) : 30
        const qData = await apiFetch(`/api/quality/workers?worker_id=${e.auth_user_id}&days=${d}`)
        if (!qData) return '品質情報を取得できませんでした。'
        const workers: any[] = qData.workers ?? []
        const w = workers.find((x: any) => x.worker_id === e.auth_user_id)
        if (!w || w.job_count === 0) return `${e.name}さんの過去${d}日間に完了した仕事の品質評価データはありません。`
        const parts: string[] = [`${e.name}さんの品質評価（過去${d}日間）`]
        parts.push(`評価件数: ${w.job_count}件`)
        if (w.avg_hqs    != null) parts.push(`HIKARUスコア: ${Math.round(w.avg_hqs * 10) / 10}点`)
        if (w.avg_ai_score != null) parts.push(`AI評価平均: ${Math.round(w.avg_ai_score * 10) / 10}点`)
        if (w.avg_customer_score != null) parts.push(`顧客評価平均: ${Math.round(w.avg_customer_score * 10) / 10}点`)
        return parts.join('、')
      },
    }),
    toolFactory({
      name: 'execute_confirmed_action',
      description: 'ユーザーが「はい」と確認した後にのみ呼ぶ。Server Auth再検証して実行。',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['console.update_project_status', 'console.create_project', 'console.update_project', 'console.add_assignment', 'console.remove_assignment', 'console.replace_assignment', 'console.create_client', 'console.update_client', 'console.approve_expense', 'console.approve_attendance', 'console.reject_expense', 'console.create_employee', 'console.update_employee', 'console.update_employee_status'] },
          params: { type: 'object', additionalProperties: { type: 'string' } },
        },
        required: ['action'],
        additionalProperties: false,
      },
      execute: async ({ action, params = {} }: { action: string; params?: Record<string, string> }) => {
        try {
          const res = await fetch('/api/ai/confirm-action', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({ action, params, safetyLevel: 4, expiresAt: Date.now() + 90_000 }),
          })
          const data = await res.json()
          return res.ok ? (data.voiceReply ?? '完了しました。') : (data.error ?? '実行に失敗しました。')
        } catch { return '実行中にエラーが発生しました。' }
      },
    }),
  ]
}

// ─── STT型補完 ───────────────────────────────────────────────
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string
}
type SpeechRecognitionInstance = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number
  start(): void; stop(): void; abort(): void
  onresult:  ((e: SpeechRecognitionEvent) => void) | null
  onerror:   ((e: SpeechRecognitionErrorEvent) => void) | null
  onend:     (() => void) | null
}

interface IntentResult {
  action:     ConsoleActionName | null
  confidence: number
  params:     Record<string, string>
  voiceReply: string | null
}

export interface ConsoleChatMessage {
  role:      'user' | 'assistant'
  text:      string
  timestamp: number
}

// ─── セッション設定 ──────────────────────────────────────────
const SESSION_STOP_RE    = /^(終了|やめて|止めて|ストップ|セッション終了|会話終了|閉じて|おしまい|終わり)$/
const CONFIRM_YES_EXACT  = new Set(['はい', 'うん', 'ええ', 'ok', 'OK', 'オーケー', 'そう', 'そうです', 'もちろん', 'わかりました', 'わかった'])
const CONFIRM_YES_STARTS = ['よろし', 'お願いします', 'いいです', 'いいよ', 'それでお願い', '実行して', '進めて', 'そうして', '承認します']
const CONFIRM_NO_EXACT   = new Set(['いいえ', 'いや', 'ノー'])
const CONFIRM_NO_STARTS  = ['やめ', 'キャンセル', 'やっぱり', '違います', '戻して', '実行しない', 'ストップ', '取り消し', '却下']
function isConfirmYes(text: string): boolean {
  const t = text.trim()
  if (!t || t.length > 20) return false
  if (CONFIRM_YES_EXACT.has(t)) return true
  return CONFIRM_YES_STARTS.some(w => t.startsWith(w) || t === w)
}
function isConfirmNo(text: string): boolean {
  const t = text.trim()
  if (!t || t.length > 25) return false
  if (CONFIRM_NO_EXACT.has(t)) return true
  return CONFIRM_NO_STARTS.some(w => t.startsWith(w) || t.includes(w))
}
// ─── Interrupt Phrase検出（deterministic固定語彙・LLM不使用）────
const INTERRUPT_WORDS = /^(やめ(て|ろ)?|止め(て|ろ)?|止まって|中止|キャンセル|待って|ストップ|stop|cancel|もういい|一旦止めて?)$/i
function isInterruptPhrase(text: string): boolean {
  const t = text.trim()
  if (!t || t.length > 20) return false
  return INTERRUPT_WORDS.test(t)
}

const STANDBY_MS         = 60_000
const SESSION_TIMEOUT_MS = 5 * 60_000

// ─── Voice Settings localStorage ─────────────────────────────
const LS_KEY = 'hikaru_console_voice_settings'

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  voiceURI: '',
  rate:     1.0,
  pitch:    1.0,
  volume:   1.0,
}

function loadVoiceSettings(): VoiceSettings {
  if (typeof window === 'undefined') return DEFAULT_VOICE_SETTINGS
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return DEFAULT_VOICE_SETTINGS
    return { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(raw) }
  } catch { return DEFAULT_VOICE_SETTINGS }
}

function saveVoiceSettings(s: VoiceSettings): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)) } catch {}
}

// ─── Context型 ───────────────────────────────────────────────
export interface ConsoleVoiceContextValue {
  mode:               VoiceMode
  isSession:          boolean
  isStandby:          boolean
  transcript:         string
  response:           string
  errorMessage:       string
  messages:           ConsoleChatMessage[]
  voiceSettings:      VoiceSettings
  setVoiceSettings:   (s: VoiceSettings) => void
  isSpeechSupported:  boolean
  voiceEngineMode:    VoiceEngineMode
  connectRealtime:    () => void
  disconnectRealtime: () => void
  startListening:     () => void
  stopAll:            () => void
  startSession:       () => void
  stopSession:        () => void
  handleUtterance:    (text: string) => Promise<void>
  interrupt:          () => void
}

const ConsoleVoiceContext = React.createContext<ConsoleVoiceContextValue | null>(null)

// ─── L1 CONSOLE データ取得 ────────────────────────────────────
interface L1Result { text: string; data: LastResultData }

async function fetchConsoleL1Result(action: ConsoleActionName): Promise<L1Result> {
  const none = (text: string): L1Result => ({ text, data: { type: 'none' } })
  try {
    switch (action) {
      case 'console.get_notifications': {
        const res = await fetch('/api/console-notifications', { credentials: 'include' })
        if (!res.ok) return none('通知を取得できませんでした。')
        const data = await res.json()
        const list  = data.notifications ?? []
        const unread = data.unread_count ?? list.filter((n: { is_read: boolean }) => !n.is_read).length
        return none(unread === 0 ? '未読の通知はありません。' : `未読の通知が${unread}件あります。読み上げますか？`)
      }
      case 'console.get_pending_requests': {
        const res = await fetch('/api/project-requests?status=pending&count=true', { credentials: 'include' })
        if (!res.ok) return none('案件依頼を確認できませんでした。')
        const data = await res.json()
        const count = data.count ?? (data.data?.length ?? 0)
        return none(count === 0 ? '未対応の案件依頼はありません。' : `未対応の案件依頼が${count}件あります。確認しますか？`)
      }
      case 'console.get_pending_expenses': {
        const res = await fetch('/api/expenses?status=submitted', { credentials: 'include' })
        if (!res.ok) return none('経費申請を確認できませんでした。')
        const data = await res.json()
        // API: { expenses: [...], kpi: {...} }
        const items = Array.isArray(data?.expenses) ? data.expenses : []
        return none(items.length === 0 ? '承認待ちの経費申請はありません。' : `承認待ちの経費申請が${items.length}件あります。承認しますか？`)
      }
      case 'console.get_pending_attendance': {
        const res = await fetch('/api/attendance/corrections?status=pending', { credentials: 'include' })
        if (!res.ok) return none('勤怠修正申請を確認できませんでした。')
        const data = await res.json()
        // API: { corrections: [...] }
        const items = Array.isArray(data?.corrections) ? data.corrections : []
        return none(items.length === 0 ? '承認待ちの勤怠修正申請はありません。' : `承認待ちの勤怠修正申請が${items.length}件あります。`)
      }
      case 'console.get_expense_detail': {
        return none('経費詳細を確認するには、まず「承認待ちの経費教えて」で一覧を取得してください。')
      }
      case 'console.get_project_detail': {
        return none('案件詳細を確認するには、まず「案件一覧教えて」で一覧を取得してください。')
      }
      case 'console.get_project_assignments': {
        return none('担当者を確認するには、まず「案件一覧教えて」で案件を選択してください。')
      }
      case 'console.get_revenue': {
        const res = await fetch('/api/dashboard', { credentials: 'include' })
        if (!res.ok) return none('売上情報を取得できませんでした。')
        const data = await res.json()
        const rev = data?.revenue
        if (!rev || typeof rev !== 'object') return none('現在HIKARUに登録されている情報からは売上を確認できません。')
        // API: revenue.this_month/this_year = 税込合計、unpaid = 請求済未入金、unbilled = 未請求
        const fmt = (n: number): string => `${Math.round(n).toLocaleString('ja-JP')}円`
        const parts: string[] = []
        if (rev.this_month != null) parts.push(`今月の売上: ${fmt(rev.this_month)}`)
        if (rev.this_year  != null) parts.push(`今年の売上: ${fmt(rev.this_year)}`)
        if (rev.unpaid     != null) parts.push(`未入金: ${fmt(rev.unpaid)}`)
        if (rev.unbilled   != null) parts.push(`未請求: ${fmt(rev.unbilled)}`)
        return none(parts.length > 0
          ? `売上情報 — ${parts.join('、')}`
          : '売上情報を確認できませんでした。')
      }
      case 'console.get_dashboard':
        return none('ダッシュボードに最新情報を表示します。')
      default:
        return none('')
    }
  } catch {
    return none('データの取得中にエラーが発生しました。')
  }
}

// ─── L2 CONSOLE ナビゲーション（Browser STT経路）───────────────
// console.actions の ConsoleActionName → console.navigation の共通マッピングへ委譲。
// Realtime経路の navigate_to と同じallowlistを使用し、Navigation定義の二重管理を防ぐ。
function executeConsoleL2Navigation(
  action: ConsoleActionName,
  router: ReturnType<typeof useRouter>
): string {
  const ACTION_TO_DESTINATION: Partial<Record<ConsoleActionName, string>> = {
    'console.go_dashboard':          'dashboard',
    'console.go_back':               'back',
    'console.open_projects':         'projects',
    'console.open_project_requests': 'project_requests',
    'console.open_clients':          'clients',
    'console.open_employees':        'employees',
    'console.open_partners':         'partners',
    'console.open_shifts':           'shifts',
    'console.open_attendance':       'attendance',
    'console.open_expenses':         'expenses',
    'console.open_invoices':         'invoices',
    'console.open_notifications':    'notifications',
    'console.open_quality':          'quality',
    'console.open_manuals':          'manuals',
    'console.open_reports':          'reports',
    'console.open_analytics':        'analytics',
    'console.open_inventory':        'inventory',
    'console.open_contracts':        'contracts',
    'console.open_settings':         'settings',
  }
  const destination = ACTION_TO_DESTINATION[action]
  if (!destination) return ''
  return executeConsoleNavigation(destination, router)
}

// ─── Provider ────────────────────────────────────────────────
export function ConsoleVoiceProvider({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()

  const [mode,            setMode]             = React.useState<VoiceMode>('idle')
  const [transcript,      setTranscript]       = React.useState('')
  const [response,        setResponse]         = React.useState('')
  const [errorMessage,    setErrorMessage]     = React.useState('')
  const [messages,        setMessages]         = React.useState<ConsoleChatMessage[]>([])
  const [isSession,       setIsSession]        = React.useState(false)
  const [isStandby,       setIsStandby]        = React.useState(false)
  const [voiceSettings,   setVoiceSettingsSt]  = React.useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS)
  const [voiceEngineMode, setVoiceEngineMode]  = React.useState<VoiceEngineMode>('off')

  React.useEffect(() => { setVoiceSettingsSt(loadVoiceSettings()) }, [])

  const setVoiceSettings = React.useCallback((s: VoiceSettings) => {
    setVoiceSettingsSt(s)
    saveVoiceSettings(s)
  }, [])

  const recognitionRef     = React.useRef<SpeechRecognitionInstance | null>(null)
  const modeRef            = React.useRef<VoiceMode>('idle')
  const isSessionRef       = React.useRef(false)
  const standbyTimerRef    = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const sessionTimerRef    = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const startListeningRef  = React.useRef<() => void>(() => {})
  const connectRealtimeRef = React.useRef<() => void>(() => {})
  const resumeTimerRef     = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const conversationCtxRef = React.useRef<ConversationContext>({})
  const messagesRef        = React.useRef<ConsoleChatMessage[]>([])
  const voiceSettingsRef   = React.useRef<VoiceSettings>(DEFAULT_VOICE_SETTINGS)
  const pathnameRef        = React.useRef(pathname)
  const realtimeSessionRef  = React.useRef<any>(null)
  const voiceEngineModeRef  = React.useRef<VoiceEngineMode>('off')
  const isSpeakingRef       = React.useRef(false)
  const turnIdRef           = React.useRef(0)
  const lastRtResponseText  = React.useRef('')
  const lastRtResponseTime  = React.useRef(0)

  React.useEffect(() => { voiceSettingsRef.current = voiceSettings },    [voiceSettings])
  React.useEffect(() => { pathnameRef.current      = pathname },         [pathname])
  React.useEffect(() => { voiceEngineModeRef.current = voiceEngineMode }, [voiceEngineMode])

  const isSpeechSupported = React.useMemo(() => {
    if (typeof window === 'undefined') return false
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  }, [])

  const setModeSync = React.useCallback((m: VoiceMode) => {
    modeRef.current = m
    setMode(m)
  }, [])

  const muteMic = React.useCallback((mute: boolean) => {
    try { (realtimeSessionRef.current as any)?.mute?.(mute) } catch {}
  }, [])

  const interrupt = React.useCallback(() => {
    if (resumeTimerRef.current) { clearTimeout(resumeTimerRef.current); resumeTimerRef.current = null }
    try { (realtimeSessionRef.current as any)?.interrupt?.() } catch {}
    isSpeakingRef.current = false
    muteMic(false)
    turnIdRef.current++
    setModeSync('listening')
  }, [muteMic, setModeSync])

  const clearActivityTimers = React.useCallback(() => {
    if (standbyTimerRef.current)  clearTimeout(standbyTimerRef.current)
    if (sessionTimerRef.current)  clearTimeout(sessionTimerRef.current)
  }, [])

  const scheduleStandby = React.useCallback(() => {
    clearActivityTimers()
    if (!isSessionRef.current) return
    setIsStandby(false)
    standbyTimerRef.current = setTimeout(() => {
      if (!isSessionRef.current) return
      setIsStandby(true)
      sessionTimerRef.current = setTimeout(() => {
        if (!isSessionRef.current) return
        isSessionRef.current = false
        setIsSession(false)
        setIsStandby(false)
        browserTTS.stop()
        recognitionRef.current?.abort()
        modeRef.current = 'idle'
        setMode('idle')
      }, SESSION_TIMEOUT_MS)
    }, STANDBY_MS)
  }, [clearActivityTimers])

  const addMessage = React.useCallback((role: 'user' | 'assistant', text: string) => {
    setMessages(prev => {
      const next = [...prev.slice(-19), { role, text, timestamp: Date.now() }]
      messagesRef.current = next
      return next
    })
  }, [])

  const speakAndMaybeResume = React.useCallback((text: string) => {
    modeRef.current = 'speaking'
    setMode('speaking')
    browserTTS.speak(text, () => {
      if (isSessionRef.current) {
        setTimeout(() => { if (isSessionRef.current) startListeningRef.current() }, 400)
      } else {
        modeRef.current = 'idle'
        setMode('idle')
      }
    }, voiceSettingsRef.current)
  }, [])

  const stopAll = React.useCallback(() => {
    clearActivityTimers()
    if (resumeTimerRef.current) { clearTimeout(resumeTimerRef.current); resumeTimerRef.current = null }
    isSessionRef.current = false
    isSpeakingRef.current = false
    setIsSession(false)
    setIsStandby(false)
    recognitionRef.current?.abort()
    browserTTS.stop()
    setModeSync('idle')
    setErrorMessage('')
    try { realtimeSessionRef.current?.close?.() }      catch {}
    try { realtimeSessionRef.current?.disconnect?.() } catch {}
    realtimeSessionRef.current = null
    setVoiceEngineMode('off')
    voiceEngineModeRef.current = 'off'
  }, [clearActivityTimers, setModeSync])

  const stopSession = React.useCallback(() => {
    clearActivityTimers()
    if (resumeTimerRef.current) { clearTimeout(resumeTimerRef.current); resumeTimerRef.current = null }
    isSessionRef.current = false
    isSpeakingRef.current = false
    setIsSession(false)
    setIsStandby(false)
    recognitionRef.current?.abort()
    browserTTS.stop()
    setModeSync('idle')
    setErrorMessage('')
    try { realtimeSessionRef.current?.close?.() }      catch {}
    try { realtimeSessionRef.current?.disconnect?.() } catch {}
    realtimeSessionRef.current = null
    setVoiceEngineMode('off')
    voiceEngineModeRef.current = 'off'
  }, [clearActivityTimers, setModeSync])

  const finishWithError = React.useCallback((msg: string) => {
    setErrorMessage(msg)
    setModeSync('error')
    setTimeout(() => {
      setModeSync('idle')
      setErrorMessage('')
      if (isSessionRef.current) {
        setTimeout(() => { if (isSessionRef.current) startListeningRef.current() }, 800)
      }
    }, 3500)
  }, [setModeSync])

  const executeAction = React.useCallback(async (result: IntentResult) => {
    const { action, confidence, voiceReply } = result

    if (!action || confidence < 0.6) {
      const msg = '発話の意図を理解できませんでした。もう一度お話しください。'
      setResponse(msg)
      addMessage('assistant', msg)
      speakAndMaybeResume(msg)
      return
    }

    const isNavAction = action.startsWith('console.open_') || action === 'console.go_dashboard' || action === 'console.go_back'

    if (isNavAction) {
      const navReply = executeConsoleL2Navigation(action, router)
      const reply    = voiceReply ?? navReply
      setResponse(reply)
      addMessage('assistant', reply)
      conversationCtxRef.current = {
        lastIntent:    action,
        lastAction:    action,
        lastResultData: conversationCtxRef.current.lastResultData,
      }
      speakAndMaybeResume(reply)
      return
    }

    const l1    = await fetchConsoleL1Result(action)
    const reply = voiceReply ?? l1.text
    setResponse(reply)
    addMessage('assistant', reply)
    conversationCtxRef.current = { lastIntent: action, lastAction: action, lastResultData: l1.data }
    speakAndMaybeResume(reply)
  }, [router, addMessage, speakAndMaybeResume])

  // ─── Confirmed Action 実行 ───────────────────────────────────
  const executeConfirmedAction = React.useCallback(async (pending: PendingConfirmation) => {
    setModeSync('processing')
    try {
      const res = await fetch('/api/ai/confirm-action', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({
          action:      pending.action,
          params:      pending.params,
          safetyLevel: pending.safetyLevel,
          expiresAt:   pending.expiresAt,
        }),
      })
      const data  = await res.json()
      const reply = res.ok
        ? (data.voiceReply ?? '完了しました。')
        : (data.error     ?? '実行に失敗しました。')
      setResponse(reply)
      addMessage('assistant', reply)
      conversationCtxRef.current = {
        ...conversationCtxRef.current,
        lastIntent:          pending.action,
        lastAction:          pending.action,
        pendingConfirmation: undefined,
      }
      speakAndMaybeResume(reply)
    } catch {
      finishWithError('実行中にエラーが発生しました。')
    }
  }, [addMessage, speakAndMaybeResume, finishWithError, setModeSync])

  const handleUtterance = React.useCallback(async (utterance: string) => {
    // ─── 期限切れ pendingConfirmation の自動クリア ───────────────
    const expiredPending = conversationCtxRef.current.pendingConfirmation
    if (expiredPending && Date.now() > expiredPending.expiresAt) {
      conversationCtxRef.current = { ...conversationCtxRef.current, pendingConfirmation: undefined }
      if (isConfirmYes(utterance.trim()) || isConfirmNo(utterance.trim())) {
        const msg = '確認の有効期限が切れました。もう一度操作してください。'
        setResponse(msg); addMessage('user', utterance); addMessage('assistant', msg)
        speakAndMaybeResume(msg)
        return
      }
    }

    if (isSessionRef.current && SESSION_STOP_RE.test(utterance.trim())) {
      addMessage('user', utterance)
      addMessage('assistant', '会話を終了します')
      isSessionRef.current = false
      setIsSession(false)
      clearActivityTimers()
      setIsStandby(false)
      speakAndMaybeResume('会話を終了します')
      return
    }

    // ─── Confirmation 待ち中の「はい/いいえ」処理 ─────────────
    const pending = conversationCtxRef.current.pendingConfirmation
    if (pending) {
      scheduleStandby()
      setIsStandby(false)
      setTranscript(utterance)
      addMessage('user', utterance)
      if (isConfirmYes(utterance.trim())) {
        await executeConfirmedAction(pending)
        return
      }
      if (isConfirmNo(utterance.trim())) {
        conversationCtxRef.current = { ...conversationCtxRef.current, pendingConfirmation: undefined }
        const msg = 'キャンセルしました。'
        setResponse(msg)
        addMessage('assistant', msg)
        speakAndMaybeResume(msg)
        return
      }
      conversationCtxRef.current = { ...conversationCtxRef.current, pendingConfirmation: undefined }
    }

    scheduleStandby()
    setIsStandby(false)
    setTranscript(utterance)
    addMessage('user', utterance)
    setModeSync('processing')

    const recentMessages = messagesRef.current.slice(-6).map(m => ({ role: m.role, content: m.text }))

    try {
      const requestBody = {
        utterance,
        currentPath:         pathnameRef.current,
        recentMessages,
        lastIntent:          conversationCtxRef.current.lastIntent,
        lastResultData:      conversationCtxRef.current.lastResultData,
        previousResponseId:  conversationCtxRef.current.previousResponseId,
      }

      // SDK経路（Agents SDK + Responses API）を優先、失敗時fallback
      let result: Record<string, unknown> | null = null
      let usedSdkRoute = false

      try {
        const sdkRes = await fetch('/api/ai/console-agent-sdk', {
          method:      'POST',
          headers:     { 'Content-Type': 'application/json' },
          credentials: 'include',
          body:        JSON.stringify(requestBody),
        })
        if (sdkRes.ok) { result = await sdkRes.json(); usedSdkRoute = true }
      } catch {}

      if (!result || (result as any).error) {
        const fallbackRes = await fetch('/api/ai/console-agent', {
          method:      'POST',
          headers:     { 'Content-Type': 'application/json' },
          credentials: 'include',
          body:        JSON.stringify(requestBody),
        })
        if (!fallbackRes.ok) { finishWithError('音声アシスタントへの接続に失敗しました。'); return }
        result = await fallbackRes.json()
      }

      if (!result) { finishWithError('音声アシスタントへの接続に失敗しました。'); return }

      conversationCtxRef.current = {
        ...conversationCtxRef.current,
        ...(result.resultData ? { lastResultData: result.resultData as any } : {}),
        ...(usedSdkRoute && result.previousResponseId
          ? { previousResponseId: result.previousResponseId as string }
          : {}),
        ...(result.pendingConfirmation
          ? { pendingConfirmation: result.pendingConfirmation as PendingConfirmation }
          : {}),
      }

      if (result.pendingConfirmation && result.voiceReply) {
        const confirmMsg = result.voiceReply as string
        setResponse(confirmMsg)
        addMessage('assistant', confirmMsg)
        speakAndMaybeResume(confirmMsg)
        return
      }

      if (!result.action && result.voiceReply) {
        setResponse(result.voiceReply as string)
        addMessage('assistant', result.voiceReply as string)
        conversationCtxRef.current = {
          ...conversationCtxRef.current,
          lastIntent: 'agent.response',
          lastAction: undefined,
        }
        speakAndMaybeResume(result.voiceReply as string)
        return
      }

      await executeAction(result as any)
    } catch {
      finishWithError('音声アシスタントへの接続に失敗しました。')
    }
  }, [executeAction, finishWithError, addMessage, speakAndMaybeResume, clearActivityTimers, scheduleStandby, setModeSync])

  // ─── CONSOLE Realtime接続 (Worker準拠 @openai/agents-realtime v0.17) ──
  const connectRealtime = React.useCallback(async () => {
    if (realtimeSessionRef.current) return
    if (voiceEngineModeRef.current === 'realtime-connecting') return

    setVoiceEngineMode('realtime-connecting')
    voiceEngineModeRef.current = 'realtime-connecting'

    try {
      const tokenRes = await fetch('/api/ai/console-realtime-token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ model: RT_MODEL }),
      })
      if (!tokenRes.ok) {
        const errBody = await tokenRes.text().catch(() => '')
        throw new Error(`token_failed:${tokenRes.status} ${errBody}`)
      }
      const tokenData  = await tokenRes.json()
      const clientSecret: string | null = tokenData.clientSecret ?? null
      if (!clientSecret) throw new Error('no_token: clientSecret missing')

      // tool: toolFactory でSDK正式FunctionTool生成（plain objectではSDKのtype==='function'フィルタを通らない）
      const { RealtimeAgent, RealtimeSession, tool: toolFactory } = await import('@openai/agents/realtime') as any
      const tools   = buildConsoleRealtimeTools(router, toolFactory)
      const agent   = new RealtimeAgent({ name: 'JARVIS Console Realtime', instructions: RT_SYSTEM_PROMPT, tools })
      // transport: 'webrtc' を明示。
      // interruptResponse: false = VADが音を検知しても進行中responseをcancelしない。
      // JARVIS発話中の周囲音・雑音によるBarge-inをサーバー側で根本防止。
      // Listening中はcurrent responseが存在しないためVAD turn detectionは通常通り動作する。
      const session = new RealtimeSession(agent, {
        transport: 'webrtc',
        model:     RT_MODEL,
        config:    {
          audio: { input: { turnDetection: { type: 'semantic_vad', eagerness: 'high', interruptResponse: false } } },
        },
      } as any)

      // ── v0.17 正式イベント ──────────────────────────────────────
      // v0.15以前の connected/agent_start_speech 等はv0.17に存在しない。
      // WebRTC modeでは audio_start / audio_interrupted は発火しない (WebSocket専用)。
      // audio_stopped は response.output_audio.done → DataChannel経由で発火する。
      // mic mute: agent_start → muteMic(true)、audio_stopped → muteMic(false) が正規経路。
      // agent_endでのunmuteは禁止: tool-only responseのagent_endでMicを開くと
      // 次のaudio responseのagent_start前に窓が生じてbarge-inが発生する。
      session.on?.('agent_start', () => {
        if (voiceEngineModeRef.current !== 'realtime') return
        muteMic(true)
        if (modeRef.current === 'listening' || modeRef.current === 'idle') setModeSync('processing')
      })
      // audio_start: WebRTC modeでは発火しないがWebSocket fallback用に残す。
      session.on?.('audio_start', () => {
        if (voiceEngineModeRef.current !== 'realtime') return
        isSpeakingRef.current = true
        if (resumeTimerRef.current) { clearTimeout(resumeTimerRef.current); resumeTimerRef.current = null }
        setModeSync('speaking')
      })
      session.on?.('audio_stopped', () => {
        if (voiceEngineModeRef.current !== 'realtime') return
        isSpeakingRef.current = false
        // Root Cause Fix: DO NOT unmute immediately after audio_stopped.
        // Mic was previously opened before the 300ms timer fired, giving the
        // server VAD a window to capture speaker echo and generate phantom turns.
        // Fix: keep mic muted until after the echo cooldown, then unmute + set listening atomically.
        setModeSync('processing')
        if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
        resumeTimerRef.current = setTimeout(() => {
          if (voiceEngineModeRef.current !== 'realtime') return
          if (modeRef.current !== 'processing') return
          muteMic(false)
          setModeSync('listening')
        }, 700)
      })
      session.on?.('agent_end', (_ctx: unknown, _agent: unknown, output: string) => {
        // agent_endでunmuteしない: audio_stoppedを唯一の正規unmute経路とする。
        // tool-only responseのagent_end→次audio responseのagent_startの窓でbarge-inが発生するため。
        const text = (output ?? '').trim()
        if (!text) return
        // 時間ベースdedup: 同一テキストが3秒以内に再度来た場合はphantom turnの重複とみなす。
        // 直前メッセージがuserの場合でもブロックできるよう、refs単体で管理する。
        const now = Date.now()
        if (text === lastRtResponseText.current && now - lastRtResponseTime.current < 3000) return
        lastRtResponseText.current = text
        lastRtResponseTime.current = now
        setResponse(text)
        addMessage('assistant', text)
      })
      session.on?.('agent_tool_start', () => {
        if (voiceEngineModeRef.current !== 'realtime') return
        muteMic(true)
        setModeSync('working')
      })
      session.on?.('agent_tool_end', () => {
        if (voiceEngineModeRef.current !== 'realtime') return
        setModeSync('processing')
      })
      // audio_interrupted: WebRTC modeでは発火しない (WebSocket専用)。safety unmute。
      session.on?.('audio_interrupted', () => {
        if (voiceEngineModeRef.current !== 'realtime') return
        isSpeakingRef.current = false
        muteMic(false)
        if (resumeTimerRef.current) { clearTimeout(resumeTimerRef.current); resumeTimerRef.current = null }
        setModeSync('listening')
      })
      session.on?.('transport_event', (event: any) => {
        if (event?.type !== 'conversation.item.input_audio_transcription.completed') return
        const text = (event.transcript ?? '').trim()
        if (!text || voiceEngineModeRef.current !== 'realtime') return
        setTranscript(text)
        const m = modeRef.current
        const isBusy = m === 'processing' || m === 'working' || m === 'speaking'
        if (isBusy && !isInterruptPhrase(text)) return
        addMessage('user', text)
      })
      session.on?.('error', (err: unknown) => {
        const msg = (err as any)?.error?.message ?? (err as Error)?.message ?? String(err)
        console.error('[console-realtime] session error (non-fatal):', msg)
        // エラー時はmuteを解除してListening継続を試みる。
        muteMic(false)
      })

      // 予期せぬ切断時の自動Reconnect（1回）
      const transport = session.transport as any
      transport?.on?.('connection_change', (status: any) => {
        if (status !== 'disconnected') return
        if (!isSessionRef.current) return
        if (voiceEngineModeRef.current !== 'realtime') return
        console.warn('[console-realtime] connection dropped, reconnecting in 1.5s')
        realtimeSessionRef.current = null
        if (resumeTimerRef.current) { clearTimeout(resumeTimerRef.current); resumeTimerRef.current = null }
        setVoiceEngineMode('off')
        voiceEngineModeRef.current = 'off'
        setModeSync('processing')
        setTimeout(() => {
          if (!isSessionRef.current) return
          if (voiceEngineModeRef.current !== 'off') return
          connectRealtimeRef.current()
        }, 1500)
      })

      // connect()解決 = WebRTC確立。イベント待ちせず即座にrealtime状態をセット（Worker方式）。
      await session.connect({ apiKey: clientSecret } as any)
      realtimeSessionRef.current = session
      setVoiceEngineMode('realtime')
      voiceEngineModeRef.current = 'realtime'
      setModeSync('listening')

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[console-realtime] failed:', msg)
      realtimeSessionRef.current = null
      if (resumeTimerRef.current) { clearTimeout(resumeTimerRef.current); resumeTimerRef.current = null }
      setVoiceEngineMode('off')
      voiceEngineModeRef.current = 'off'
      // Session状態リセット（UI整合性: 「会話中」+「VOICE ENGINE OFF」矛盾を防ぐ）
      isSessionRef.current = false
      setIsSession(false)
      setIsStandby(false)
      // ユーザーへの具体的エラー表示
      const uiMsg = (msg.includes('not-allowed') || msg.includes('NotAllowedError'))
        ? 'マイクへのアクセスを許可してください。ブラウザの設定を確認してください。'
        : msg.includes('token_failed') || msg.includes('no_token')
        ? `Voice接続の準備に失敗しました。(${msg.slice(0, 80)})`
        : msg.includes('ephemeral client key')
        ? 'Voice接続の認証に失敗しました。ページを更新してください。'
        : `Voice Engine接続エラー: ${msg.slice(0, 100)}`
      setErrorMessage(uiMsg)
      setModeSync('error')
      setTimeout(() => {
        if (modeRef.current === 'error') { setModeSync('idle'); setErrorMessage('') }
      }, 6000)
    }
  }, [router, addMessage, setModeSync, muteMic, setIsSession, setIsStandby, setErrorMessage])

  const disconnectRealtime = React.useCallback(() => {
    if (resumeTimerRef.current) { clearTimeout(resumeTimerRef.current); resumeTimerRef.current = null }
    try { realtimeSessionRef.current?.close?.() }      catch {}
    try { realtimeSessionRef.current?.disconnect?.() } catch {}
    realtimeSessionRef.current = null
    setVoiceEngineMode('off'); voiceEngineModeRef.current = 'off'
  }, [])

  const startListening = React.useCallback(() => {
    if (voiceEngineModeRef.current === 'realtime' || voiceEngineModeRef.current === 'realtime-connecting') return
    if (!isSpeechSupported) { finishWithError('このブラウザでは音声入力を利用できません。'); return }
    if (modeRef.current === 'speaking') { browserTTS.stop(); setModeSync('idle'); return }
    if (modeRef.current === 'processing') return

    setErrorMessage('')
    setTranscript('')
    setModeSync('listening')

    const SpeechRec = ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) as new () => SpeechRecognitionInstance
    const rec = new SpeechRec()
    rec.lang = 'ja-JP'; rec.continuous = false; rec.interimResults = false; rec.maxAlternatives = 1
    recognitionRef.current = rec

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const text = e.results[0]?.[0]?.transcript ?? ''
      if (!text.trim()) { finishWithError('音声を認識できませんでした。'); return }
      handleUtterance(text.trim())
    }
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'not-allowed' || e.error === 'permission-denied') {
        finishWithError('マイクの使用を許可してください。')
      } else if (e.error === 'no-speech') {
        if (isSessionRef.current) {
          setModeSync('idle')
          setTimeout(() => { if (isSessionRef.current) startListeningRef.current() }, 300)
        } else {
          finishWithError('音声が検出されませんでした。')
        }
      } else if (e.error === 'aborted') {
        if (isSessionRef.current) {
          setModeSync('idle')
          setTimeout(() => { if (isSessionRef.current) startListeningRef.current() }, 500)
        } else {
          setModeSync('idle')
        }
      } else {
        if (isSessionRef.current) {
          setModeSync('idle')
          setTimeout(() => { if (isSessionRef.current) startListeningRef.current() }, 800)
        } else {
          finishWithError('音声認識でエラーが発生しました。')
        }
      }
    }
    rec.onend = () => {
      if (modeRef.current === 'listening') {
        if (isSessionRef.current) {
          setModeSync('idle')
          setTimeout(() => { if (isSessionRef.current) startListeningRef.current() }, 300)
        } else {
          setModeSync('idle')
        }
      }
    }
    try { rec.start() } catch { finishWithError('マイクを起動できませんでした。') }
  }, [isSpeechSupported, handleUtterance, finishWithError, setModeSync])

  React.useEffect(() => { startListeningRef.current  = startListening  }, [startListening])
  React.useEffect(() => { connectRealtimeRef.current = connectRealtime }, [connectRealtime])

  const startSession = React.useCallback(() => {
    isSessionRef.current = true
    setIsSession(true)
    setIsStandby(false)
    scheduleStandby()
    // Realtime優先。失敗時はBrowser STTへ自動fallback。
    connectRealtime()
  }, [scheduleStandby, connectRealtime])

  // ─── Phase P5: ページ遷移後の自然な次Action提案 ──────────────
  const prevPathRef = React.useRef(pathname)
  React.useEffect(() => {
    const prev = prevPathRef.current
    prevPathRef.current = pathname
    if (!isSessionRef.current) return
    if (prev === pathname) return

    const lastAction = conversationCtxRef.current.lastAction ?? ''

    // 案件依頼ページへ遷移
    if (pathname === '/project-requests' && lastAction === 'console.open_project_requests') {
      setTimeout(() => {
        if (!isSessionRef.current) return
        const msg = '案件依頼一覧を開きました。未対応の依頼を確認しますか？'
        addMessage('assistant', msg)
        setResponse(msg)
        speakAndMaybeResume(msg)
      }, 900)
      return
    }

    // 経費ページへ遷移
    if (pathname === '/expenses' && lastAction === 'console.open_expenses') {
      setTimeout(() => {
        if (!isSessionRef.current) return
        const msg = '経費管理を開きました。承認待ちの経費申請がある場合はご確認ください。'
        addMessage('assistant', msg)
        setResponse(msg)
        speakAndMaybeResume(msg)
      }, 900)
      return
    }
  }, [pathname, addMessage, speakAndMaybeResume])

  // ─── ページ遷移後の音声認識フェイルセーフ復旧 ──────────────────
  React.useEffect(() => {
    if (!isSessionRef.current) return
    const timer = setTimeout(() => {
      if (isSessionRef.current && modeRef.current === 'idle') {
        startListeningRef.current()
      }
    }, 700)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Logout クリーンアップ
  React.useEffect(() => {
    const handleLogout = () => {
      stopAll()
      setMessages([])
      messagesRef.current = []
      conversationCtxRef.current = {}
    }
    window.addEventListener('hikaru:logout', handleLogout)
    return () => window.removeEventListener('hikaru:logout', handleLogout)
  }, [stopAll])

  const value = React.useMemo<ConsoleVoiceContextValue>(() => ({
    mode, isSession, isStandby, transcript, response, errorMessage, messages,
    voiceSettings, setVoiceSettings, isSpeechSupported,
    voiceEngineMode, connectRealtime, disconnectRealtime,
    startListening, stopAll, startSession, stopSession, handleUtterance,
    interrupt,
  }), [
    mode, isSession, isStandby, transcript, response, errorMessage, messages,
    voiceSettings, setVoiceSettings, isSpeechSupported,
    voiceEngineMode, connectRealtime, disconnectRealtime,
    startListening, stopAll, startSession, stopSession, handleUtterance,
    interrupt,
  ])

  return (
    <ConsoleVoiceContext.Provider value={value}>
      {children}
    </ConsoleVoiceContext.Provider>
  )
}

// ─── Consumer hook ────────────────────────────────────────────
export function useConsoleJarvis(): ConsoleVoiceContextValue {
  const ctx = React.useContext(ConsoleVoiceContext)
  if (!ctx) throw new Error('useConsoleJarvis must be used within ConsoleVoiceProvider')
  return ctx
}
