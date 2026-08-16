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

const GOLD   = '#c9a227'
const DARK   = '#1a1a1a'
const GRAY1  = '#444444'
const GRAY2  = '#777777'
const GRAY3  = '#aaaaaa'
const BORDER = '#e5e5e5'
const BG_ALT = '#f8f7f5'

const styles = StyleSheet.create({
  // ── ページ ──────────────────────────────────────────────────
  page: {
    fontFamily: 'NotoSansJP',
    fontSize: 10,
    padding: '44 48 60 48',
    backgroundColor: '#ffffff',
  },

  // ── ヘッダー ────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
    paddingBottom: 20,
    borderBottom: `2px solid ${BORDER}`,
  },
  // ヘッダー左：文書種別・番号
  docTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: DARK,
    marginBottom: 10,
    letterSpacing: 2,
  },
  docMeta: {
    fontSize: 9.5,
    color: GRAY2,
    marginTop: 3,
  },
  // ヘッダー右：自社情報
  companyBlock: {
    alignItems: 'flex-end',
    maxWidth: 220,
  },
  companyName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: DARK,
    marginBottom: 7,
  },
  companyDetail: {
    fontSize: 8.5,
    color: GRAY1,
    marginTop: 2,
    textAlign: 'right',
  },
  companyReg: {
    fontSize: 8,
    color: GRAY2,
    marginTop: 5,
    textAlign: 'right',
  },

  // ── セクション共通 ───────────────────────────────────────────
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: GRAY3,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
    paddingBottom: 5,
    borderBottom: `0.75px solid ${BORDER}`,
  },

  // ── 請求先 ──────────────────────────────────────────────────
  clientName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: DARK,
    marginTop: 4,
    marginBottom: 5,
  },
  clientDetail: {
    fontSize: 9,
    color: GRAY2,
    marginTop: 2,
  },

  // ── 件名BOX ─────────────────────────────────────────────────
  subjectBox: {
    backgroundColor: BG_ALT,
    borderLeft: `3px solid ${GOLD}`,
    padding: '10 14',
    marginBottom: 18,
  },
  subjectTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: DARK,
    marginBottom: 4,
  },
  subjectDetail: {
    fontSize: 9,
    color: GRAY2,
    marginTop: 2,
  },

  // ── 明細テーブル ─────────────────────────────────────────────
  table: {
    marginBottom: 4,
    border: `0.75px solid ${BORDER}`,
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: DARK,
    padding: '8 10',
  },
  tableRow: {
    flexDirection: 'row',
    padding: '8 10',
    borderTop: `0.5px solid ${BORDER}`,
  },
  tableAlt: {
    backgroundColor: '#fafaf9',
  },
  col1:  { flex: 3.5 },
  col2:  { flex: 1,   textAlign: 'right' },
  col3:  { flex: 1.2, textAlign: 'right' },
  col4:  { flex: 1.5, textAlign: 'right' },
  colHead: { fontSize: 8, fontWeight: 'bold', color: '#ffffff' },
  colCell: { fontSize: 9, color: DARK },

  // ── 合計エリア ───────────────────────────────────────────────
  totalBox: {
    alignItems: 'flex-end',
    marginTop: 12,
    marginBottom: 18,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 5,
  },
  totalLabel: {
    fontSize: 9,
    color: GRAY2,
    width: 130,
    textAlign: 'right',
    paddingRight: 16,
  },
  totalValue: {
    fontSize: 9.5,
    color: DARK,
    width: 90,
    textAlign: 'right',
  },
  totalDivider: {
    borderTop: `1px solid ${BORDER}`,
    width: 260,
    marginVertical: 6,
  },
  grandTotal: {
    backgroundColor: DARK,
    padding: '9 14',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: 280,
    marginTop: 2,
  },
  grandLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  grandValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: GOLD,
  },

  // ── 振込先BOX ────────────────────────────────────────────────
  bankBox: {
    backgroundColor: BG_ALT,
    border: `0.75px solid ${BORDER}`,
    padding: '10 14',
    marginBottom: 16,
  },
  bankTitle: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: GRAY3,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
    paddingBottom: 5,
    borderBottom: `0.75px solid ${BORDER}`,
  },
  bankText: {
    fontSize: 9.5,
    color: GRAY1,
    marginTop: 3,
  },
  bankSub: {
    fontSize: 8.5,
    color: GRAY2,
    marginTop: 2,
  },

  // ── 備考 ─────────────────────────────────────────────────────
  notes: {
    fontSize: 9,
    color: GRAY1,
    lineHeight: 1.7,
  },

  // ── フッター ─────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 48,
    right: 48,
    borderTop: `0.5px solid ${BORDER}`,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 7,
    color: GRAY3,
  },
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

        {/* ── ヘッダー ── */}
        <View style={styles.header}>
          {/* 左：文書種別・番号 */}
          <View>
            <Text style={styles.docTitle}>{docTitle}</Text>
            <Text style={styles.docMeta}>No. {data.invoice_number}</Text>
            <Text style={styles.docMeta}>発行日: {data.issue_date}</Text>
            {data.due_date && (
              <Text style={styles.docMeta}>{dueLabel}: {data.due_date}</Text>
            )}
          </View>

          {/* 右：自社情報 */}
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>{data.company_name}</Text>
            {data.company_postal_code && (
              <Text style={styles.companyDetail}>〒{data.company_postal_code}</Text>
            )}
            {data.company_address && (
              <Text style={styles.companyDetail}>{data.company_address}</Text>
            )}
            {data.company_phone && (
              <Text style={styles.companyDetail}>TEL: {data.company_phone}</Text>
            )}
            {data.company_email && (
              <Text style={styles.companyDetail}>{data.company_email}</Text>
            )}
            {data.company_invoice_registration_number && (
              <Text style={styles.companyReg}>
                登録番号: {data.company_invoice_registration_number}
              </Text>
            )}
          </View>
        </View>

        {/* ── 請求先 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{isInvoice ? '請求先' : '見積先'}</Text>
          <Text style={styles.clientName}>{data.client_name} 御中</Text>
          {data.client_contact && (
            <Text style={styles.clientDetail}>担当: {data.client_contact}</Text>
          )}
          {data.client_address && (
            <Text style={styles.clientDetail}>{data.client_address}</Text>
          )}
          {data.payment_terms && (
            <Text style={[styles.clientDetail, { marginTop: 5 }]}>支払条件: {data.payment_terms}</Text>
          )}
          {closingDayText && (
            <Text style={styles.clientDetail}>締日: {closingDayText}</Text>
          )}
        </View>

        {/* ── 件名BOX ── */}
        {(data.title || data.project_name) && (
          <View style={styles.subjectBox}>
            <Text style={styles.subjectTitle}>
              {data.title ?? `${data.project_name} に関する${docTitle}`}
            </Text>
            {data.billing_period_from && data.billing_period_to && (
              <Text style={styles.subjectDetail}>
                対象期間: {data.billing_period_from} 〜 {data.billing_period_to}
              </Text>
            )}
          </View>
        )}

        {/* ── 明細テーブル ── */}
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

        {/* ── 合計（税率別対象額 + DB保存合計） ── */}
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
          {/* 合計前の区切り線 */}
          <View style={styles.totalDivider} />
          <View style={styles.grandTotal}>
            <Text style={styles.grandLabel}>{isInvoice ? '請求金額' : '合計金額（税込）'}</Text>
            <Text style={styles.grandValue}>{fmtJPY(data.total_amount)}</Text>
          </View>
        </View>

        {/* ── 振込先BOX（請求書のみ） ── */}
        {isInvoice && hasBankInfo && (
          <View style={styles.bankBox}>
            <Text style={styles.bankTitle}>振込先</Text>
            {(data.bank_name || data.bank_branch_name) && (
              <Text style={styles.bankText}>
                {[data.bank_name, data.bank_branch_name].filter(Boolean).join('　')}
              </Text>
            )}
            {(data.bank_account_type || data.bank_account_number) && (
              <Text style={styles.bankText}>
                {[data.bank_account_type, data.bank_account_number].filter(Boolean).join('　')}
              </Text>
            )}
            {data.bank_account_holder && (
              <Text style={styles.bankText}>口座名義: {data.bank_account_holder}</Text>
            )}
            {data.bank_account_holder_kana && (
              <Text style={styles.bankSub}>（{data.bank_account_holder_kana}）</Text>
            )}
          </View>
        )}

        {/* ── 備考 ── */}
        {data.notes && (
          <View style={[styles.section, { marginTop: 4 }]}>
            <Text style={styles.sectionTitle}>備考</Text>
            <Text style={styles.notes}>{data.notes}</Text>
          </View>
        )}

        {/* ── フッター ── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{data.company_name}</Text>
          <Text style={styles.footerText}>{data.invoice_number}　|　{docTitle}</Text>
        </View>

      </Page>
    </Document>
  )
}
