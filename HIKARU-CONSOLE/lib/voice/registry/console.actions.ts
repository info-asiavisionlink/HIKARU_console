// ============================================================
// CONSOLE Voice Action Registry — L0-L2のみ
// System Action Registry とは完全分離。CONSOLE業務専用。
// L3以上（承認・削除・変更等）は未登録。DAY2で追加予定。
// ============================================================

export const CONSOLE_ACTIONS = {
  // ─── L0: Conversation ────────────────────────────────────
  'console.ask_ai': {
    level: 0 as const,
    description: '管理者向けAI質問・相談',
  },

  // ─── L1: Read-only ───────────────────────────────────────
  'console.get_dashboard': {
    level: 1 as const,
    description: 'ダッシュボード・今日の状況サマリーを取得',
  },
  'console.get_notifications': {
    level: 1 as const,
    description: '管理者向け通知・承認待ち件数を確認',
  },
  'console.get_pending_requests': {
    level: 1 as const,
    description: '案件依頼の承認待ち件数を確認',
  },
  'console.get_pending_expenses': {
    level: 1 as const,
    description: '承認待ちの経費申請件数を確認',
  },
  'console.get_pending_attendance': {
    level: 1 as const,
    description: '勤怠修正申請の承認待ち件数を確認',
  },
  'console.get_expense_detail': {
    level: 1 as const,
    description: '指定した経費申請の詳細（申請者・金額・カテゴリ・日付・内容・ステータス）を取得',
  },
  'console.get_project_detail': {
    level: 1 as const,
    description: '指定IDの案件詳細（名称・種別・ステータス・顧客・日程・場所・担当人数）を取得',
  },
  'console.get_project_assignments': {
    level: 1 as const,
    description: '指定IDの案件担当者一覧を取得',
  },
  'console.get_revenue': {
    level: 1 as const,
    description: '今月売上・今年売上・未入金・未請求をHIKARU登録データから確認',
  },

  // ─── L2: Navigation ──────────────────────────────────────
  'console.go_dashboard': {
    level: 2 as const,
    description: 'ダッシュボード・トップ画面へ移動',
  },
  'console.go_back': {
    level: 2 as const,
    description: '前の画面・ひとつ前のページに戻る',
  },
  'console.open_projects': {
    level: 2 as const,
    description: '案件管理・案件一覧を開く',
  },
  'console.open_project_requests': {
    level: 2 as const,
    description: '案件依頼・見積依頼一覧を開く',
  },
  'console.open_clients': {
    level: 2 as const,
    description: '顧客管理・クライアント一覧を開く',
  },
  'console.open_employees': {
    level: 2 as const,
    description: '従業員管理・スタッフ一覧を開く',
  },
  'console.open_partners': {
    level: 2 as const,
    description: '協力業者管理・パートナー一覧を開く',
  },
  'console.open_shifts': {
    level: 2 as const,
    description: 'シフト管理・勤務シフト一覧を開く',
  },
  'console.open_attendance': {
    level: 2 as const,
    description: '勤怠管理・出退勤記録を開く',
  },
  'console.open_attendance_corrections': {
    level: 2 as const,
    description: '勤怠修正申請一覧を開く',
  },
  'console.open_invoices_quotes': {
    level: 2 as const,
    description: '見積書一覧を開く',
  },
  'console.open_invoices_bills': {
    level: 2 as const,
    description: '請求書一覧を開く',
  },
  'console.open_quality_surveys': {
    level: 2 as const,
    description: '顧客アンケート一覧を開く',
  },
  'console.open_quality_workers': {
    level: 2 as const,
    description: '作業者品質ランキングを開く',
  },
  'console.open_project_spot_list': {
    level: 2 as const,
    description: 'スポット案件一覧を開く',
  },
  'console.open_project_recurring_list': {
    level: 2 as const,
    description: '定期案件一覧を開く',
  },
  'console.open_project_hotel_list': {
    level: 2 as const,
    description: 'ホテル案件一覧を開く',
  },
  'console.open_expenses': {
    level: 2 as const,
    description: '経費管理・経費申請一覧を開く',
  },
  'console.open_invoices': {
    level: 2 as const,
    description: '請求管理・請求書・見積書を開く',
  },
  'console.open_notifications': {
    level: 2 as const,
    description: '通知管理・通知一覧を開く',
  },
  'console.open_quality': {
    level: 2 as const,
    description: '品質管理・品質評価ダッシュボードを開く',
  },
  'console.open_manuals': {
    level: 2 as const,
    description: 'マニュアル管理を開く',
  },
  'console.open_reports': {
    level: 2 as const,
    description: '報告書管理・作業報告一覧を開く',
  },
  'console.open_analytics': {
    level: 2 as const,
    description: 'AI分析・データ分析画面を開く',
  },
  'console.open_inventory': {
    level: 2 as const,
    description: '在庫管理を開く',
  },
  'console.open_contracts': {
    level: 2 as const,
    description: '契約管理を開く',
  },
  'console.open_settings': {
    level: 2 as const,
    description: '設定画面を開く',
  },

  'console.generate_report_pdf': {
    level: 4 as const,
    description: '報告書PDFを生成してStorageに保存する（reportId必須、Confirmation必須）',
  },
  'console.update_company_setting': {
    level: 4 as const,
    description: '会社設定（name/address/phone/email/postal_code）を更新する。銀行情報・法人番号等の財務情報はVoice変更不可。Confirmation必須。',
  },
  'console.mark_notification_read': {
    level: 4 as const,
    description: '管理者向け通知1件を既読にする（notificationId必須、Confirmation必須）',
  },
  'console.create_contract': {
    level: 4 as const,
    description: '契約を新規登録する（title・counterparty_type・client_id or partner_id必須、Confirmation必須）',
  },
  'console.update_contract': {
    level: 4 as const,
    description: '契約情報を更新する（contractId必須、status変更も含む、Confirmation必須）',
  },
  'console.inventory_stock_in': {
    level: 4 as const,
    description: '在庫品目に入庫処理を行う（inventoryId・quantity必須、Confirmation必須）',
  },
  'console.inventory_stock_out': {
    level: 4 as const,
    description: '在庫品目から出庫処理を行う（inventoryId・quantity必須、在庫不足時は拒否、Confirmation必須）',
  },
  'console.adjust_inventory': {
    level: 4 as const,
    description: '在庫調整（棚卸し等）を行う（inventoryId・target_quantity・reason必須、差分を計算してAtomic更新、Confirmation必須）',
  },
  'console.create_inventory_item': {
    level: 4 as const,
    description: '在庫品目を新規登録する（name必須、初期在庫0スタート、Confirmation必須）',
  },
  'console.update_inventory_item': {
    level: 4 as const,
    description: '在庫品目情報を更新する（inventoryId必須、quantity変更不可・在庫変更はstock_in/out/adjustを使う、Confirmation必須）',
  },

  // ─── L4: Important Write（Confirmation必須・管理者権限確認）──
  'console.update_project_status': {
    level: 4 as const,
    description: '案件のステータスを変更する（active/paused/completed/cancelled、Confirmation必須）',
  },
  'console.create_project': {
    level: 4 as const,
    description: '案件を新規登録する（案件名必須、Confirmation必須）',
  },
  'console.add_assignment': {
    level: 4 as const,
    description: '案件に担当者（従業員または協力業者）を追加する（Confirmation必須）',
  },
  'console.remove_assignment': {
    level: 4 as const,
    description: '案件から担当者を外す（Confirmation必須）',
  },
  'console.replace_assignment': {
    level: 4 as const,
    description: '案件担当者を別の担当者に変更する（Confirmation必須）',
  },
  'console.update_project': {
    level: 4 as const,
    description: '案件の基本情報（名称・種別・日程・場所・メモ等）を編集する（Confirmation必須）',
  },
  'console.create_client': {
    level: 4 as const,
    description: '顧客・取引先を新規登録する（顧客名必須、Confirmation必須）',
  },
  'console.update_client': {
    level: 4 as const,
    description: '顧客・取引先の基本情報を編集する（Confirmation必須）',
  },
  'console.approve_expense': {
    level: 4 as const,
    description: '経費申請を承認する',
  },
  'console.reject_expense': {
    level: 4 as const,
    description: '経費申請を却下する（却下理由必須）',
  },
  'console.approve_attendance': {
    level: 4 as const,
    description: '勤怠修正申請を承認する',
  },
  'console.reject_attendance': {
    level: 4 as const,
    description: '勤怠修正申請を却下する（却下理由必須、Confirmation必須）',
  },
  'console.create_estimate_from_project': {
    level: 4 as const,
    description: '案件の料金情報から見積書を自動作成する（案件必須、金額はサーバー計算、Confirmation必須）',
  },
  'console.create_invoice_from_project': {
    level: 4 as const,
    description: '案件から請求書を作成する（スポット/定期/ホテル対応、金額はサーバー計算、Confirmation必須）',
  },
  'console.update_invoice_status': {
    level: 4 as const,
    description: '請求書または見積書のステータスを変更する（発行・承認・取消等、Confirmation必須）',
  },
  'console.convert_estimate': {
    level: 4 as const,
    description: '見積書を請求書に変換する（見積ID必須、金額スナップショット、Confirmation必須）',
  },
  'console.record_payment': {
    level: 4 as const,
    description: '請求書に入金を記録する（invoiceId・金額必須、Confirmation必須）',
  },
  'console.create_shift': {
    level: 4 as const,
    description: 'シフトを新規登録する（案件・担当者・日時必須、Confirmation必須）',
  },
  'console.update_shift': {
    level: 4 as const,
    description: 'シフトの情報（日時・担当者・案件等）を変更する（Confirmation必須）',
  },
  'console.cancel_shift': {
    level: 4 as const,
    description: 'シフトを取り消す（status=cancelledに変更、Confirmation必須）',
  },
  'console.create_employee': {
    level: 4 as const,
    description: '従業員を新規登録する（名前必須、Confirmation必須。パスワード・権限設定は管理画面から）',
  },
  'console.update_employee': {
    level: 4 as const,
    description: '従業員の基本情報（名前・電話・メール・部署・役職・備考等）を編集する（Confirmation必須）',
  },
  'console.update_employee_status': {
    level: 4 as const,
    description: '従業員のステータスを変更する（active/on_leave/resigned/suspended、Confirmation必須）',
  },
  'console.create_partner': {
    level: 4 as const,
    description: '協力業者を新規登録する（会社名必須、Confirmation必須。ログインアカウント設定は管理画面から）',
  },
  'console.update_partner': {
    level: 4 as const,
    description: '協力業者の基本情報（会社名・担当者・電話・メール・住所・備考等）を編集する（Confirmation必須）',
  },
  'console.update_partner_status': {
    level: 4 as const,
    description: '協力業者のステータスを変更する（active/suspended/terminated、Confirmation必須）',
  },
  'console.create_manual': {
    level: 4 as const,
    description: 'マニュアルを新規作成する（title・type必須、type=text/faq/noteのみ音声対応、Confirmation必須）',
  },
  'console.update_manual': {
    level: 4 as const,
    description: 'マニュアルのタイトル・内容・カテゴリ・typeを編集する（manualId必須、Confirmation必須）',
  },
  'console.approve_project_request': {
    level: 4 as const,
    description: '顧客からの案件依頼を承認する（requestId必須、Confirmation必須。顧客ポータルへ自動通知）',
  },
  'console.reject_project_request': {
    level: 4 as const,
    description: '顧客からの案件依頼を却下する（requestId・adminNote必須、Confirmation必須。顧客ポータルへ自動通知）',
  },
} as const

export type ConsoleActionName = keyof typeof CONSOLE_ACTIONS

export function isValidConsoleAction(name: string): name is ConsoleActionName {
  return Object.prototype.hasOwnProperty.call(CONSOLE_ACTIONS, name)
}

export function getConsoleActionLevel(name: ConsoleActionName): 0 | 1 | 2 | 3 | 4 {
  return CONSOLE_ACTIONS[name].level
}

export function buildConsoleActionListForPrompt(): string {
  return Object.entries(CONSOLE_ACTIONS)
    .map(([name, def]) => `- ${name} (L${def.level}): ${def.description}`)
    .join('\n')
}
