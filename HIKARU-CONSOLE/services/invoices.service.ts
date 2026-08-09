// ============================================================
// 請求書・見積書サービス（Console UI用）
// ============================================================

export type InvoiceType   = 'quote' | 'invoice'
export type InvoiceStatus = 'draft' | 'issued' | 'accepted' | 'rejected' | 'sent' | 'awaiting_payment' | 'paid' | 'overdue' | 'cancelled'

export interface InvoiceRow {
  id:                   string
  company_id:           string
  client_id:            string
  project_id:           string | null
  invoice_type:         InvoiceType
  invoice_number:       string
  converted_from_id:    string | null
  issue_date:           string
  due_date:             string | null
  billing_period_from:  string | null
  billing_period_to:    string | null
  period_month:         number | null
  subtotal:             number
  tax_rate:             number
  tax_amount:           number
  total_amount:         number
  rounding_method:      string
  status:               InvoiceStatus
  published_to_portal:  boolean
  published_at:         string | null
  pdf_path:             string | null
  pdf_generated_at:     string | null
  paid_amount:          number
  paid_at:              string | null
  title:                string | null
  notes:                string | null
  internal_memo:        string | null
  created_by:           string | null
  issued_by:            string | null
  issued_at:            string | null
  published_by:         string | null
  cancelled_by:         string | null
  cancelled_at:         string | null
  cancel_reason:        string | null
  created_at:           string
  updated_at:           string
  // joined
  clients?:  { id: string; name: string; email?: string; phone?: string; address?: string; contact_name?: string } | null
  projects?: { id: string; name: string; project_type: string; location_name?: string } | null
  creator?:  { id: string; name: string } | null
  issuer?:   { id: string; name: string } | null
  invoice_items?: InvoiceItem[]
  invoice_payments?: InvoicePayment[]
}

export interface InvoiceItem {
  id:          string
  invoice_id:  string
  order_num:   number
  description: string
  quantity:    number
  unit:        string | null
  unit_price:  number
  amount:      number
  tax_rate:    number
  source_type: string | null
  source_id:   string | null
}

export interface InvoicePayment {
  id:             string
  invoice_id:     string
  amount:         number
  paid_at:        string
  payment_method: string | null
  notes:          string | null
  recorded_by:    string | null
  created_at:     string
}

export interface InvoiceKpi {
  quotes_draft:       number
  quotes_issued:      number
  invoices_awaiting:  number
  invoices_paid:      number
  invoices_overdue:   number
  total_billed:       number
  total_paid:         number
  total_unpaid:       number
}

// ── ステータスラベル・バリアント ──────────────────────────

export const QUOTE_STATUS_LABEL: Record<string, string> = {
  draft:     '下書き',
  issued:    '発行済み',
  accepted:  '承認済み',
  rejected:  '却下',
  cancelled: 'キャンセル',
}

export const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft:            '下書き',
  issued:           '発行済み',
  sent:             '送付済み',
  awaiting_payment: '入金待ち',
  paid:             '入金済み',
  overdue:          '期限超過',
  cancelled:        'キャンセル',
}

export const STATUS_VARIANT: Record<string, string> = {
  draft:            'secondary',
  issued:           'info',
  accepted:         'success',
  rejected:         'error',
  sent:             'info',
  awaiting_payment: 'warning',
  paid:             'success',
  overdue:          'error',
  cancelled:        'secondary',
}

// ── API関数 ──────────────────────────────────────────────

export async function listInvoices(params?: {
  invoice_type?: InvoiceType
  status?: string
  client_id?: string
  project_id?: string
  date_from?: string
  date_to?: string
}): Promise<{ invoices: InvoiceRow[]; kpi: InvoiceKpi }> {
  const sp = new URLSearchParams()
  if (params?.invoice_type) sp.set('invoice_type', params.invoice_type)
  if (params?.status)       sp.set('status',       params.status)
  if (params?.client_id)    sp.set('client_id',    params.client_id)
  if (params?.project_id)   sp.set('project_id',   params.project_id)
  if (params?.date_from)    sp.set('date_from',    params.date_from)
  if (params?.date_to)      sp.set('date_to',      params.date_to)

  const res = await fetch(`/api/invoices?${sp}`, { credentials: 'include', cache: 'no-store' })
  if (!res.ok) throw new Error((await res.json()).error)
  return res.json()
}

export async function getInvoice(id: string): Promise<InvoiceRow> {
  const res = await fetch(`/api/invoices/${id}`, { credentials: 'include', cache: 'no-store' })
  if (!res.ok) throw new Error((await res.json()).error)
  const json = await res.json()
  return json.invoice
}

export async function createInvoice(body: Record<string, unknown>): Promise<InvoiceRow> {
  const res = await fetch('/api/invoices', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) throw new Error((await res.json()).error)
  return (await res.json()).invoice
}

export async function updateInvoice(id: string, body: Record<string, unknown>): Promise<InvoiceRow> {
  const res = await fetch(`/api/invoices/${id}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) throw new Error((await res.json()).error)
  return (await res.json()).invoice
}

export async function deleteInvoice(id: string): Promise<void> {
  const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error((await res.json()).error)
}

export async function changeInvoiceStatus(id: string, status: string, cancelReason?: string) {
  const res = await fetch(`/api/invoices/${id}/status`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ status, cancel_reason: cancelReason }),
  })
  if (!res.ok) throw new Error((await res.json()).error)
  return (await res.json()).invoice
}

export async function generatePdf(id: string): Promise<{ pdf_path: string; signed_url: string }> {
  const res = await fetch(`/api/invoices/${id}/pdf`, { method: 'POST' })
  if (!res.ok) throw new Error((await res.json()).error)
  return res.json()
}

export async function publishInvoice(id: string): Promise<InvoiceRow> {
  const res = await fetch(`/api/invoices/${id}/publish`, { method: 'POST' })
  if (!res.ok) throw new Error((await res.json()).error)
  return (await res.json()).invoice
}

export async function convertToInvoice(
  id: string, opts: { issue_date?: string; due_date?: string }
): Promise<InvoiceRow> {
  const res = await fetch(`/api/invoices/${id}/convert`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(opts),
  })
  if (!res.ok) throw new Error((await res.json()).error)
  return (await res.json()).invoice
}

export async function recordPayment(id: string, body: {
  amount: number; paid_at: string; payment_method?: string; notes?: string
}) {
  const res = await fetch(`/api/invoices/${id}/payment`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) throw new Error((await res.json()).error)
  return res.json()
}

// ── ユーティリティ ────────────────────────────────────────

export function fmtDate(d?: string | null): string {
  if (!d) return '—'
  const date = new Date(d)
  return `${date.getFullYear()}/${String(date.getMonth()+1).padStart(2,'0')}/${String(date.getDate()).padStart(2,'0')}`
}

export function fmtMoney(n?: number | null): string {
  if (n == null) return '—'
  return '¥' + n.toLocaleString('ja-JP')
}

export function isOverdue(dueDate?: string | null, status?: string): boolean {
  if (!dueDate || status === 'paid' || status === 'cancelled') return false
  return new Date(dueDate) < new Date()
}
