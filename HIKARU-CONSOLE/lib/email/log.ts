/**
 * document_email_logs 共通ヘルパー
 *
 * 請求書・見積書・作業完了報告書の3種類で共通利用できる。
 * company_id を全操作で検証し、cross-company アクセスを防止する。
 */

// ── 型定義 ────────────────────────────────────────────────────────

export interface HasSentOptions {
  invoiceId?: string
  reportId?:  string
}

export interface CreatePendingLogParams {
  invoiceId?:       string
  reportId?:        string
  clientId?:        string
  projectId?:       string
  toEmail:          string
  ccEmails?:        string[]
  subject:          string
  bodyText?:        string
  attachedPdfPath?: string
  sentBy?:          string
  isResend?:        boolean
  originalLogId?:   string
  // 送信時スナップショット（Migration 048 で追加）
  fromEmail?:       string
  fromName?:        string
  replyTo?:         string
}

export interface EmailLog {
  id:                  string
  company_id:          string
  invoice_id:          string | null
  report_id:           string | null
  client_id:           string | null
  project_id:          string | null
  to_email:            string
  cc_emails:           string[] | null
  subject:             string
  body_text:           string | null
  attached_pdf_path:   string | null
  sent_by:             string | null
  sent_at:             string | null
  status:              'pending' | 'sent' | 'failed' | 'skipped'
  provider_message_id: string | null
  error_message:       string | null
  is_resend:           boolean
  original_log_id:     string | null
  created_at:          string
  // 送信時スナップショット（Migration 048 — nullable）
  from_email:          string | null
  from_name:           string | null
  reply_to:            string | null
}

// ── メールアドレス簡易検証 ────────────────────────────────────────
// RFC 5322 完全準拠ではなく、明らかな不正形式を弾く最小実装。
// 送信先は常にDBから取得するが、DB登録値にも不正値の可能性がある。
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmailAddress(email: string): boolean {
  return EMAIL_RE.test(email.trim())
}

// ── 再送判定 ────────────────────────────────────────────────────────
//
// 同じ書類に対して status='sent' のログが存在すれば再送扱い。
// invoice_id (請求書・見積書) または report_id (報告書) で判定。
// どちらも指定されていない場合は false を返す（全社ログを誤参照させない）。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function hasSentDocument(
  adminClient: any,
  companyId:   string,
  opts:        HasSentOptions
): Promise<boolean> {
  if (!opts.invoiceId && !opts.reportId) return false

  let query = adminClient
    .from('document_email_logs')
    .select('id')
    .eq('company_id', companyId)
    .eq('status', 'sent')
    .limit(1)

  if (opts.invoiceId) query = query.eq('invoice_id', opts.invoiceId)
  if (opts.reportId)  query = query.eq('report_id',  opts.reportId)

  const { data } = await query
  return (data?.length ?? 0) > 0
}

// ── pending log 作成 ───────────────────────────────────────────────
//
// Resend API 呼び出しの前に必ず実行する。
// DBレベルの UNIQUE partial index により、同一書類の同時 pending 挿入を防止。
// insert 失敗（unique violation 含む）は例外として上位に伝播させる。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createPendingLog(
  adminClient: any,
  companyId:   string,
  params:      CreatePendingLogParams
): Promise<EmailLog> {
  const { data, error } = await adminClient
    .from('document_email_logs')
    .insert({
      company_id:        companyId,
      invoice_id:        params.invoiceId       ?? null,
      report_id:         params.reportId        ?? null,
      client_id:         params.clientId        ?? null,
      project_id:        params.projectId       ?? null,
      to_email:          params.toEmail,
      cc_emails:         params.ccEmails        ?? null,
      subject:           params.subject,
      body_text:         params.bodyText        ?? null,
      attached_pdf_path: params.attachedPdfPath ?? null,
      sent_by:           params.sentBy          ?? null,
      status:            'pending',
      is_resend:         params.isResend        ?? false,
      original_log_id:   params.originalLogId   ?? null,
      from_email:        params.fromEmail        ?? null,
      from_name:         params.fromName         ?? null,
      reply_to:          params.replyTo          ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(`createPendingLog failed: ${error.message}`)
  return data as EmailLog
}

// ── 送信成功マーク ────────────────────────────────────────────────
//
// Resend API 呼び出し成功後に実行する。
// company_id を必ず指定し company isolation を維持する。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function markSent(
  adminClient:       any,
  logId:             string,
  companyId:         string,
  providerMessageId: string
): Promise<void> {
  const { error } = await adminClient
    .from('document_email_logs')
    .update({
      status:              'sent',
      sent_at:             new Date().toISOString(),
      provider_message_id: providerMessageId,
    })
    .eq('id', logId)
    .eq('company_id', companyId)

  if (error) throw new Error(`markSent failed: ${error.message}`)
}

// ── 送信失敗マーク ────────────────────────────────────────────────
//
// Resend API 呼び出し失敗後に実行する。
// API Key・Authorization ヘッダーなど秘密情報は errorMessage に含めない。
// failed ステータスになると DB の UNIQUE partial index 対象外となり、
// 同一書類への新規 pending（リトライ）が許可される。
// company_id を必ず指定し company isolation を維持する。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function markFailed(
  adminClient:  any,
  logId:        string,
  companyId:    string,
  errorMessage: string
): Promise<void> {
  const { error } = await adminClient
    .from('document_email_logs')
    .update({
      status:        'failed',
      error_message: errorMessage,
    })
    .eq('id', logId)
    .eq('company_id', companyId)

  if (error) throw new Error(`markFailed failed: ${error.message}`)
}
