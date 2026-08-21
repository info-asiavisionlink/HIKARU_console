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

  // ─── L4: Important Write（Confirmation必須・管理者権限確認）──
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
