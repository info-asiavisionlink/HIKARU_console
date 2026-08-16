/**
 * HIKARU 見積書・請求書 PDF テンプレート
 * @react-pdf/renderer 使用
 */
import React from 'react'
import path from 'path'
import {
  Document, Page, Text, View, StyleSheet, Font,
} from '@react-pdf/renderer'
import { fmtJPY } from './calculator'

// 日本語フォント登録（Noto Sans JP - public/fonts/NotoSansJP-Regular.otf）
Font.register({
  family: 'NotoSansJP',
  src: path.join(process.cwd(), 'public', 'fonts', 'NotoSansJP-Regular.otf'),
})

const styles = StyleSheet.create({
  page:       { fontFamily: 'NotoSansJP', fontSize: 10, padding: 40, backgroundColor: '#ffffff' },
  header:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  title:      { fontSize: 22, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 4 },
  subtitle:   { fontSize: 11, color: '#555555' },
  number:     { fontSize: 10, color: '#777777', marginTop: 2 },
  section:    { marginBottom: 16 },
  sectionTitle: { fontSize: 8, fontWeight: 'bold', color: '#999999', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, borderBottom: '1px solid #eeeeee', paddingBottom: 4 },
  row:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  label:      { fontSize: 9, color: '#777777' },
  value:      { fontSize: 10, color: '#1a1a1a' },
  table:      { marginBottom: 16 },
  tableHead:  { flexDirection: 'row', backgroundColor: '#f5f5f5', padding: '6 8', borderBottom: '1.5px solid #dddddd' },
  tableRow:   { flexDirection: 'row', padding: '5 8', borderBottom: '0.5px solid #eeeeee' },
  tableAlt:   { backgroundColor: '#fafafa' },
  col1:       { flex: 3 },
  col2:       { flex: 1, textAlign: 'right' },
  col3:       { flex: 1, textAlign: 'right' },
  col4:       { flex: 1.5, textAlign: 'right' },
  colHead:    { fontSize: 8, fontWeight: 'bold', color: '#555555' },
  colCell:    { fontSize: 9, color: '#1a1a1a' },
  totalBox:   { alignItems: 'flex-end', marginBottom: 20 },
  totalRow:   { flexDirection: 'row', justifyContent: 'flex-end', gap: 32, marginBottom: 4 },
  totalLabel: { fontSize: 9, color: '#777777', width: 110, textAlign: 'right' },
  totalValue: { fontSize: 10, color: '#1a1a1a', width: 100, textAlign: 'right' },
  grandTotal: { backgroundColor: '#1a1a1a', padding: '6 12', flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  grandLabel: { fontSize: 11, fontWeight: 'bold', color: '#ffffff' },
  grandValue: { fontSize: 14, fontWeight: 'bold', color: '#c9a227' },
  footer:     { position: 'absolute', bottom: 30, left: 40, right: 40, borderTop: '0.5px solid #dddddd', paddingTop: 8 },
  footerText: { fontSize: 7, color: '#aaaaaa', textAlign: 'center' },
  notes:      { fontSize: 9, color: '#444444', lineHeight: 1.6 },
  dueBadge:   { backgroundColor: '#c9a227', padding: '3 8', alignSelf: 'flex-start', marginBottom: 8 },
  dueLabel:   { color: '#ffffff', fontSize: 9, fontWeight: 'bold' },
})

export interface PDFInvoiceData {
  // 文書情報
  invoice_type:    'quote' | 'invoice'
  invoice_number:  string
  issue_date:      string
  due_date?:       string | null
  title?:          string | null
  status:          string
  billing_period_from?: string | null
  billing_period_to?:   string | null

  // 発行元（自社）既存
  company_name:    string
  company_address?: string | null
  company_phone?:   string | null
  company_email?:   string | null

  // 発行元（自社）Phase 3追加
  company_postal_code?:                 string | null
  company_invoice_registration_number?: string | null

  // 振込先（請求書のみ表示）
  bank_name?:                string | null
  bank_branch_name?:         string | null
  bank_account_type?:        string | null
  bank_account_number?:      string | null
  bank_account_holder?:      string | null
  bank_account_holder_kana?: string | null

  // 請求先（顧客）
  client_name:          string
  client_address?:       string | null
  client_phone?:         string | null
  client_email?:         string | null
  client_contact?:       string | null
  client_invoice_email?: string | null  // 将来のメール送信用（PDF非表示）

  // 支払条件
  payment_terms?: string | null
  closing_day?:   number | null

  // 案件
  project_name?:   string | null

  // 明細
  items: {
    description: string
    quantity:    number
    unit?:       string | null
    unit_price:  number
    amount:      number
    tax_rate?:   number  // Phase 3追加: 税率別集計のため
  }[]

  // 金額（DB保存値をそのまま使用）
  subtotal:     number
  tax_rate:     number
  tax_amount:   number
  total_amount: number

  // 備考
  notes?:       string | null
}

export function InvoicePDF({ data }: { data: PDFInvoiceData }) {
  const isInvoice  = data.invoice_type === 'invoice'
  const docTitle   = isInvoice ? '請求書' : '見積書'
  const dueLabel   = isInvoice ? '支払期限' : '有効期限'

  const closingDayText = data.closing_day != null
    ? (data.closing_day === 31 ? '月末締め' : `毎月${data.closing_day}日締め`)
    : null

  // 税率別集計（PDF表示用のみ。DB保存金額は変更しない）
  const taxByRate = data.items.reduce<Record<number, number>>((acc, item) => {
    const r = item.tax_rate ?? data.tax_rate
    acc[r] = (acc[r] ?? 0) + item.amount
    return acc
  }, {})
  const taxRates = Object.keys(taxByRate).map(Number).sort((a, b) => a - b)

  // 振込先: 1項目以上あれば表示
  const hasBankInfo = !!(
    data.bank_name || data.bank_branch_name ||
    data.bank_account_type || data.bank_account_number ||
    data.bank_account_holder
  )

  return (
    <Document title={`${docTitle} ${data.invoice_number}`}>
      <Page size="A4" style={styles.page}>

        {/* ヘッダー */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{docTitle}</Text>
            <Text style={styles.number}>No. {data.invoice_number}</Text>
            <Text style={styles.number}>発行日: {data.issue_date}</Text>
            {data.due_date && (
              <Text style={styles.number}>{dueLabel}: {data.due_date}</Text>
            )}
          </View>
          {/* 自社情報（右上） */}
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1a1a1a' }}>{data.company_name}</Text>
            {data.company_postal_code && (
              <Text style={styles.label}>〒{data.company_postal_code}</Text>
            )}
            {data.company_address && <Text style={styles.label}>{data.company_address}</Text>}
            {data.company_phone   && <Text style={styles.label}>TEL: {data.company_phone}</Text>}
            {data.company_email   && <Text style={styles.label}>{data.company_email}</Text>}
            {data.company_invoice_registration_number && (
              <Text style={styles.label}>登録番号: {data.company_invoice_registration_number}</Text>
            )}
          </View>
        </View>

        {/* 請求先 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>請求先</Text>
          <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 3 }}>
            {data.client_name} 御中
          </Text>
          {data.client_contact  && <Text style={styles.label}>担当: {data.client_contact}</Text>}
          {data.client_address  && <Text style={styles.label}>{data.client_address}</Text>}
          {data.payment_terms   && <Text style={[styles.label, { marginTop: 4 }]}>支払条件: {data.payment_terms}</Text>}
          {closingDayText        && <Text style={styles.label}>締日: {closingDayText}</Text>}
        </View>

        {/* 件名 */}
        {(data.title || data.project_name) && (
          <View style={[styles.section, { backgroundColor: '#f9f8f6', padding: '8 10', marginBottom: 16 }]}>
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#1a1a1a' }}>
              {data.title ?? `${data.project_name} に関する${docTitle}`}
            </Text>
            {data.billing_period_from && data.billing_period_to && (
              <Text style={styles.label}>
                対象期間: {data.billing_period_from} 〜 {data.billing_period_to}
              </Text>
            )}
          </View>
        )}

        {/* 明細テーブル */}
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.colHead, styles.col1]}>内容</Text>
            <Text style={[styles.colHead, styles.col2]}>数量</Text>
            <Text style={[styles.colHead, styles.col3]}>単価</Text>
            <Text style={[styles.colHead, styles.col4]}>金額（税抜）</Text>
          </View>
          {data.items.map((item, i) => (
            <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableAlt : {}]}>
              <Text style={[styles.colCell, styles.col1]}>{item.description}</Text>
              <Text style={[styles.colCell, styles.col2]}>
                {item.quantity}{item.unit ? ` ${item.unit}` : ''}
              </Text>
              <Text style={[styles.colCell, styles.col3]}>{fmtJPY(item.unit_price)}</Text>
              <Text style={[styles.colCell, styles.col4]}>{fmtJPY(item.amount)}</Text>
            </View>
          ))}
        </View>

        {/* 合計（税率別対象額 + DB保存合計） */}
        <View style={styles.totalBox}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>小計（税抜）</Text>
            <Text style={styles.totalValue}>{fmtJPY(data.subtotal)}</Text>
          </View>
          {taxRates.map(rate => {
            const pct  = Math.round(rate * 100)
            const base = taxByRate[rate]
            const tax  = Math.floor(base * rate)
            return (
              <React.Fragment key={rate}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>{pct}%対象額</Text>
                  <Text style={styles.totalValue}>{fmtJPY(base)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>消費税額（{pct}%）</Text>
                  <Text style={styles.totalValue}>{fmtJPY(tax)}</Text>
                </View>
              </React.Fragment>
            )
          })}
          <View style={[styles.grandTotal, { width: 260 }]}>
            <Text style={styles.grandLabel}>{isInvoice ? '請求金額' : '合計金額（税込）'}</Text>
            <Text style={styles.grandValue}>{fmtJPY(data.total_amount)}</Text>
          </View>
        </View>

        {/* 振込先（請求書のみ） */}
        {isInvoice && hasBankInfo && (
          <View style={[styles.section, { marginTop: 4 }]}>
            <Text style={styles.sectionTitle}>振込先</Text>
            {(data.bank_name || data.bank_branch_name) && (
              <Text style={styles.label}>
                {[data.bank_name, data.bank_branch_name].filter(Boolean).join(' ')}
              </Text>
            )}
            {(data.bank_account_type || data.bank_account_number) && (
              <Text style={styles.label}>
                {[data.bank_account_type, data.bank_account_number].filter(Boolean).join(' ')}
              </Text>
            )}
            {data.bank_account_holder && (
              <Text style={styles.label}>口座名義: {data.bank_account_holder}</Text>
            )}
            {data.bank_account_holder_kana && (
              <Text style={styles.label}>（{data.bank_account_holder_kana}）</Text>
            )}
          </View>
        )}

        {/* 備考 */}
        {data.notes && (
          <View style={[styles.section, { marginTop: 8 }]}>
            <Text style={styles.sectionTitle}>備考</Text>
            <Text style={styles.notes}>{data.notes}</Text>
          </View>
        )}

        {/* フッター */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {data.company_name} | {data.invoice_number} | {docTitle}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
