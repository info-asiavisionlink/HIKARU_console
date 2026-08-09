// ============================================================
// HIKARU 在庫管理サービス（共通計算・ステータス判定）
// ============================================================

export type StockStatus = 'normal' | 'low_stock' | 'out_of_stock' | 'inactive'

export const CATEGORY_LABELS: Record<string, string> = {
  detergent:   '洗剤',
  consumable:  '消耗品',
  tool:        '清掃用品',
  hygiene:     '衛生用品',
  equipment:   '機材',
  other:       'その他',
}

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  in:         '入庫',
  out:        '出庫',
  adjustment: '在庫調整',
}

/**
 * 在庫ステータスを自動判定（管理者は手動変更不可）
 */
export function calculateStockStatus(
  stockQty:  number,
  minStock:  number,
  isActive:  boolean
): StockStatus {
  if (!isActive)          return 'inactive'
  if (stockQty <= 0)      return 'out_of_stock'
  if (stockQty < minStock) return 'low_stock'
  return 'normal'
}

/**
 * 在庫金額計算（参考値）
 * stockQty × unitPrice
 */
export function calculateInventoryValue(
  stockQty:  number,
  unitPrice: number | null | undefined
): number | null {
  if (unitPrice == null) return null
  return Math.round(stockQty * unitPrice)
}

/**
 * 在庫ステータスのラベル・バリアント
 */
export const STATUS_CONFIG: Record<StockStatus, { label: string; variant: string; color: string }> = {
  normal:        { label: '正常',     variant: 'success',     color: 'var(--color-success)' },
  low_stock:     { label: '在庫不足', variant: 'warning',     color: 'var(--color-warning)' },
  out_of_stock:  { label: '在庫切れ', variant: 'error',       color: 'var(--color-error)' },
  inactive:      { label: '無効',     variant: 'secondary',   color: 'var(--color-muted-foreground)' },
}

/**
 * 通知が必要かチェック（重複防止ロジック）
 * low_stock へ初めて移行した時のみ通知
 * 正常 → low_stock: 通知
 * low_stock 状態が継続: 通知しない
 * 正常に回復 → 再びlow_stock: 再通知
 */
export function shouldNotifyLowStock(
  newStatus:      StockStatus,
  lastNotifiedAt: string | null | undefined,
  lastUpdatedAt:  string | null | undefined
): boolean {
  if (newStatus !== 'low_stock' && newStatus !== 'out_of_stock') return false
  if (!lastNotifiedAt) return true

  // 最後の通知より後に在庫が変動（正常に回復してから再びlow_stock）している場合のみ通知
  if (lastUpdatedAt && new Date(lastUpdatedAt) > new Date(lastNotifiedAt)) return true
  return false
}

/**
 * フォーマット
 */
export function fmtQty(qty: number, unit: string): string {
  const n = Number.isInteger(qty) ? qty : qty.toFixed(2).replace(/\.?0+$/, '')
  return `${n}${unit}`
}

export function fmtMoney(n: number | null): string {
  if (n == null) return '—'
  return '¥' + n.toLocaleString('ja-JP')
}

export function fmtDate(d?: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ja-JP')
}
