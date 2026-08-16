/**
 * HIKARU Billing Calculator
 * 全画面・API・PDF共通の金額計算サービス
 * ブラウザ側とサーバー側で同じ計算結果を保証する
 */

export type RoundingMethod = 'floor' | 'round' | 'ceil'

export interface LineItem {
  description: string
  quantity:    number
  unit?:       string
  unit_price:  number
  tax_rate?:   number   // 行ごとの税率（省略時は請求書デフォルト税率を使用）
  source_type?: string  // 'project_price' | 'manual' | 'discount'
  source_id?:  string
  order_num?:  number
}

export interface InvoiceCalcResult {
  items:        (LineItem & { amount: number })[]
  subtotal:     number
  tax_rate:     number
  tax_amount:   number
  total_amount: number
}

/**
 * 端数処理
 */
function applyRounding(n: number, method: RoundingMethod): number {
  if (method === 'floor') return Math.floor(n)
  if (method === 'ceil')  return Math.ceil(n)
  return Math.round(n)
}

/**
 * 行金額計算: quantity × unit_price
 */
export function calcLineAmount(
  quantity:   number,
  unit_price: number,
  rounding:   RoundingMethod = 'floor'
): number {
  return applyRounding(quantity * unit_price, rounding)
}

/**
 * 税額計算
 */
export function calcTax(
  subtotal: number,
  tax_rate: number,
  rounding: RoundingMethod = 'floor'
): { tax_amount: number; total_amount: number } {
  const tax_amount   = applyRounding(subtotal * tax_rate, rounding)
  const total_amount = subtotal + tax_amount
  return { tax_amount, total_amount }
}

/**
 * 明細リスト全体の計算
 * 単一税率モデル（請求書全体に1つの税率）
 */
export function calcInvoice(
  items:    LineItem[],
  tax_rate: number      = 0.10,
  rounding: RoundingMethod = 'floor'
): InvoiceCalcResult {
  const calculated = items.map(item => ({
    ...item,
    amount: calcLineAmount(item.quantity, item.unit_price, rounding),
  }))

  const subtotal = calculated.reduce((s, i) => s + i.amount, 0)
  const { tax_amount, total_amount } = calcTax(subtotal, tax_rate, rounding)

  return { items: calculated, subtotal, tax_rate, tax_amount, total_amount }
}

/**
 * 案件単価から請求書明細を自動生成
 * project_prices テーブルのデータを InvoiceLineItem[] に変換
 */
export function buildItemsFromProjectPrice(
  price: {
    id:            string
    amount_ex_tax: number
    tax_rate:      number
    unit_price?:   number | null
    quantity?:     number | null
    period_month?: number | null
    unit_label?:   string | null
  },
  projectType:  'spot' | 'recurring' | 'hotel',
  periodLabel?: string,   // 例: "2026年8月分"
  projectName?: string,
): LineItem[] {
  if (projectType === 'hotel' && price.unit_price && price.quantity) {
    return [
      {
        description: `清掃費 ${projectName ?? ''}${periodLabel ? ` ${periodLabel}` : ''}`,
        quantity:    price.quantity,
        unit:        price.unit_label?.trim() || '室',  // unit_label が NULL の場合は '室' fallback
        unit_price:  price.unit_price,
        source_type: 'project_price',
        source_id:   price.id,
        order_num:   0,
      },
    ]
  }

  return [
    {
      description: `清掃費 ${projectName ?? ''}${periodLabel ? ` ${periodLabel}` : ''}`,
      quantity:    1,
      unit:        '式',
      unit_price:  price.amount_ex_tax,
      source_type: 'project_price',
      source_id:   price.id,
      order_num:   0,
    },
  ]
}

/**
 * 日本語 金額フォーマット
 */
export function fmtJPY(n: number): string {
  return '¥' + n.toLocaleString('ja-JP')
}

/**
 * 期限超過判定
 */
export function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || status === 'paid' || status === 'cancelled') return false
  return new Date(dueDate) < new Date()
}
