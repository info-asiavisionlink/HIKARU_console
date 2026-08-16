import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { getEmailConfig } from '@/lib/email/config'
import { buildDocumentEmail } from '@/lib/email/document-template'

// ── 送信可能なstatus ──────────────────────────────────────────────
// invoice: issued / sent / awaiting_payment / overdue
// quote:   issued のみ（draft・cancelled・accepted・rejected は対象外）
const INVOICE_SENDABLE = ['issued', 'sent', 'awaiting_payment', 'overdue']
const QUOTE_SENDABLE   = ['issued']

function getSendableStatuses(invoiceType: string): string[] {
  return invoiceType === 'quote' ? QUOTE_SENDABLE : INVOICE_SENDABLE
}

// 書類種別に応じた送信先を決定（サーバー側確定）
// invoice: clients.invoice_email → clients.email
// quote:   clients.email のみ（invoice_email は請求書専用）
function resolveRecipient(
  client: { email?: string | null; invoice_email?: string | null } | null,
  invoiceType: string
): string | null {
  if (!client) return null
  if (invoiceType === 'invoice') {
    return client.invoice_email?.trim() || client.email?.trim() || null
  }
  return client.email?.trim() || null
}

// ─────────────────────────────────────────────────────────────────
// GET /api/invoices/[id]/email
// メール送信プレビュー情報を返す。実際のメール送信は行わない。
//
// レスポンス:
//   configured     boolean     Resend設定が完了しているか
//   to_email       string|null 送信先
//   subject        string      メール件名
//   body_text      string      メール本文
//   pdf_available  boolean     PDFが生成・保存済みか
//   pdf_filename   string|null PDFファイル名
//   can_send       boolean     現時点で送信可能かどうか
//   reason         string|null 送信不可の理由
//   is_resend      boolean     過去に同invoice_idで送信済みか
// ─────────────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── 1. invoice取得・ownership確認 ────────────────────────────
  const { data: invoice } = await auth.adminClient
    .from('invoices')
    .select(`
      id, invoice_number, invoice_type, status,
      total_amount, due_date, title, pdf_path,
      client_id,
      clients:client_id (name, email, invoice_email),
      projects:project_id (name)
    `)
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .single()

  if (!invoice) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

  const invoiceType = invoice.invoice_type as 'invoice' | 'quote'
  const client      = invoice.clients  as any

  // ── 2. 自社名取得 ────────────────────────────────────────────
  const { data: company } = await auth.adminClient
    .from('companies')
    .select('name')
    .eq('id', auth.companyId)
    .single()

  const companyName = company?.name ?? 'HIKARU'

  // ── 3. 送信先決定（サーバー側確定・ブラウザ値不使用）──────────
  const toEmail = resolveRecipient(client, invoiceType)

  // ── 4. メール設定確認（API key値はレスポンスに含めない）────────
  const emailConfig = getEmailConfig()

  // ── 5. 件名・本文生成 ─────────────────────────────────────────
  const { subject, bodyText } = buildDocumentEmail({
    invoiceType,
    invoiceNumber: invoice.invoice_number,
    clientName:    client?.name ?? '顧客',
    companyName,
    totalAmount:   Number(invoice.total_amount),
    dueDate:       invoice.due_date ?? null,
  })

  // ── 6. PDF確認 ────────────────────────────────────────────────
  const pdfAvailable = Boolean(invoice.pdf_path)
  const pdfFilename  = pdfAvailable ? `${invoice.invoice_number}.pdf` : null

  // ── 7. 送信可否判定 ───────────────────────────────────────────
  const docLabel = invoiceType === 'quote' ? '見積書' : '請求書'
  let canSend = true
  let reason: string | null = null

  if (!getSendableStatuses(invoiceType).includes(invoice.status)) {
    canSend = false
    reason  = `${invoice.status === 'draft' ? '下書き' : invoice.status}の${docLabel}はメール送信できません。先に発行してください。`
  } else if (!toEmail) {
    canSend = false
    reason  = invoiceType === 'quote'
      ? '顧客のメールアドレスが設定されていません。顧客管理から設定してください。'
      : '顧客の請求書送付先メールアドレスが設定されていません。顧客管理から設定してください。'
  } else if (!emailConfig.configured) {
    canSend = false
    reason  = 'メール送信設定が完了していません。管理者にお問い合わせください。'
  }

  // ── 8. 再送判定 ───────────────────────────────────────────────
  const { data: existingLogs } = await auth.adminClient
    .from('document_email_logs')
    .select('id')
    .eq('invoice_id', id)
    .eq('company_id', auth.companyId)
    .eq('status', 'sent')
    .limit(1)

  const isResend = (existingLogs?.length ?? 0) > 0

  return NextResponse.json({
    configured:    emailConfig.configured,
    to_email:      toEmail,
    subject,
    body_text:     bodyText,
    pdf_available: pdfAvailable,
    pdf_filename:  pdfFilename,
    can_send:      canSend,
    reason,
    is_resend:     isResend,
  })
}

// ─────────────────────────────────────────────────────────────────
// POST /api/invoices/[id]/email
// メール送信エンドポイント（骨格）。
//
// ※ 現フェーズでは実送信を行わない。
//    resend.emails.send() は呼ばない。
//    Resend設定が完了している場合でも安全停止する。
// ─────────────────────────────────────────────────────────────────
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── 1. invoice取得・ownership確認 ────────────────────────────
  const { data: invoice } = await auth.adminClient
    .from('invoices')
    .select('id, invoice_number, invoice_type, status, client_id, pdf_path, company_id')
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .single()

  if (!invoice) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

  const invoiceType = invoice.invoice_type as 'invoice' | 'quote'

  // ── 2. status確認 ────────────────────────────────────────────
  if (!getSendableStatuses(invoiceType).includes(invoice.status)) {
    return NextResponse.json(
      { error: '下書きまたは完了済みの書類はメール送信できません。先に発行してください。' },
      { status: 400 }
    )
  }

  // ── 3. 送信先確認（サーバー側確定） ──────────────────────────
  const { data: client } = await auth.adminClient
    .from('clients')
    .select('email, invoice_email')
    .eq('id', invoice.client_id)
    .eq('company_id', auth.companyId)
    .single()

  const toEmail = resolveRecipient(client, invoiceType)
  if (!toEmail) {
    const msg = invoiceType === 'quote'
      ? '顧客のメールアドレスが設定されていません。顧客管理から設定してください。'
      : '顧客の請求書送付先メールアドレスが設定されていません。顧客管理から設定してください。'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // ── 4. メール設定確認 ─────────────────────────────────────────
  const emailConfig = getEmailConfig()
  if (!emailConfig.configured) {
    return NextResponse.json(
      { error: 'メール送信設定が完了していません。RESEND_API_KEY と EMAIL_FROM を設定してください。' },
      { status: 503 }
    )
  }

  // ── STEP: ENABLE_ACTUAL_SEND ──────────────────────────────────
  // 将来フェーズでここに実送信コードを実装する。
  // resend.emails.send(...) はここでのみ呼ぶ。
  // ─────────────────────────────────────────────────────────────
  return NextResponse.json(
    { error: '実送信機能は現在準備中です。しばらくお待ちください。' },
    { status: 503 }
  )
}
