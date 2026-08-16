/**
 * 請求書・見積書のメール本文テンプレート
 *
 * 会社名・顧客名・書類番号・金額・期限はDB値から生成する。
 * HTML不使用。text/plain 相当で安全に構成。
 */

import { fmtJPY } from '@/lib/billing/calculator'

export interface DocumentEmailParams {
  invoiceType:   'invoice' | 'quote'
  invoiceNumber: string
  clientName:    string
  companyName:   string
  totalAmount:   number
  dueDate?:      string | null
}

export interface DocumentEmailContent {
  subject:  string
  bodyText: string
}

export function buildDocumentEmail(params: DocumentEmailParams): DocumentEmailContent {
  const {
    invoiceType, invoiceNumber, clientName,
    companyName, totalAmount, dueDate,
  } = params

  const isInvoice  = invoiceType === 'invoice'
  const docLabel   = isInvoice ? '請求書' : '見積書'
  const dueLabel   = isInvoice ? '支払期限' : '有効期限'

  const subject = `【${companyName}】${docLabel} ${invoiceNumber} のご送付`

  const dueLine = dueDate
    ? `${dueLabel}：${dueDate}\n`
    : ''

  const bodyText = [
    `${clientName} 御中`,
    '',
    `平素よりお世話になっております。`,
    `${companyName} です。`,
    '',
    `下記${docLabel}をお送りいたします。`,
    `ご確認のほど、何卒よろしくお願いいたします。`,
    '',
    '─────────────────────────────',
    `書類番号：${invoiceNumber}`,
    `金　　額：${fmtJPY(totalAmount)}（税込）`,
    dueLine.trimEnd(),
    '─────────────────────────────',
    '',
    'PDFを添付しておりますのでご確認ください。',
    '',
    'ご不明な点がございましたら、お気軽にお問い合わせください。',
    '',
    companyName,
  ].filter(line => line !== undefined).join('\n')

  return { subject, bodyText }
}
