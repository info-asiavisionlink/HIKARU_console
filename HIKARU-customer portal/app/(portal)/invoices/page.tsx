import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { FileSpreadsheet, FileText, Download, CreditCard, CheckCircle, AlertCircle, Clock } from 'lucide-react'

const GOLD     = 'oklch(0.73 0.12 78)'
const TEXT     = 'oklch(0.92 0.006 60)'
const MUTED    = 'oklch(0.55 0.008 60)'
const BG_CARD  = 'oklch(0.09 0.003 260)'
const BORDER   = 'oklch(0.14 0.005 260)'
const SUCCESS  = 'oklch(0.72 0.18 150)'
const WARNING  = 'oklch(0.82 0.17 83)'
const ERROR    = 'oklch(0.65 0.25 27)'

type InvoiceRow = {
  id:               string
  invoice_type:     'quote' | 'invoice'
  invoice_number:   string
  issue_date:       string
  due_date:         string | null
  title:            string | null
  status:           string
  total_amount:     number
  paid_amount:      number
  pdf_path:         string | null
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  const dt = new Date(d)
  return `${dt.getFullYear()}/${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}`
}
function fmtMoney(n: number) {
  return '¥' + n.toLocaleString('ja-JP')
}
function isOverdue(due?: string | null, status?: string) {
  if (!due || status === 'paid' || status === 'cancelled') return false
  return new Date(due) < new Date()
}

const STATUS_LABEL: Record<string, string> = {
  draft: '下書き', issued: '発行済み', accepted: '承認済み',
  rejected: '却下', sent: '送付済み', awaiting_payment: '入金待ち',
  paid: '入金済み', overdue: '期限超過', cancelled: 'キャンセル',
}

export default async function PortalInvoicesPage() {
  const cookieStore = await cookies()
  const uid = cookieStore.get('hk_cp_uid')?.value
  if (!uid) redirect('/login')

  const admin = createAdminClient()

  const { data: account } = await admin
    .from('client_portal_accounts')
    .select('id, client_id, company_id')
    .eq('profile_id', uid)
    .eq('is_active', true)
    .single()

  if (!account) redirect('/login')

  // 公開済み見積書・請求書を取得（RLSにより自社案件のみ）
  const { data: invoices } = await admin
    .from('invoices')
    .select('id, invoice_type, invoice_number, issue_date, due_date, title, status, total_amount, paid_amount, pdf_path')
    .eq('company_id', account.company_id)
    .eq('client_id', account.client_id)
    .eq('published_to_portal', true)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })

  const quotes   = (invoices ?? []).filter(i => i.invoice_type === 'quote')
  const bills    = (invoices ?? []).filter(i => i.invoice_type === 'invoice')
  const unpaidCount = bills.filter(b => ['awaiting_payment','overdue'].includes(b.status)).length

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      {/* ページヘッダー */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: TEXT, marginBottom: '4px' }}>
          請求・書類
        </h1>
        <p style={{ fontSize: '13px', color: MUTED }}>
          {invoices?.length ?? 0}件の書類
          {unpaidCount > 0 && <span style={{ color: WARNING, marginLeft: '8px' }}>· 未払い {unpaidCount}件</span>}
        </p>
      </div>

      {/* 見積書セクション */}
      {quotes.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet size={15} /> 見積書 ({quotes.length}件)
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {quotes.map(inv => (
              <InvoiceCard key={inv.id} inv={inv} companyId={account.company_id} />
            ))}
          </div>
        </section>
      )}

      {/* 請求書セクション */}
      {bills.length > 0 && (
        <section>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={15} /> 請求書 ({bills.length}件)
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {bills.map(inv => (
              <InvoiceCard key={inv.id} inv={inv} companyId={account.company_id} />
            ))}
          </div>
        </section>
      )}

      {/* 書類なし */}
      {(invoices ?? []).length === 0 && (
        <div style={{
          background: BG_CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: '12px',
          padding: '48px 24px',
          textAlign: 'center',
        }}>
          <FileSpreadsheet size={40} style={{ color: MUTED, margin: '0 auto 12px' }} />
          <p style={{ color: MUTED, fontSize: '14px' }}>書類がありません</p>
          <p style={{ color: MUTED, fontSize: '12px', marginTop: '4px' }}>
            見積書・請求書が発行されるとここに表示されます
          </p>
        </div>
      )}
    </div>
  )
}

function InvoiceCard({ inv, companyId }: { inv: InvoiceRow; companyId: string }) {
  const GOLD     = 'oklch(0.73 0.12 78)'
  const TEXT     = 'oklch(0.92 0.006 60)'
  const MUTED    = 'oklch(0.55 0.008 60)'
  const BG_CARD  = 'oklch(0.09 0.003 260)'
  const BORDER   = 'oklch(0.14 0.005 260)'
  const SUCCESS  = 'oklch(0.72 0.18 150)'
  const WARNING  = 'oklch(0.82 0.17 83)'
  const ERROR    = 'oklch(0.65 0.25 27)'

  const over    = isOverdue(inv.due_date, inv.status)
  const isPaid  = inv.status === 'paid'
  const isInvoice = inv.invoice_type === 'invoice'

  const statusColor =
    isPaid        ? SUCCESS :
    over          ? ERROR   :
    ['awaiting_payment','issued','sent'].includes(inv.status) ? WARNING :
    MUTED

  const StatusIcon =
    isPaid       ? CheckCircle :
    over         ? AlertCircle :
    isInvoice    ? CreditCard  :
    Clock

  return (
    <div style={{
      background: BG_CARD,
      border: `1px solid ${over ? `${ERROR}40` : BORDER}`,
      borderRadius: '10px',
      padding: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 600, color: TEXT }}>
              {inv.invoice_number}
            </span>
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '99px',
              background: `${statusColor}18`,
              color: statusColor,
              border: `1px solid ${statusColor}30`,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <StatusIcon size={11} />
              {STATUS_LABEL[inv.status] ?? inv.status}
            </span>
            {over && (
              <span style={{ fontSize: '11px', color: ERROR, fontWeight: 600 }}>期限超過</span>
            )}
          </div>

          {inv.title && (
            <p style={{ fontSize: '13px', color: TEXT, marginBottom: '4px' }}>{inv.title}</p>
          )}

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
            <span style={{ fontSize: '12px', color: MUTED }}>発行: {fmtDate(inv.issue_date)}</span>
            {inv.due_date && (
              <span style={{ fontSize: '12px', color: over ? ERROR : MUTED }}>
                {isInvoice ? '支払期限' : '有効期限'}: {fmtDate(inv.due_date)}
              </span>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontSize: '16px', fontWeight: 700, color: TEXT }}>
            {fmtMoney(inv.total_amount)}
          </p>
          {isInvoice && inv.paid_amount > 0 && !isPaid && (
            <p style={{ fontSize: '11px', color: SUCCESS }}>
              入金済み {fmtMoney(inv.paid_amount)}
            </p>
          )}
        </div>
      </div>

      {/* PDFダウンロード */}
      {inv.pdf_path && (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${BORDER}` }}>
          <a
            href={`/api/portal/invoices/${inv.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: GOLD,
              textDecoration: 'none',
              padding: '6px 12px',
              border: `1px solid ${GOLD}40`,
              borderRadius: '8px',
            }}
          >
            <Download size={13} /> PDFをダウンロード
          </a>
        </div>
      )}
    </div>
  )
}
