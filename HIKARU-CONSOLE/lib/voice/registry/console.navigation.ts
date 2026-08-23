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

// ============================================================
// Detail Navigation — entity + entityId → 実在Route
// ============================================================

export const CONSOLE_DETAIL_ENTITIES = [
  'project',
  'client',
  'employee',
  'partner',
  'expense',
  'invoice',
  'report',
  'inventory',
  'contract',
  'attendance_correction',
  'analytics_store',
  'analytics_worker',
  'worker',
] as const

export type ConsoleDetailEntity = (typeof CONSOLE_DETAIL_ENTITIES)[number]

const CONSOLE_DETAIL_LABELS: Record<ConsoleDetailEntity, string> = {
  project:               '案件詳細',
  client:                '顧客詳細',
  employee:              '従業員詳細',
  partner:               '協力業者詳細',
  expense:               '経費申請詳細',
  invoice:               '請求書詳細',
  report:                '報告書詳細',
  inventory:             '在庫品詳細',
  contract:              '契約詳細',
  attendance_correction: '勤怠修正申請詳細',
  analytics_store:       'AI分析（店舗）',
  analytics_worker:      'AI分析（作業者）',
  worker:                '作業者詳細',
}

/** entity → /path/prefix/ （末尾スラッシュあり） */
const CONSOLE_DETAIL_ROUTE_PREFIXES: Record<ConsoleDetailEntity, string> = {
  project:               '/projects/',
  client:                '/clients/',
  employee:              '/employees/',
  partner:               '/partners/',
  expense:               '/expenses/',
  invoice:               '/invoices/',
  report:                '/reports/',
  inventory:             '/inventory/',
  contract:              '/contracts/',
  attendance_correction: '/attendance/corrections/',
  analytics_store:       '/analytics/store/',
  analytics_worker:      '/analytics/worker/',
  worker:                '/workers/',
}

export function isConsoleDetailEntity(v: string): v is ConsoleDetailEntity {
  return CONSOLE_DETAIL_ENTITIES.includes(v as ConsoleDetailEntity)
}

/** 安全な詳細ページNavigation。entity + entityId → 実在ルートへ router.push。 */
export function executeConsoleDetailNavigation(
  entity:   string,
  entityId: string,
  router:   { push: (p: string) => void }
): string {
  if (!isConsoleDetailEntity(entity)) {
    return `その詳細ページには移動できません。`
  }
  const id = entityId?.trim()
  if (!id) {
    return `IDが見つかりません。先に検索してください。`
  }
  const prefix = CONSOLE_DETAIL_ROUTE_PREFIXES[entity]
  const label  = CONSOLE_DETAIL_LABELS[entity]
  router.push(`${prefix}${id}`)
  return `${label}を開きます。`
}
