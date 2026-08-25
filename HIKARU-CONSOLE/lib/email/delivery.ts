/**
 * 自動メール送信ヘルパー
 *
 * Invoice発行・Report PDF生成完了時に呼ばれる。
 * 失敗しても呼び出し元を例外で中断させない設計（全処理を try/catch で包む）。
 * HTTP自己呼び出しは行わず、サーバー内で直接送信する。
 */

import { getEmailConfig }  from './config'
import { sendEmail }       from './resend'
import {
  hasSentDocument,
  createPendingLog,
  markSent,
  markFailed,
  isValidEmailAddress,
} from './log'
import { buildDocumentEmail, buildReportEmail } from './document-template'

// ── helpers ───────────────────────────────────────────────────────

function extractEmailAddress(from: string): string {
  const m = from.match(/<([^>]+)>/)
  return m ? m[1].trim() : from.trim()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveMailConfig(adminClient: any, companyId: string) {
  const emailConfig = getEmailConfig()
  if (!emailConfig.configured) return null

  const { data: co } = await adminClient
    .from('companies')
    .select('name, email, mail_reply_to, invoice_auto_send, report_auto_send')
    .eq('id', companyId)
    .single()

  if (!co) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = co as any

  const fromName    = c.name?.trim() || 'HIKARU'
  const fromAddress = extractEmailAddress(emailConfig.from!)
  const fromFull    = `${fromName} <${fromAddress}>`

  let replyTo: string | undefined
  const raw     = c.mail_reply_to?.trim() || null
  const fallback = c.email?.trim()         || null
  if (raw && isValidEmailAddress(raw))         replyTo = raw
  else if (fallback && isValidEmailAddress(fallback)) replyTo = fallback

  return {
    fromName,
    fromAddress,
    fromFull,
    replyTo,
    invoiceAutoSend: c.invoice_auto_send ?? false,
    reportAutoSend:  c.report_auto_send  ?? false,
  }
}

// ── Invoice 自動送信 ────────────────────────────────────────────────
//
// 呼び出し条件: Invoice が 'issued' になった直後。
// 失敗しても Invoice 発行成功を維持する（例外を throw しない）。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function attemptInvoiceAutoSend(
  adminClient: any,
  companyId:   string,
  invoiceId:   string,
  sentBy:      string
): Promise<void> {
  try {
    const mail = await resolveMailConfig(adminClient, companyId)
    if (!mail?.invoiceAutoSend) return

    // Invoice 取得
    const { data: inv } = await adminClient
      .from('invoices')
      .select('id, invoice_number, invoice_type, status, client_id, pdf_path, total_amount, due_date')
      .eq('id', invoiceId)
      .eq('company_id', companyId)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invoice = inv as any
    if (!invoice?.pdf_path) return

    // Client 取得（宛先解決）
    const { data: cli } = await adminClient
      .from('clients')
      .select('name, email, invoice_email')
      .eq('id', invoice.client_id)
      .eq('company_id', companyId)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = cli as any
    const toEmail = invoice.invoice_type === 'invoice'
      ? (client?.invoice_email?.trim() || client?.email?.trim() || null)
      : (client?.email?.trim() || null)

    if (!toEmail || !isValidEmailAddress(toEmail)) return

    // 重複確認
    if (await hasSentDocument(adminClient, companyId, { invoiceId })) return

    // テンプレート生成
    const { subject, bodyText } = buildDocumentEmail({
      invoiceType:   invoice.invoice_type,
      invoiceNumber: invoice.invoice_number,
      clientName:    client?.name ?? '顧客',
      companyName:   mail.fromName,
      totalAmount:   Number(invoice.total_amount),
      dueDate:       invoice.due_date ?? null,
    })

    // PDF 取得
    const { data: pdfBlob, error: pdfErr } = await adminClient
      .storage.from('documents').download(invoice.pdf_path)
    if (pdfErr || !pdfBlob) return

    const pdfBuffer   = Buffer.from(await pdfBlob.arrayBuffer())
    const pdfFilename = `${invoice.invoice_number}.pdf`

    // pending log 作成（race condition 防止）
    let pendingLog
    try {
      pendingLog = await createPendingLog(adminClient, companyId, {
        invoiceId,
        clientId:        invoice.client_id,
        toEmail,
        subject,
        bodyText,
        attachedPdfPath: invoice.pdf_path,
        sentBy,
        isResend:        false,
        fromEmail:       mail.fromAddress,
        fromName:        mail.fromName,
        replyTo:         mail.replyTo,
      })
    } catch {
      return  // UNIQUE conflict: already in progress or sent
    }

    // 送信
    try {
      const { messageId } = await sendEmail({
        from:    mail.fromFull,
        to:      toEmail,
        subject,
        text:    bodyText,
        replyTo: mail.replyTo,
        attachments: [{ filename: pdfFilename, content: pdfBuffer }],
      })
      await markSent(adminClient, pendingLog.id, companyId, messageId)
    } catch (err) {
      const raw     = err instanceof Error ? err.message : '不明なエラー'
      const safeMsg = raw === 'EMAIL_PROVIDER_NOT_CONFIGURED'
        ? 'メール送信設定が完了していません。'
        : 'メール自動送信に失敗しました。'
      await markFailed(adminClient, pendingLog.id, companyId, safeMsg).catch(() => {})
    }
  } catch {
    // Auto-send は絶対に caller へ例外を伝播させない
  }
}

// ── Report 自動送信 ────────────────────────────────────────────────
//
// 呼び出し条件: Report PDF が Storage へ保存され pdf_url が更新された直後。
// 失敗しても Report/PDF 処理成功を維持する（例外を throw しない）。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function attemptReportAutoSend(
  adminClient: any,
  companyId:   string,
  reportId:    string,
  sentBy:      string
): Promise<void> {
  try {
    const mail = await resolveMailConfig(adminClient, companyId)
    if (!mail?.reportAutoSend) return

    // Report 取得
    const { data: rep } = await adminClient
      .from('reports')
      .select(`
        id, version, pdf_url, project_id, content,
        projects:project_id (name, client_id, clients:client_id (name, email))
      `)
      .eq('id', reportId)
      .eq('company_id', companyId)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const report  = rep  as any
    if (!report?.pdf_url) return

    const project = report.projects as any
    const client  = project?.clients as any
    const toEmail = client?.email?.trim() || null

    if (!toEmail || !isValidEmailAddress(toEmail)) return

    // 重複確認
    if (await hasSentDocument(adminClient, companyId, { reportId })) return

    // テンプレート生成
    const content  = report.content as any
    const workDate = content?.job?.work_date
      ? new Date(content.job.work_date).toLocaleDateString('ja-JP')
      : '—'

    const { subject, bodyText } = buildReportEmail({
      clientName:  client?.name  ?? '顧客',
      companyName: mail.fromName,
      projectName: project?.name ?? '—',
      workDate,
    })

    // PDF 取得
    const { data: pdfBlob, error: pdfErr } = await adminClient
      .storage.from('documents').download(report.pdf_url)
    if (pdfErr || !pdfBlob) return

    const pdfBuffer   = Buffer.from(await pdfBlob.arrayBuffer())
    const pdfFilename = `作業完了報告書_No${String(report.version).padStart(3, '0')}.pdf`

    // pending log 作成（race condition 防止）
    let pendingLog
    try {
      pendingLog = await createPendingLog(adminClient, companyId, {
        reportId,
        projectId:       report.project_id,
        clientId:        project?.client_id,
        toEmail,
        subject,
        bodyText,
        attachedPdfPath: report.pdf_url,
        sentBy,
        isResend:        false,
        fromEmail:       mail.fromAddress,
        fromName:        mail.fromName,
        replyTo:         mail.replyTo,
      })
    } catch {
      return  // UNIQUE conflict
    }

    // 送信
    try {
      const { messageId } = await sendEmail({
        from:    mail.fromFull,
        to:      toEmail,
        subject,
        text:    bodyText,
        replyTo: mail.replyTo,
        attachments: [{ filename: pdfFilename, content: pdfBuffer }],
      })
      await markSent(adminClient, pendingLog.id, companyId, messageId)
    } catch (err) {
      const raw     = err instanceof Error ? err.message : '不明なエラー'
      const safeMsg = raw === 'EMAIL_PROVIDER_NOT_CONFIGURED'
        ? 'メール送信設定が完了していません。'
        : 'メール自動送信に失敗しました。'
      await markFailed(adminClient, pendingLog.id, companyId, safeMsg).catch(() => {})
    }
  } catch {
    // Auto-send は絶対に caller へ例外を伝播させない
  }
}
