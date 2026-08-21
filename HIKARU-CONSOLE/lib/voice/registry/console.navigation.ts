// ============================================================
// CONSOLE Voice Navigation Registry
// destination enum → route の安全なallowlistマッピング。
// AIが任意URLを指定できないよう、enumのみ許可する。
// Realtime / Browser STT の両経路で同じ定義を使用。
// ============================================================

export const CONSOLE_NAV_DESTINATIONS = [
  'dashboard',
  'projects',
  'project_requests',
  'clients',
  'stores',
  'employees',
  'workers',
  'partners',
  'shifts',
  'attendance',
  'expenses',
  'invoices',
  'notifications',
  'quality',
  'manuals',
  'reports',
  'analytics',
  'inventory',
  'contracts',
  'settings',
  'assistant',
  'back',
] as const

export type ConsoleNavDestination = (typeof CONSOLE_NAV_DESTINATIONS)[number]

/** 各destinationの日本語ラベル */
export const CONSOLE_NAV_LABELS: Record<ConsoleNavDestination, string> = {
  dashboard:        'ダッシュボード',
  projects:         '案件管理',
  project_requests: '案件依頼',
  clients:          '顧客管理',
  stores:           '店舗管理',
  employees:        '従業員管理',
  workers:          '作業者管理',
  partners:         '協力業者管理',
  shifts:           'シフト管理',
  attendance:       '勤怠管理',
  expenses:         '経費管理',
  invoices:         '請求管理',
  notifications:    '通知',
  quality:          '品質管理',
  manuals:          'マニュアル管理',
  reports:          '報告書',
  analytics:        'AI分析',
  inventory:        '在庫管理',
  contracts:        '契約管理',
  settings:         '設定',
  assistant:        'アシスタント',
  back:             '前の画面',
}

/** destination → 実路（'__back' は router.back() を意味する） */
const CONSOLE_NAV_MAP: Record<ConsoleNavDestination, string> = {
  dashboard:        '/dashboard',
  projects:         '/projects',
  project_requests: '/project-requests',
  clients:          '/clients',
  stores:           '/stores',
  employees:        '/employees',
  workers:          '/workers',
  partners:         '/partners',
  shifts:           '/shifts',
  attendance:       '/attendance',
  expenses:         '/expenses',
  invoices:         '/invoices',
  notifications:    '/notifications',
  quality:          '/quality',
  manuals:          '/manuals',
  reports:          '/reports',
  analytics:        '/analytics',
  inventory:        '/inventory',
  contracts:        '/contracts',
  settings:         '/settings',
  assistant:        '/assistant',
  back:             '__back',
}

export function isConsoleNavDestination(v: string): v is ConsoleNavDestination {
  return CONSOLE_NAV_DESTINATIONS.includes(v as ConsoleNavDestination)
}

/** 安全なNavigation実行。router.push or back を destination マッピング経由でのみ実行。 */
export function executeConsoleNavigation(
  destination: string,
  router: { push: (p: string) => void; back: () => void }
): string {
  if (!isConsoleNavDestination(destination)) {
    return `その画面には移動できません。`
  }
  const route = CONSOLE_NAV_MAP[destination]
  const label = CONSOLE_NAV_LABELS[destination]
  if (route === '__back') {
    router.back()
    return '前の画面に戻ります。'
  }
  router.push(route)
  return `${label}を開きます。`
}
