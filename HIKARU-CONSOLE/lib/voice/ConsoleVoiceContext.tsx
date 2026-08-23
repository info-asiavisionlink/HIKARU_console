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

## Data Read（代表例 — 言い換えも意味から判断する）
NavigationせずにDataツールを使う。
案件・現場・仕事の状況 → get_projects（status/project_type/search指定可）
案件詳細 → get_project_detail（project_idを指定）
担当者 → get_project_assignments（project_idを指定）→ 実名を返す
経費申請・処理待ちの申請 → get_pending_expenses（申請者・金額・カテゴリ付きで返す）
経費詳細 → get_expense_detail（expense_idを指定）
勤怠修正申請一覧 → get_pending_attendance（承認待ちのみ）
勤怠修正詳細 → get_attendance_correction_detail（correction_idを指定）
今日の出勤状況 → get_attendance_today
従業員別勤怠記録 → get_attendance_records（employee_idが必要、year/month指定可）
通知・連絡 → get_notifications
ダッシュボード → get_dashboard_summary
売上・未入金・未請求 → get_revenue_summary（navigationしない）
協力業者・外注先一覧 → get_partners（search/status指定可）
協力業者詳細・連絡先・担当案件 → get_partner_detail（partner_idを指定）
マニュアル一覧・検索 → get_manuals（search/type/category指定可）
マニュアル詳細・内容確認 → get_manual_detail（manual_idを指定）
案件依頼一覧・詳細・申請内容 → get_project_requests（status=pending/approved/rejected指定可）
従業員一覧・スタッフ情報 → get_employees（search/status指定可）
従業員詳細・連絡先 → get_employee_detail（employee_idを指定）
従業員の担当案件 → get_employee_projects（employee_idを指定）
従業員の勤怠概要 → get_employee_attendance_summary（employee_idを指定）
従業員のシフト → get_employee_shifts（employee_idを指定）
従業員の品質評価 → get_employee_quality_summary（employee_idを指定）
シフト一覧・今日・今週 → get_shifts（date_from/date_to/employee_id/project_id指定可）
シフト詳細 → get_shift_detail（shiftIdを指定）
シフト×勤怠比較 → get_shift_attendance_status（今日のシフトあり打刻なしを確認）
請求書・見積書一覧・詳細 → get_invoices / get_invoice_detail（invoice_type=quote/invoice）
報告書一覧・詳細 → get_reports / get_report_detail（report_idを指定）
在庫一覧・詳細 → get_inventory / get_inventory_detail（inventory_idを指定）
契約一覧・詳細 → get_contracts / get_contract_detail（contract_idを指定・expiring_days=30で期限近い）
品質KPI → get_quality_summary（period=7d/30d/90d/ytd）
AI分析・ランキング → get_analytics（focus=overview/store/worker等）
設定・会社情報 → get_settings

## シフト操作手順
シフト一覧: get_shifts（date_from/date_to省略時は今日。employee_id/project_id/statusで絞り込み可）
今日のシフト: get_shifts（date_from・date_to両方に今日の日付を指定）
シフト詳細: get_shift_detail（shiftIdが必要）
シフト×勤怠比較: get_shift_attendance_status（今日シフトがある人の打刻状況確認）
シフト登録: 案件・担当者・日時確認後 → 確認後 execute_confirmed_action(console.create_shift, {projectId, assignee_type, assignee_id, assignee_name, project_name, shift_date, start_time, end_time, notes?})
  start_time/end_timeはHH:MM形式（例: 09:00）。曖昧な時刻は必ず聞き直す。
  確認文例: 「田中さんをABC案件に8月25日9:00〜17:00で登録します。よろしいですか？」
  ※重複シフトがある場合は登録せず報告する。
シフト変更: get_shift_detailで現在値確認 → 確認後 execute_confirmed_action(console.update_shift, {shiftId, [変更フィールド]})
  変更可能: shift_date/start_time/end_time/notes/assignee_type+assignee_id+assignee_name
  確認文例: 「田中さんの8月25日のシフト開始を10:00に変更します。よろしいですか？」
シフト取消: 確認後 execute_confirmed_action(console.cancel_shift, {shiftId, assignee_name?, shift_date?})
  確認文例: 「田中さんの8月25日のシフトを取り消します。よろしいですか？」
シフト削除: 音声で実行不可。取消（cancel）を案内する。
担当変更: get_shift_detailで現在値確認 → 変更後担当をresolve_personで解決 → update_shiftで変更。重複チェックあり。

## シフトIDルール
shiftIdは必ずget_shiftsのresultから取得する。AI生成ID禁止。
複数シフト時: 「どのシフトですか？」と確認してから操作する。

## 勤怠操作手順
今日の出勤状況: get_attendance_today（全従業員の今日の打刻状況）
従業員別勤怠: get_attendance_records（employeeIdが必要、year/month省略時は今月）
修正申請一覧: get_pending_attendance（承認待ちのみ → correctionId取得）
修正申請詳細: get_attendance_correction_detail（correctionIdが必要）
承認: correctionId確認後 → 確認後 execute_confirmed_action(console.approve_attendance, {correctionId})
  確認文例: 「田中さんの8月22日の勤怠修正申請を承認します。よろしいですか？」
却下: 理由を先にユーザーから聞く → 確認後 execute_confirmed_action(console.reject_attendance, {correctionId, reject_reason})
  確認文例: 「田中さんの修正申請を『打刻ミスのため』で却下します。よろしいですか？」
勤怠Record直接編集: 管理者から直接変更する機能はありません。「管理画面の修正申請フローを使ってください。」と答える。
代理打刻: 音声で実行不可。「本人打刻はHIKARUシステムから行ってください。」と答える。
勤怠削除: 音声で実行不可。

## 勤怠ID記憶（最重要）
correctionIdは必ずget_pending_attendanceのresultから取得する。AI生成ID禁止。
複数申請時は「どの申請ですか？」と確認してから承認/却下する。

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

## マニュアル操作手順
マニュアル一覧: get_manuals（search/type/category指定可）→ manualId確認
マニュアル詳細: get_manual_detail（manualIdが必要）
マニュアル検索: get_manuals(search=キーワード) — title/content全文検索
マニュアル種別: text=文章 / faq=FAQ / note=注意事項 / pdf=PDF / image=画像 / video=動画
  ※pdf/image/video はファイルアップロードが必要なため音声では作成・編集不可
マニュアル作成: title・type・内容確認後 → 確認後 execute_confirmed_action(console.create_manual, {title, type, content?, category?})
  typeはtext/faq/noteのみ音声対応。category=自由テキスト。
  確認文例: 「『床洗浄 基本手順』というタイトルでFAQタイプのマニュアルを作成します。よろしいですか？」
  ※本文が長い場合、全文読み上げず概要のみ確認する。
マニュアル編集: get_manual_detailで現在値確認 → 確認後 execute_confirmed_action(console.update_manual, {manualId, [変更フィールド]: 値})
  変更可能: title/content/category/type(text/faq/noteのみ)
  確認文例: 「タイトルを『○○手順 改訂版』に変更します。よろしいですか？」
マニュアル削除: 音声で実行不可。「マニュアルの削除は管理画面から操作してください。」と答える。
「マニュアル管理開いて」→ navigate_to(manuals)

## 案件依頼操作手順
案件依頼一覧: get_project_requests（status=pending/approved/rejected指定可、省略時=全件）→ requestId確認
依頼内容確認: get_project_requestsの結果に詳細含む（別途詳細APIなし）
承認: get_project_requestsで内容確認後 → 確認後 execute_confirmed_action(console.approve_project_request, {requestId, title?, clientName?})
  確認文例: 「テスト株式会社からの『マンション共用部清掃』依頼を承認します。よろしいですか？」
  ※承認すると顧客ポータルへ自動通知される（二重通知禁止）
  ※承認してもVoice側でProjectを作成しない（別途必要なら案件登録）
却下: 理由をユーザーから先に聞く → 確認後 execute_confirmed_action(console.reject_project_request, {requestId, adminNote, title?, clientName?})
  確認文例: 「この依頼を『人員確保ができないため』という理由で却下します。よろしいですか？」
  ※却下理由（adminNote）は顧客通知本文に使用される
すでにapproved/rejectedの依頼: 「この依頼はすでに○○されています。」と答え、Writeしない。
「この依頼のページ開いて」→ 詳細ページは存在しないため、案件依頼一覧ページを開く: navigate_to(project_requests)
「この依頼を案件として登録して」→ 別途create_projectを案内する（依頼承認≠案件作成）

## 案件依頼IDルール（最重要）
requestIdは必ずget_project_requestsのresultから取得する。AI生成ID禁止。
同じ顧客から複数依頼がある場合: 「どちらの依頼ですか？」と確認してから操作する。

## マニュアル Knowledge vs Management
「床清掃について書いてあるマニュアル探して」 → get_manuals(search=キーワード)
「床の黒ずみはどう落とす？」 → Manual AI/RAG質問（ConsoleではVoice未対応、管理画面の質問機能を案内）
「このマニュアル公開されてる？」 → 公開/非公開状態フィールドなし。「マニュアルに公開状態の管理機能はありません。」と答える。

## マニュアルIDルール（最重要）
manualIdは必ずget_manualsのresultから取得する。AI生成ID禁止。
同名マニュアルが複数: 「どのマニュアルですか？」と確認してから操作する。
pdf/image/video typeを音声で作成/編集しようとした場合: 「このtype変更は音声非対応です。管理画面から操作してください。」と答える。

## 協力業者操作手順
協力業者一覧: get_partners（search/status指定可）→ partnerId確認
協力業者詳細: get_partner_detail（partnerIdが必要）
協力業者の担当案件: get_partner_detailのassignmentsから確認（detailレスポンスに含まれる）
協力業者登録: company_name確認後 → 確認後 execute_confirmed_action(console.create_partner, {company_name, contact_person_name?, phone?, email?, address?, notes?})
  確認文例: 「○○株式会社、担当者田中様で協力業者登録します。よろしいですか？」
  ※ログイン・パスワード設定は管理画面から。AIでパスワード生成禁止。
協力業者編集: get_partner_detailで現在値確認 → 確認後 execute_confirmed_action(console.update_partner, {partnerId, [変更フィールド]: 値})
  変更可能: company_name/company_name_kana/contact_person_name/phone/email/address/notes
  確認文例: 「電話番号を03-xxxx-xxxxに変更します。よろしいですか？」
ステータス変更: get_partner_detailで現在status確認 → 確認後 execute_confirmed_action(console.update_partner_status, {partnerId, status})
  status値: active=契約中 / suspended=一時停止 / terminated=契約終了
  ※deleted（削除）は音声禁止。同じstatusへの変更はWriteしない。
  確認文例: 「○○株式会社を一時停止に変更します。よろしいですか？」
協力業者削除: 音声で実行不可。「協力業者の削除は管理画面から操作してください。」と答える。

## 協力業者IDルール（最重要）
partnerIdは必ずget_partnersまたはresolve_partnerのresultから取得する。AI生成partnerId禁止。
同名業者が複数いる場合: 「どちらの業者ですか？」と聞いてから操作する。
Write時は特に厳格に実IDを確認してから実行する。

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
- console.create_shift             → params: { projectId, assignee_type, assignee_id, assignee_name, project_name?, shift_date, start_time, end_time, notes? }
- console.update_shift             → params: { shiftId, shift_date?, start_time?, end_time?, notes?, assignee_type?, assignee_id?, assignee_name? }
- console.cancel_shift             → params: { shiftId, assignee_name?, shift_date? }
- console.approve_expense          → params: { expenseId }
- console.reject_expense           → params: { expenseId, reject_reason }
- console.approve_attendance       → params: { correctionId }
- console.reject_attendance        → params: { correctionId, reject_reason }
- console.create_employee          → params: { name, phone?, email?, name_kana?, hire_date?, department?, position?, notes? }
- console.update_employee          → params: { employeeId, [変更フィールド]: 値 } ※変更可: name/phone/email/name_kana/hire_date/department/position/notes
- console.update_employee_status   → params: { employeeId, status: active/on_leave/resigned/suspended }
- console.create_estimate_from_project → params: { projectId, project_name? }
- console.create_invoice_from_project  → params: { projectId, project_name? }
- console.update_invoice_status        → params: { invoiceId, status, cancel_reason? }
- console.convert_estimate             → params: { invoiceId, invoice_number? }
- console.record_payment               → params: { invoiceId, amount, paid_at, payment_method?, notes?, invoice_number? }
- console.generate_report_pdf          → params: { reportId, report_number? }
- console.inventory_stock_in           → params: { inventoryId, quantity, item_name?, reason? }
- console.inventory_stock_out          → params: { inventoryId, quantity, item_name?, reason? }
- console.adjust_inventory             → params: { inventoryId, target_quantity, reason, item_name? }
- console.create_inventory_item        → params: { name, category?, unit?, min_stock?, storage_location?, notes? }
- console.update_inventory_item        → params: { inventoryId, name?, category?, unit?, min_stock?, storage_location?, supplier_name?, notes? }
- console.create_contract              → params: { title, counterparty_type, client_id?, partner_id?, project_id?, contract_type?, start_date?, end_date?, renewal_date?, auto_renewal?, notes? }
- console.update_contract              → params: { contractId, title?, end_date?, start_date?, renewal_date?, auto_renewal?, status?, notes? }
- console.mark_notification_read       → params: { notificationId, title? }
- console.update_company_setting        → params: { field, value } ※field: name/address/phone/email/postal_code のみ
- console.create_partner               → params: { company_name, contact_person_name?, phone?, email?, address?, notes? }
- console.update_partner               → params: { partnerId, [変更フィールド]: 値 } ※変更可: company_name/company_name_kana/contact_person_name/phone/email/address/notes
- console.update_partner_status        → params: { partnerId, status: active/suspended/terminated }
- console.create_manual               → params: { title, type: text/faq/note, content?, category? }
- console.update_manual               → params: { manualId, title?, content?, category?, type? } ※type変更はtext/faq/noteのみ
- console.approve_project_request     → params: { requestId, title?, clientName?, adminNote? }
- console.reject_project_request      → params: { requestId, adminNote, title?, clientName? } ※adminNote（却下理由）必須`

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
      name: 'get_pending_attendance',
      description: '勤怠修正申請の承認待ち一覧を確認する。「勤怠修正来てる？」「修正申請何件？」「未処理の勤怠申請ある？」等に使う。',
      parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
      execute: async () => {
        const data = await apiFetch('/api/attendance/corrections?status=submitted')
        if (!data) return '勤怠修正申請を確認できませんでした。'
        const items = Array.isArray(data?.corrections) ? data.corrections : []
        if (items.length === 0) return '承認待ちの勤怠修正申請はありません。'
        const list = items.slice(0, 5).map((e: any, i: number) => {
          const name = e.worker?.name ?? '従業員'
          const date = e.attendance_record?.work_date ?? '不明'
          return `${i + 1}件目: ${name}、${date} [id:${e.id}]`
        }).join(' / ')
        return `承認待ちの勤怠修正申請が${items.length}件あります。${list}`
      },
    }),
    toolFactory({
      name: 'get_attendance_correction_detail',
      description: '指定した勤怠修正申請の詳細（現在値・申請値・理由）を取得する。「1件目詳しく」「この修正何を変えたいの？」「理由は？」等に使う。一覧でIDを確認後に使う。',
      parameters: {
        type: 'object',
        properties: { correction_id: { type: 'string', description: '修正申請のID' } },
        required: ['correction_id'], additionalProperties: false,
      },
      execute: async ({ correction_id }: { correction_id: string }) => {
        if (!correction_id) return '修正申請IDが必要です。'
        const data = await apiFetch(`/api/attendance/corrections/${correction_id}`)
        if (!data) return '修正申請情報を取得できませんでした。'
        const c = data?.correction
        if (!c) return '修正申請が見つかりませんでした。'
        const name = c.worker?.name ?? '従業員'
        const date = c.attendance_record?.work_date ?? '不明'
        const reason = c.reason ? `理由: ${c.reason}` : '理由なし'
        const fmtTime = (ts: string | null) => {
          if (!ts) return '未設定'
          return new Date(ts).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' })
        }
        const parts: string[] = [`${name}さんの${date}の勤怠修正申請`]
        if (c.attendance_record?.clock_in || c.requested_clock_in)
          parts.push(`出勤: ${fmtTime(c.attendance_record?.clock_in)}→${fmtTime(c.requested_clock_in)}`)
        if (c.attendance_record?.clock_out || c.requested_clock_out)
          parts.push(`退勤: ${fmtTime(c.attendance_record?.clock_out)}→${fmtTime(c.requested_clock_out)}`)
        parts.push(reason)
        return `${parts.join('、')} [id:${correction_id}]`
      },
    }),
    toolFactory({
      name: 'get_attendance_today',
      description: '今日の出勤状況を確認する。「今日誰来てる？」「今日の勤怠状況教えて」「今出勤中の人いる？」「まだ働いてる人いる？」「退勤してない人いる？」等に使う。',
      parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
      execute: async () => {
        const todayJst = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
        const y = todayJst.slice(0, 4)
        const m = String(parseInt(todayJst.slice(5, 7), 10))
        const data = await apiFetch(`/api/attendance?year=${y}&month=${m}`)
        if (!data) return '勤怠情報を取得できませんでした。'
        const records: any[] = (data.data ?? []).filter((r: any) => r.work_date === todayJst)
        if (records.length === 0) return `今日（${todayJst}）の打刻記録はまだありません。`
        const nameMap = new Map<string, string>()
        for (const s of (data.summary ?? [])) nameMap.set(s.worker_id, s.name)
        const fmtTime = (ts: string | null) => ts
          ? new Date(ts).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' })
          : null
        const working: string[] = []
        const done:    string[] = []
        for (const r of records) {
          const name = nameMap.get(r.worker_id) ?? r.worker_id.slice(0, 8)
          const ci = fmtTime(r.clock_in)
          const co = fmtTime(r.clock_out)
          if (ci && !co) working.push(`${name}(${ci}〜)`)
          else if (ci && co) done.push(`${name}(${ci}〜${co})`)
        }
        const parts: string[] = [`今日（${todayJst}）の出勤: ${records.length}名打刻済み`]
        if (working.length > 0) parts.push(`勤務中: ${working.slice(0, 5).join('、')}`)
        if (done.length    > 0) parts.push(`退勤済: ${done.slice(0, 5).join('、')}`)
        return parts.join('。')
      },
    }),
    toolFactory({
      name: 'get_attendance_records',
      description: '指定した従業員の勤怠記録詳細を取得する。「田中さん今日の勤怠教えて」「この人昨日何時に来た？」「今月の出勤記録見せて」等に使う。get_employee_attendance_summaryより詳細な日別記録を返す。',
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
        if (!empData?.data) return '従業員情報を取得できませんでした。'
        const e = empData.data
        if (!e.auth_user_id) return `${e.name}さんはシステムアカウントがないため勤怠記録を確認できません。`
        const jstDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
        const y = year  ?? jstDate.slice(0, 4)
        const m = month ?? String(parseInt(jstDate.slice(5, 7), 10))
        const attData = await apiFetch(`/api/attendance?worker_id=${e.auth_user_id}&year=${y}&month=${m}`)
        if (!attData) return '勤怠記録を取得できませんでした。'
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
    // ─── Shift Tools ────────────────────────────────────────
    toolFactory({
      name: 'get_shifts',
      description: 'シフト一覧を取得する。「今日誰入ってる？」「明日のシフトは？」「今週のシフト教えて」「ABC案件のシフトは？」「田中さん今週いつ入ってる？」等。date_from・date_toを省略すると今日のシフトを返す。',
      parameters: {
        type: 'object',
        properties: {
          date_from:   { type: 'string', description: '開始日（YYYY-MM-DD）省略時は今日' },
          date_to:     { type: 'string', description: '終了日（YYYY-MM-DD）省略時はdate_fromと同じ日' },
          employee_id: { type: 'string', description: '従業員IDで絞り込み' },
          project_id:  { type: 'string', description: '案件IDで絞り込み' },
          status:      { type: 'string', description: 'scheduled/confirmed/cancelled等' },
        },
        required: [], additionalProperties: false,
      },
      execute: async ({ date_from, date_to, employee_id, project_id, status }: {
        date_from?: string; date_to?: string; employee_id?: string; project_id?: string; status?: string
      }) => {
        const todayJst = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
        const from = date_from ?? todayJst
        const to   = date_to   ?? from
        const q = new URLSearchParams({ date_from: from, date_to: to })
        if (employee_id) q.set('employee_id', employee_id)
        if (project_id)  q.set('project_id', project_id)
        if (status)      q.set('status', status)
        const data = await apiFetch(`/api/shifts?${q}`)
        if (!data) return 'シフト情報を取得できませんでした。'
        const shifts: any[] = data.shifts ?? []
        if (shifts.length === 0) return `${from === to ? from : `${from}〜${to}`}のシフトはありません。`
        const ST: Record<string, string> = { scheduled: '予定', confirmed: '確定', completed: '完了', cancelled: 'キャンセル', in_progress: '作業中' }
        const items = shifts.slice(0, 8).map((s: any, i: number) => {
          const name = s.assignee_type === 'employee'
            ? (s.employees?.name ?? '従業員')
            : (s.partners?.company_name ?? s.partners?.contact_person_name ?? '協力業者')
          const proj = s.projects?.name ?? '案件不明'
          const st = s.start_time?.slice(0, 5) ?? ''
          const et = s.end_time?.slice(0, 5)   ?? ''
          const stat = ST[s.status] ?? s.status ?? ''
          return `${i + 1}件目: ${s.shift_date} ${st}〜${et} ${name}（${proj}）${stat !== '予定' ? `[${stat}]` : ''} [id:${s.id}]`
        }).join(' / ')
        return `${shifts.length}件のシフト。${items}`
      },
    }),
    toolFactory({
      name: 'get_shift_detail',
      description: '指定したシフトの詳細情報を取得する。「1件目詳しく」「このシフト何時から？」「担当誰？」「どの案件？」等。一覧でIDを確認後に使う。',
      parameters: {
        type: 'object',
        properties: { shift_id: { type: 'string', description: 'シフトのID' } },
        required: ['shift_id'], additionalProperties: false,
      },
      execute: async ({ shift_id }: { shift_id: string }) => {
        if (!shift_id) return 'シフトIDが必要です。'
        const data = await apiFetch(`/api/shifts/${shift_id}`)
        if (!data) return 'シフト情報を取得できませんでした。'
        const s = data?.shift
        if (!s) return 'シフトが見つかりませんでした。'
        const name = s.assignee_type === 'employee'
          ? (s.employees?.name ?? '従業員')
          : (s.partners?.company_name ?? s.partners?.contact_person_name ?? '協力業者')
        const proj = s.projects?.name ?? '案件不明'
        const ST: Record<string, string> = { scheduled: '予定', confirmed: '確定', completed: '完了', cancelled: 'キャンセル', in_progress: '作業中' }
        const parts: string[] = [
          `${s.shift_date} ${s.start_time?.slice(0, 5)}〜${s.end_time?.slice(0, 5)}`,
          `担当: ${name}`,
          `案件: ${proj}`,
          `ステータス: ${ST[s.status] ?? s.status}`,
        ]
        if (s.notes) parts.push(`備考: ${s.notes}`)
        return `${parts.join('、')} [id:${shift_id}]`
      },
    }),
    toolFactory({
      name: 'get_shift_attendance_status',
      description: '今日シフトがある従業員の打刻状況を確認する。「今日シフトあるのに来てない人いる？」「シフトより遅れてる人いる？」「まだ退勤してない人いる？」等に使う。',
      parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
      execute: async () => {
        const todayJst = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
        const y = todayJst.slice(0, 4)
        const m = String(parseInt(todayJst.slice(5, 7), 10))
        // 今日の従業員シフト取得
        const shiftsData = await apiFetch(`/api/shifts?date_from=${todayJst}&date_to=${todayJst}&status=scheduled,confirmed`)
        if (!shiftsData) return 'シフト情報を取得できませんでした。'
        const shifts: any[] = (shiftsData.shifts ?? []).filter((s: any) => s.assignee_type === 'employee')
        if (shifts.length === 0) return `今日（${todayJst}）は従業員のシフトが登録されていません。`
        // 従業員一括取得（auth_user_id解決用）
        const empData = await apiFetch('/api/employees?pageSize=200')
        const empMap = new Map<string, string>()
        for (const e of (empData?.data ?? [])) {
          if (e.auth_user_id) empMap.set(e.id, e.auth_user_id)
        }
        // 今日の勤怠記録取得
        const attData = await apiFetch(`/api/attendance?year=${y}&month=${m}`)
        const clockedWorkerIds = new Set<string>(
          (attData?.data ?? [])
            .filter((r: any) => r.work_date === todayJst && r.clock_in)
            .map((r: any) => r.worker_id)
        )
        // 比較
        const noShow:  string[] = []
        const working: string[] = []
        const done:    string[] = []
        const fmtTime = (ts: string) => new Date(ts).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' })
        for (const s of shifts) {
          const empName = s.employees?.name ?? '従業員'
          const authId  = empMap.get(s.employee_id)
          if (!authId) continue
          const attRecord = (attData?.data ?? []).find((r: any) => r.work_date === todayJst && r.worker_id === authId)
          if (!attRecord) {
            noShow.push(`${empName}（シフト: ${s.start_time?.slice(0, 5)}〜${s.end_time?.slice(0, 5)})`)
          } else if (!attRecord.clock_out) {
            working.push(`${empName}（${fmtTime(attRecord.clock_in)}〜）`)
          } else {
            done.push(`${empName}（${fmtTime(attRecord.clock_in)}〜${fmtTime(attRecord.clock_out)}）`)
          }
        }
        const parts: string[] = []
        if (noShow.length  > 0) parts.push(`打刻なし: ${noShow.join('、')}`)
        if (working.length > 0) parts.push(`勤務中: ${working.join('、')}`)
        if (done.length    > 0) parts.push(`退勤済: ${done.join('、')}`)
        return parts.length > 0 ? `今日（${todayJst}）のシフト対比: ${parts.join('。')}` : `今日のシフトメンバー全員が打刻済みです。`
      },
    }),
    // ─── NEW: Invoice / Estimate ─────────────────────────────
    toolFactory({
      name: 'get_invoices',
      description: '請求書・見積書の一覧を取得する。「請求書見せて」「見積書一覧」「未入金の請求は？」等。invoice_type=quote（見積書）またはinvoice（請求書）。',
      parameters: { type: 'object', properties: { invoice_type: { type: 'string' }, status: { type: 'string' }, client_id: { type: 'string' } }, required: [], additionalProperties: false },
      execute: async ({ invoice_type, status, client_id }: { invoice_type?: string; status?: string; client_id?: string }) => {
        const q = new URLSearchParams()
        if (invoice_type) q.set('invoice_type', invoice_type)
        if (status)       q.set('status',       status)
        if (client_id)    q.set('client_id',    client_id)
        const data = await apiFetch(`/api/invoices?${q}`)
        if (!data) return '請求書・見積書一覧を取得できませんでした。'
        const list: any[] = data.invoices ?? []
        if (list.length === 0) return '請求書・見積書はありません。'
        const TL: Record<string,string> = { quote: '見積書', invoice: '請求書' }
        const SL: Record<string,string> = { draft: '下書き', issued: '発行済み', accepted: '承認済み', awaiting_payment: '入金待ち', paid: '入金済み', cancelled: 'キャンセル' }
        const lines = list.slice(0,8).map((inv: any) => {
          const t = TL[inv.invoice_type] ?? inv.invoice_type
          const s = SL[inv.status] ?? inv.status
          const c = inv.clients?.name ?? '顧客不明'
          const a = inv.total_amount != null ? `${Number(inv.total_amount).toLocaleString()}円` : ''
          return `${inv.invoice_number ?? inv.id} ${t}（${c}）${a} [${s}] [id:${inv.id}]`
        })
        return `${lines.join('\n')}（全${list.length}件）`
      },
    }),
    toolFactory({
      name: 'get_invoice_detail',
      description: '請求書または見積書の詳細を取得する。「詳しく」「金額は？」「支払期限は？」等。get_invoicesで取得したidを使う。',
      parameters: { type: 'object', properties: { invoice_id: { type: 'string' } }, required: ['invoice_id'], additionalProperties: false },
      execute: async ({ invoice_id }: { invoice_id: string }) => {
        if (!invoice_id) return 'invoice_idを指定してください。'
        const data = await apiFetch(`/api/invoices/${invoice_id}`)
        if (!data) return '請求書・見積書が見つかりませんでした。'
        const inv = data.invoice
        if (!inv) return '見つかりませんでした。'
        const TL: Record<string,string> = { quote: '見積書', invoice: '請求書' }
        const SL: Record<string,string> = { draft: '下書き', issued: '発行済み', accepted: '承認済み', awaiting_payment: '入金待ち', paid: '入金済み', cancelled: 'キャンセル' }
        const parts: string[] = [`${TL[inv.invoice_type]??inv.invoice_type} ${inv.invoice_number??inv.id}`, `ステータス: ${SL[inv.status]??inv.status}`, `顧客: ${inv.clients?.name??'不明'}`]
        if (inv.issue_date)     parts.push(`発行日: ${inv.issue_date}`)
        if (inv.due_date)       parts.push(`支払期限: ${inv.due_date}`)
        if (inv.total_amount != null) parts.push(`合計: ${Number(inv.total_amount).toLocaleString()}円`)
        if (inv.paid_amount != null && inv.invoice_type === 'invoice') parts.push(`入金済: ${Number(inv.paid_amount).toLocaleString()}円`)
        return parts.join('\n')
      },
    }),
    // ─── NEW: Reports ─────────────────────────────────────────
    toolFactory({
      name: 'get_reports',
      description: '報告書・作業完了レポートの一覧を取得する。「報告書一覧」「最近の報告書ある？」「この案件の報告書は？」等。',
      parameters: { type: 'object', properties: { project_id: { type: 'string' } }, required: [], additionalProperties: false },
      execute: async ({ project_id }: { project_id?: string }) => {
        const data = await apiFetch('/api/reports?pageSize=8')
        if (!data) return '報告書一覧を取得できませんでした。'
        let list: any[] = data.data ?? []
        if (project_id) list = list.filter((r: any) => r.project_id === project_id)
        if (list.length === 0) return '報告書はありません。'
        const lines = list.slice(0,8).map((r: any) => {
          const proj = r.projects?.name ?? '案件不明'
          const date = r.jobs?.work_date ?? ''
          const score = r.overall_score != null ? `${r.overall_score}点` : 'スコアなし'
          const pdf = r.pdf_url ? 'PDF済' : 'PDF未生成'
          return `${date} ${proj} v${r.version} [${score}・${pdf}] [id:${r.id}]`
        })
        return `${lines.join('\n')}（全${data.count??list.length}件）`
      },
    }),
    toolFactory({
      name: 'get_report_detail',
      description: '報告書の詳細を取得する。「詳しく」「内容は？」「総合評価は？」「Before/After写真は？」等。get_reportsで取得したidを使う。',
      parameters: { type: 'object', properties: { report_id: { type: 'string' } }, required: ['report_id'], additionalProperties: false },
      execute: async ({ report_id }: { report_id: string }) => {
        if (!report_id) return 'report_idを指定してください。'
        const data = await apiFetch(`/api/reports/${report_id}`)
        if (!data) return '報告書が見つかりませんでした。'
        const rep = data.data
        if (!rep) return '見つかりませんでした。'
        const content = rep.content ?? {}
        const summary = content.summary ?? {}
        const parts: string[] = [`報告書 v${rep.version}`]
        if (content.project?.name) parts.push(`案件: ${content.project.name}`)
        if (content.job?.work_date) parts.push(`作業日: ${content.job.work_date}`)
        if (summary.overall_score != null) parts.push(`総合スコア: ${summary.overall_score}点`)
        if (summary.quality_assessment) parts.push(`品質評価: ${summary.quality_assessment}`)
        const spots: any[] = content.spots ?? []
        if (spots.length > 0) {
          parts.push(`Before写真: ${spots.filter((s: any) => s.before_url).length}箇所、After写真: ${spots.filter((s: any) => s.after_url).length}箇所`)
        }
        parts.push(rep.pdf_url ? 'PDF生成済み' : 'PDF未生成')
        return parts.join('\n')
      },
    }),
    // ─── NEW: Inventory ───────────────────────────────────────
    toolFactory({
      name: 'get_inventory',
      description: '在庫品目の一覧を取得する。「在庫一覧」「ワックス在庫ある？」「在庫少ないものある？」等。',
      parameters: { type: 'object', properties: { search: { type: 'string' }, status: { type: 'string' } }, required: [], additionalProperties: false },
      execute: async ({ search, status }: { search?: string; status?: string }) => {
        const q = new URLSearchParams()
        if (search) q.set('search', search)
        if (status) q.set('status', status)
        const data = await apiFetch(`/api/inventory?${q}`)
        if (!data) return '在庫一覧を取得できませんでした。'
        const items: any[] = data.items ?? []
        const kpi = data.kpi ?? {}
        if (items.length === 0) return '在庫品目はありません。'
        const SL: Record<string,string> = { normal: '正常', low_stock: '在庫少', out_of_stock: '在庫切れ' }
        const lines = items.slice(0,8).map((i: any) => {
          const s = SL[i.stock_status] ?? i.stock_status
          return `${i.name} 在庫:${i.stock_quantity}${i.unit} 最低:${i.min_stock}${i.unit} [${s}] [id:${i.id}]`
        })
        return `在庫少:${kpi.low_stock??0}件・在庫切れ:${kpi.out_of_stock??0}件\n${lines.join('\n')}`
      },
    }),
    toolFactory({
      name: 'get_inventory_detail',
      description: '在庫品目の詳細を取得する。「現在庫何個？」「詳しく」等。get_inventoryで取得したidを使う。',
      parameters: { type: 'object', properties: { inventory_id: { type: 'string' } }, required: ['inventory_id'], additionalProperties: false },
      execute: async ({ inventory_id }: { inventory_id: string }) => {
        if (!inventory_id) return 'inventory_idを指定してください。'
        const data = await apiFetch(`/api/inventory/${inventory_id}`)
        if (!data) return '在庫品目が見つかりませんでした。'
        const item = data.item
        if (!item) return '見つかりませんでした。'
        const SL: Record<string,string> = { normal: '正常', low_stock: '在庫少', out_of_stock: '在庫切れ' }
        const parts: string[] = [`品目: ${item.name}（${item.category}）`, `現在庫: ${item.stock_quantity}${item.unit}`, `最低在庫: ${item.min_stock}${item.unit}`, `ステータス: ${SL[item.stock_status]??item.stock_status}`]
        if (item.storage_location) parts.push(`保管場所: ${item.storage_location}`)
        return parts.join('\n')
      },
    }),
    // ─── NEW: Contracts ───────────────────────────────────────
    toolFactory({
      name: 'get_contracts',
      description: '契約一覧を取得する。「契約一覧教えて」「ABC社の契約ある？」「もうすぐ期限切れの契約は？」等。',
      parameters: { type: 'object', properties: { search: { type: 'string' }, status: { type: 'string' }, expiring_days: { type: 'string' } }, required: [], additionalProperties: false },
      execute: async ({ search, status, expiring_days }: { search?: string; status?: string; expiring_days?: string }) => {
        const q = new URLSearchParams()
        if (search)        q.set('search',        search)
        if (status)        q.set('status',        status)
        if (expiring_days) q.set('expiring_days', expiring_days)
        const data = await apiFetch(`/api/contracts?${q}`)
        if (!data) return '契約一覧を取得できませんでした。'
        const list: any[] = data.contracts ?? []
        const kpi = data.kpi ?? {}
        if (list.length === 0) return '契約はありません。'
        const SL: Record<string,string> = { draft: '下書き', active: '有効', signed: '締結済み', reviewing: '確認中', expired: '期限切れ', terminated: '解約' }
        const lines = list.slice(0,8).map((c: any) => {
          const stat  = SL[c.status] ?? c.status
          const party = c.counterparty_type === 'client' ? (c.clients?.name ?? '顧客不明') : (c.partners?.company_name ?? '業者不明')
          const end   = c.end_date ? `終了:${c.end_date}` : '期限なし'
          const days  = c.deadline?.daysUntilExpiry != null ? (c.deadline.daysUntilExpiry < 0 ? '期限切れ' : `残${c.deadline.daysUntilExpiry}日`) : ''
          return `${c.title}（${party}）[${stat}] ${end}${days ? ' '+days : ''} [id:${c.id}]`
        })
        return `有効:${kpi.active??0}件・30日以内期限:${kpi.expiring30d??0}件\n${lines.join('\n')}`
      },
    }),
    toolFactory({
      name: 'get_contract_detail',
      description: '契約の詳細を取得する。「詳しく」「いつまで？」「更新日は？」等。get_contractsで取得したidを使う。',
      parameters: { type: 'object', properties: { contract_id: { type: 'string' } }, required: ['contract_id'], additionalProperties: false },
      execute: async ({ contract_id }: { contract_id: string }) => {
        if (!contract_id) return 'contract_idを指定してください。'
        const data = await apiFetch(`/api/contracts/${contract_id}`)
        if (!data) return '契約が見つかりませんでした。'
        const c = data.contract
        if (!c) return '見つかりませんでした。'
        const SL: Record<string,string> = { draft: '下書き', active: '有効', signed: '締結済み', reviewing: '確認中', expired: '期限切れ', terminated: '解約' }
        const TL: Record<string,string> = { service: 'サービス', maintenance: 'メンテナンス', spot: 'スポット', nda: 'NDA', other: 'その他' }
        const parts: string[] = [`契約: ${c.title}`, `ステータス: ${SL[c.status]??c.status}`, `種別: ${TL[c.contract_type]??c.contract_type}`]
        const party = c.counterparty_type === 'client' ? (c.clients?.name ?? '顧客不明') : (c.partners?.company_name ?? '業者不明')
        parts.push(`相手: ${party}`)
        if (c.start_date)   parts.push(`開始日: ${c.start_date}`)
        if (c.end_date)     parts.push(`終了日: ${c.end_date}`)
        if (c.renewal_date) parts.push(`更新日: ${c.renewal_date}`)
        if (c.auto_renewal != null) parts.push(`自動更新: ${c.auto_renewal ? 'あり' : 'なし'}`)
        const dl = c.deadline
        if (dl?.daysUntilExpiry != null) parts.push(`期限: ${dl.daysUntilExpiry < 0 ? `${Math.abs(dl.daysUntilExpiry)}日超過` : `残${dl.daysUntilExpiry}日`}`)
        return parts.join('\n')
      },
    }),
    // ─── NEW: Quality ─────────────────────────────────────────
    toolFactory({
      name: 'get_quality_summary',
      description: '品質KPIサマリーを取得する。「品質状況教えて」「平均スコアは？」「低評価どれくらいある？」等。period=7d/30d/90d/ytd。',
      parameters: { type: 'object', properties: { period: { type: 'string' } }, required: [], additionalProperties: false },
      execute: async ({ period }: { period?: string }) => {
        const p = period ?? '30d'
        const data = await apiFetch(`/api/quality?period=${p}`)
        if (!data) return '品質情報を取得できませんでした。'
        const kpi = data.kpi ?? {}
        if (!kpi.response_count && !kpi.total_completed) return `指定期間（${p}）の品質評価データはありません。`
        const parts: string[] = []
        if (kpi.total_completed != null) parts.push(`完了作業: ${kpi.total_completed}件`)
        if (kpi.response_count  != null) parts.push(`顧客アンケート: ${kpi.response_count}件（回答率${kpi.response_rate??0}%）`)
        if (kpi.avg_hqs         != null) parts.push(`HIKARU品質スコア: ${Math.round((kpi.avg_hqs as number)*10)/10}点`)
        if (kpi.avg_rating      != null) parts.push(`顧客評価平均: ★${Math.round((kpi.avg_rating as number)*10)/10}`)
        if ((kpi.low_rating_count as number) > 0) parts.push(`低評価: ${kpi.low_rating_count}件`)
        return parts.join('\n') || '品質データはありません。'
      },
    }),
    // ─── NEW: Analytics ───────────────────────────────────────
    toolFactory({
      name: 'get_analytics',
      description: 'AI分析・品質・業務の総合データを取得する。「AI分析して」「ランキングは？」「品質分布は？」「月次推移は？」等。',
      parameters: { type: 'object', properties: { focus: { type: 'string' } }, required: [], additionalProperties: false },
      execute: async ({ focus }: { focus?: string }) => {
        const data = await apiFetch('/api/analytics')
        if (!data) return 'AI分析データを取得できませんでした。'
        const { overview, trends, storeRankings, workerRankings } = data
        const parts: string[] = []
        if (overview) {
          parts.push(`作業${overview.totalJobs??0}件（完了${overview.completedJobs??0}）今月${overview.thisMonthJobs??0}件`)
          if (overview.avgQualityScore != null) parts.push(`AI品質平均: ${overview.avgQualityScore}点`)
          if (overview.totalEvaluations > 0) parts.push(`評価${overview.totalEvaluations}件（合格率${overview.passRate}%）`)
        }
        if (!focus || focus === 'store') {
          const top3 = ((storeRankings??[]) as any[]).slice(0,3)
          if (top3.length > 0) parts.push(`店舗TOP3: ${top3.map((s: any,i: number) => `${i+1}位${s.storeName}${s.avgScore??'--'}点`).join('・')}`)
        }
        if (!focus || focus === 'worker') {
          const top3 = ((workerRankings??[]) as any[]).slice(0,3)
          if (top3.length > 0) parts.push(`作業者TOP3: ${top3.map((w: any,i: number) => `${i+1}位${w.workerName}${w.avgScore??'--'}点`).join('・')}`)
        }
        const recent = ((trends??[]) as any[]).filter((t: any) => t.jobCount > 0).slice(-2)
        if (recent.length > 0) parts.push(`最近のトレンド: ${recent.map((t: any) => `${t.label}${t.avgScore!=null?t.avgScore+'点':'スコアなし'}`).join('→')}`)
        return parts.join('\n') || '分析データはありません。'
      },
    }),
    // ─── NEW: Settings ────────────────────────────────────────
    toolFactory({
      name: 'get_settings',
      description: '会社設定・会社情報を取得する。「設定どうなってる？」「会社名は？」「電話番号は？」「住所は？」等。',
      parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
      execute: async () => {
        const data = await apiFetch('/api/settings')
        if (!data) return '設定情報を取得できませんでした。'
        const c = data.data
        if (!c) return '設定情報が見つかりませんでした。'
        const parts: string[] = ['【会社設定】']
        if (c.name)    parts.push(`会社名: ${c.name}`)
        if (c.address) parts.push(`住所: ${c.address}`)
        if (c.phone)   parts.push(`電話: ${c.phone}`)
        if (c.email)   parts.push(`メール: ${c.email}`)
        parts.push(`電子印: ${c.has_seal ? '登録済み' : '未登録'}`)
        if (c.bank_name) parts.push('銀行情報: 登録済み（詳細は管理画面で確認）')
        return parts.join('\n')
      },
    }),
    // ─── NEW: Pending requests ────────────────────────────────
    toolFactory({
      name: 'get_manuals',
      description: 'マニュアル・手順書・作業資料の一覧を確認・検索する。「マニュアル一覧教えて」「床清掃のマニュアルある？」「登録されてる手順書は？」「FAQマニュアル見せて」「カテゴリ○○のマニュアルは？」等。画面を開く依頼ではなく情報を求める場合に使う。',
      parameters: {
        type: 'object',
        properties: {
          search:   { type: 'string', description: 'タイトル・本文で検索' },
          type:     { type: 'string', description: 'text=文章 / faq=FAQ / note=注意事項 / pdf=PDF / image=画像 / video=動画' },
          category: { type: 'string', description: 'カテゴリ名で絞り込み（自由テキスト）' },
        },
        required: [], additionalProperties: false,
      },
      execute: async ({ search, type: manualType, category }: { search?: string; type?: string; category?: string }) => {
        const q = new URLSearchParams()
        if (search)     q.set('search', search)
        if (manualType) q.set('type', manualType)
        if (category)   q.set('category', category)
        const data = await apiFetch(`/api/manuals?${q}`)
        if (!data) return 'マニュアル情報を取得できませんでした。'
        const manuals: any[] = data.data ?? []
        if (manuals.length === 0) return search ? `「${search}」に関するマニュアルは見つかりませんでした。` : 'マニュアルは登録されていません。'
        const TYPE_LABEL: Record<string, string> = { text: '文章', faq: 'FAQ', note: '注意事項', pdf: 'PDF', image: '画像', video: '動画' }
        const items = manuals.slice(0, 5).map((m: any, i: number) => {
          const t   = TYPE_LABEL[m.type] ?? m.type ?? '不明'
          const cat = m.category ? `、${m.category}` : ''
          return `${i + 1}件目: ${m.title}（${t}${cat}） [id:${m.id}]`
        }).join(' / ')
        const suffix = manuals.length > 5 ? `（最初の5件）` : ''
        return `マニュアル${manuals.length}件${suffix}。${items}`
      },
    }),
    toolFactory({
      name: 'get_manual_detail',
      description: '指定したマニュアルの詳細情報（タイトル・種別・カテゴリ・本文概要等）を取得する。「1件目詳しく」「このマニュアルの内容教えて」「カテゴリは？」「何について書いてある？」等。一覧でIDを確認後に使う。',
      parameters: {
        type: 'object',
        properties: { manual_id: { type: 'string', description: 'マニュアルのID' } },
        required: ['manual_id'], additionalProperties: false,
      },
      execute: async ({ manual_id }: { manual_id: string }) => {
        if (!manual_id) return 'マニュアルIDが必要です。'
        const data = await apiFetch(`/api/manuals/${manual_id}`)
        if (!data) return 'マニュアル情報を取得できませんでした。'
        const m = data?.data
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
      },
    }),
    toolFactory({
      name: 'resolve_manual',
      description: 'タイトルや検索語からマニュアルのIDを解決する。Write操作前に必ず使う。「床清掃マニュアルのID教えて」「○○手順書を見つけて」等。',
      parameters: {
        type: 'object',
        properties: { search: { type: 'string', description: 'タイトルや内容で検索するキーワード' } },
        required: ['search'], additionalProperties: false,
      },
      execute: async ({ search }: { search: string }) => {
        if (!search) return '検索キーワードが必要です。'
        const data = await apiFetch(`/api/manuals?search=${encodeURIComponent(search)}`)
        if (!data) return 'マニュアルを検索できませんでした。'
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
      },
    }),
    toolFactory({
      name: 'get_partners',
      description: '協力業者・外注先・パートナーの一覧を確認する。「協力業者一覧教えて」「登録してる外注業者は？」「○○会社って登録されてる？」「有効な協力業者は？」「停止中の業者は？」等。画面を開く依頼ではなく情報を求める場合に使う。',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: '会社名・担当者名・メールで検索' },
          status: { type: 'string', description: 'active=契約中 / suspended=一時停止 / terminated=契約終了' },
        },
        required: [], additionalProperties: false,
      },
      execute: async ({ search, status }: { search?: string; status?: string }) => {
        const q = new URLSearchParams({ pageSize: '10' })
        if (search) q.set('search', search)
        if (status) q.set('status', status)
        const data = await apiFetch(`/api/partners?${q}`)
        if (!data) return '協力業者情報を取得できませんでした。'
        const partners: any[] = data.data ?? []
        const total = data.count ?? partners.length
        if (total === 0) return search ? `「${search}」という協力業者は見つかりませんでした。` : '協力業者は登録されていません。'
        const ST: Record<string, string> = { active: '契約中', suspended: '一時停止', terminated: '契約終了' }
        const items = partners.slice(0, 5).map((p: any, i: number) => {
          const st      = ST[p.status] ?? p.status ?? '不明'
          const contact = p.contact_person_name ? `、担当: ${p.contact_person_name}` : ''
          return `${i + 1}件目: ${p.company_name}${contact}、${st} [id:${p.id}]`
        }).join(' / ')
        return `協力業者${total}社。${items}`
      },
    }),
    toolFactory({
      name: 'get_partner_detail',
      description: '指定した協力業者の詳細情報（連絡先・担当者・住所・担当案件等）を取得する。「この会社の情報教えて」「電話番号は？」「担当者は？」「住所は？」「この業者の案件ある？」等。一覧でIDを確認後に使う。',
      parameters: {
        type: 'object',
        properties: { partner_id: { type: 'string', description: '協力業者のID' } },
        required: ['partner_id'], additionalProperties: false,
      },
      execute: async ({ partner_id }: { partner_id: string }) => {
        if (!partner_id) return '協力業者IDが必要です。'
        const data = await apiFetch(`/api/partners/${partner_id}`)
        if (!data) return '協力業者情報を取得できませんでした。'
        const p = data?.data
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
      },
    }),
    toolFactory({
      name: 'resolve_partner',
      description: '会社名や担当者名から協力業者のIDを解決する。Write操作前に必ず使う。「○○会社のID教えて」「○○建設を見つけて」等。',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: '検索する会社名または担当者名キーワード' } },
        required: ['name'], additionalProperties: false,
      },
      execute: async ({ name }: { name: string }) => {
        if (!name) return '検索キーワードが必要です。'
        const data = await apiFetch(`/api/partners?search=${encodeURIComponent(name)}&pageSize=10`)
        if (!data) return '協力業者を検索できませんでした。'
        const partners: any[] = data.data ?? []
        const total = data.count ?? partners.length
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
      },
    }),
    toolFactory({
      name: 'get_project_requests',
      description: '顧客からの案件依頼一覧を取得する。「案件依頼ある？」「顧客から依頼来てる？」「未対応の依頼教えて」「承認済みの依頼は？」「1件目の依頼内容は？」「誰から来てる？」「希望日は？」等。内容詳細も含む。',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'pending=未対応 / approved=承認済み / rejected=却下済み（省略時=全件）' },
        },
        required: [], additionalProperties: false,
      },
      execute: async ({ status }: { status?: string }) => {
        const q = new URLSearchParams()
        if (status) q.set('status', status)
        const data = await apiFetch(`/api/project-requests?${q}`)
        if (!data) return '案件依頼情報を取得できませんでした。'
        const requests: any[] = data.data ?? []
        const total = data.count ?? requests.length
        if (total === 0) {
          const label = status === 'pending' ? '未対応の' : status === 'approved' ? '承認済みの' : status === 'rejected' ? '却下済みの' : ''
          return `${label}案件依頼はありません。`
        }
        const ST: Record<string, string> = { pending: '未対応', approved: '承認済み', rejected: '却下済み' }
        const PT: Record<string, string> = { spot: 'スポット', recurring: '定期', hotel: 'ホテル' }
        const items = requests.slice(0, 5).map((r: any, i: number) => {
          const client = r.clients?.name ?? '顧客不明'
          const st     = ST[r.status] ?? r.status
          const date   = r.desired_date ? `、希望日: ${r.desired_date}` : ''
          const loc    = r.location    ? `、場所: ${r.location}` : ''
          const type   = r.project_type ? `、${PT[r.project_type] ?? r.project_type}` : ''
          return `${i + 1}件目: ${client}、「${r.title}」${type}${date}${loc}、${st} [id:${r.id}]`
        }).join(' / ')
        const suffix = total > 5 ? `（最初の5件）` : ''
        return `案件依頼${total}件${suffix}。${items}`
      },
    }),
    toolFactory({
      name: 'get_pending_requests',
      description: '承認待ちの各種申請（勤怠修正・経費・案件依頼）の件数サマリーを取得する。「申請来てる？」「何か承認待ちある？」等。',
      parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
      execute: async () => {
        const data = await apiFetch('/api/project-requests?status=pending')
        if (!data) return '承認待ち件数を取得できませんでした。'
        const count = data.count ?? (data.data ?? []).length
        return count > 0 ? `案件依頼の承認待ちが${count}件あります。` : '案件依頼の承認待ちはありません。'
      },
    }),
    toolFactory({
      name: 'execute_confirmed_action',
      description: 'ユーザーが「はい」と確認した後にのみ呼ぶ。Server Auth再検証して実行。',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['console.update_project_status', 'console.create_project', 'console.update_project', 'console.add_assignment', 'console.remove_assignment', 'console.replace_assignment', 'console.create_client', 'console.update_client', 'console.approve_expense', 'console.approve_attendance', 'console.reject_attendance', 'console.reject_expense', 'console.create_employee', 'console.update_employee', 'console.update_employee_status', 'console.create_shift', 'console.update_shift', 'console.cancel_shift', 'console.create_estimate_from_project', 'console.create_invoice_from_project', 'console.update_invoice_status', 'console.convert_estimate', 'console.record_payment', 'console.generate_report_pdf', 'console.inventory_stock_in', 'console.inventory_stock_out', 'console.adjust_inventory', 'console.create_inventory_item', 'console.update_inventory_item', 'console.create_contract', 'console.update_contract', 'console.mark_notification_read', 'console.update_company_setting', 'console.create_partner', 'console.update_partner', 'console.update_partner_status', 'console.create_manual', 'console.update_manual', 'console.approve_project_request', 'console.reject_project_request'] },
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
  const voiceTraceSeqRef        = React.useRef(0)
  const realtimeSessionSeqRef   = React.useRef(0)

  // ─── VOICE_TRACE helper（診断用、機密データ禁止）────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const voiceTrace = React.useCallback((event: string, extra?: Record<string, unknown>) => {
    voiceTraceSeqRef.current += 1
    console.log('[VOICE_TRACE]', {
      seq:  voiceTraceSeqRef.current,
      t:    new Date().toISOString(),
      event,
      mode: modeRef.current,
      eng:  voiceEngineModeRef.current,
      spk:  isSpeakingRef.current,
      ...extra,
    })
  }, [])

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
    voiceTrace('interrupt_called', { reason: 'manual' })
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
    realtimeSessionSeqRef.current += 1
    voiceTrace('connect_start', { sessionSeq: realtimeSessionSeqRef.current })

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
          // createResponse:false = Server VADはspeech detectionのみ担当。
          // response.createはSDK ResponseCreateSequencer経由でHIKARUが明示管理。
          // これによりServer VAD auto-responseとSDK Sequencerの二重Ownerを解消する。
          audio: { input: { turnDetection: { type: 'semantic_vad', eagerness: 'high', interruptResponse: false, createResponse: false } } },
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
        voiceTrace('agent_start')
        muteMic(true)
        if (modeRef.current === 'listening' || modeRef.current === 'idle') setModeSync('processing')
      })
      // audio_start: WebRTC modeでは発火しないがWebSocket fallback用に残す。
      session.on?.('audio_start', () => {
        if (voiceEngineModeRef.current !== 'realtime') return
        voiceTrace('audio_start')
        isSpeakingRef.current = true
        if (resumeTimerRef.current) { clearTimeout(resumeTimerRef.current); resumeTimerRef.current = null }
        setModeSync('speaking')
      })
      session.on?.('audio_stopped', () => {
        if (voiceEngineModeRef.current !== 'realtime') return
        voiceTrace('audio_stopped')
        isSpeakingRef.current = false
        // Root Cause Fix: DO NOT unmute immediately after audio_stopped.
        // Mic was previously opened before the 300ms timer fired, giving the
        // server VAD a window to capture speaker echo and generate phantom turns.
        // Fix: keep mic muted until after the echo cooldown, then unmute + set listening atomically.
        setModeSync('processing')
        if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
        voiceTrace('resume_timer_set', { delay: 700 })
        resumeTimerRef.current = setTimeout(() => {
          if (voiceEngineModeRef.current !== 'realtime') return
          if (modeRef.current !== 'processing') return
          voiceTrace('resume_timer_fire')
          muteMic(false)
          setModeSync('listening')
          voiceTrace('listening_restored')
        }, 700)
      })
      session.on?.('agent_end', (_ctx: unknown, _agent: unknown, output: string) => {
        // agent_endでunmuteしない: audio_stoppedを唯一の正規unmute経路とする。
        // tool-only responseのagent_end→次audio responseのagent_startの窓でbarge-inが発生するため。
        if (voiceEngineModeRef.current !== 'realtime') return
        const text = (output ?? '').trim()
        if (!text) { voiceTrace('agent_end_empty'); return }
        // 時間ベースdedup: 同一テキストが3秒以内に再度来た場合はphantom turnの重複とみなす。
        // 直前メッセージがuserの場合でもブロックできるよう、refs単体で管理する。
        const now = Date.now()
        if (text === lastRtResponseText.current && now - lastRtResponseTime.current < 3000) {
          voiceTrace('agent_end_dedup_skip', { outputLen: text.length })
          return
        }
        voiceTrace('agent_end_add_message', { outputLen: text.length })
        lastRtResponseText.current = text
        lastRtResponseTime.current = now
        setResponse(text)
        addMessage('assistant', text)
      })
      session.on?.('agent_tool_start', () => {
        if (voiceEngineModeRef.current !== 'realtime') return
        voiceTrace('agent_tool_start')
        muteMic(true)
        setModeSync('working')
      })
      session.on?.('agent_tool_end', () => {
        if (voiceEngineModeRef.current !== 'realtime') return
        voiceTrace('agent_tool_end')
        setModeSync('processing')
      })
      // audio_interrupted: WebRTC modeでは発火しない (WebSocket専用)。safety unmute。
      session.on?.('audio_interrupted', () => {
        if (voiceEngineModeRef.current !== 'realtime') return
        voiceTrace('audio_interrupted')
        isSpeakingRef.current = false
        muteMic(false)
        if (resumeTimerRef.current) { clearTimeout(resumeTimerRef.current); resumeTimerRef.current = null }
        setModeSync('listening')
      })
      session.on?.('transport_event', (event: any) => {
        const evType = event?.type as string | undefined
        if (evType === 'response.created' || evType === 'response.done' || evType === 'response.output_audio.done' || evType === 'response.cancelled' || evType === 'error') {
          if (evType === 'error') {
            voiceTrace('realtime_error_detail', {
              errorType:    (event as any)?.error?.type,
              errorCode:    (event as any)?.error?.code,
              errorMessage: typeof (event as any)?.error?.message === 'string'
                ? ((event as any).error.message as string).slice(0, 200)
                : undefined,
              eventId:      (event as any)?.error?.event_id,
            })
          } else {
            voiceTrace('transport_event', { evType, responseId: (event as any)?.response?.id })
          }
        }
        if (evType !== 'conversation.item.input_audio_transcription.completed') return
        const text = (event.transcript ?? '').trim()
        if (!text || voiceEngineModeRef.current !== 'realtime') return
        setTranscript(text)
        const m = modeRef.current
        const isBusy = m === 'processing' || m === 'working' || m === 'speaking'
        voiceTrace('user_transcript_completed', { textLen: text.length, busy: isBusy, interrupt: isInterruptPhrase(text) })
        if (isBusy && !isInterruptPhrase(text)) return
        addMessage('user', text)
        // createResponse:false により Server が auto-response を生成しないため、
        // ResponseCreateSequencer 経由で明示的に response.create を送信する。
        ;(realtimeSessionRef.current?.transport as any)?.requestResponse?.()
      })
      session.on?.('error', (err: unknown) => {
        const realtimeErrorMessage = (
          (err as any)?.error?.error?.message ??
          (err as any)?.error?.message ??
          (err as Error)?.message ??
          'Unknown realtime error'
        )
        console.error('[console-realtime] session error (non-fatal):', String(realtimeErrorMessage).slice(0, 200))
        // エラー時はmuteを解除してListening継続を試みる。
        muteMic(false)
      })

      // 予期せぬ切断時の自動Reconnect（1回）
      const transport = session.transport as any
      transport?.on?.('connection_change', (status: any) => {
        voiceTrace('connection_change', { status })
        if (status !== 'disconnected') return
        if (!isSessionRef.current) return
        if (voiceEngineModeRef.current !== 'realtime') return
        console.warn('[console-realtime] connection dropped, reconnecting in 1.5s')
        realtimeSessionRef.current = null
        if (resumeTimerRef.current) { clearTimeout(resumeTimerRef.current); resumeTimerRef.current = null }
        setVoiceEngineMode('off')
        voiceEngineModeRef.current = 'off'
        setModeSync('processing')
        voiceTrace('reconnect_scheduled', { delay: 1500 })
        setTimeout(() => {
          if (!isSessionRef.current) return
          if (voiceEngineModeRef.current !== 'off') return
          voiceTrace('reconnect_start')
          connectRealtimeRef.current()
        }, 1500)
      })

      // connect()解決 = WebRTC確立。イベント待ちせず即座にrealtime状態をセット（Worker方式）。
      voiceTrace('session_connecting')
      await session.connect({ apiKey: clientSecret } as any)
      realtimeSessionRef.current = session
      setVoiceEngineMode('realtime')
      voiceEngineModeRef.current = 'realtime'
      setModeSync('listening')
      voiceTrace('session_connected')

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
        // Realtime mode中はWebRTC audioが再生中のため Browser TTSを重ねない
        if (voiceEngineModeRef.current !== 'realtime' && voiceEngineModeRef.current !== 'realtime-connecting') {
          speakAndMaybeResume(msg)
        }
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
        // Realtime mode中はWebRTC audioが再生中のため Browser TTSを重ねない
        if (voiceEngineModeRef.current !== 'realtime' && voiceEngineModeRef.current !== 'realtime-connecting') {
          speakAndMaybeResume(msg)
        }
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
