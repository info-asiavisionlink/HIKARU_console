/**
 * Resend メール送信プロバイダー
 *
 * RESEND_API_KEY と EMAIL_FROM は Server 側環境変数のみ。
 * クライアントコンポーネントからは絶対にインポートしない。
 */

import { Resend } from 'resend'

export interface SendEmailParams {
  to:           string
  subject:      string
  text:         string
  replyTo?:     string
  attachments?: Array<{
    filename: string
    content:  Buffer
  }>
}

export interface SendEmailResult {
  messageId: string
}

/**
 * Resend API 経由でメールを送信する。
 * 失敗時は Error を throw する（呼び出し元でキャッチして markFailed を呼ぶこと）。
 * API Key は引数として渡さず、process.env から直接読み込む。
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from   = process.env.EMAIL_FROM?.trim()

  if (!apiKey || !from) {
    throw new Error('EMAIL_PROVIDER_NOT_CONFIGURED')
  }

  const resend = new Resend(apiKey)

  const { data, error } = await resend.emails.send({
    from,
    to:          params.to,
    subject:     params.subject,
    text:        params.text,
    ...(params.replyTo ? { replyTo: params.replyTo } : {}),
    attachments: params.attachments,
  })

  if (error) {
    throw new Error(error.message ?? 'Resend API error')
  }
  if (!data?.id) {
    throw new Error('Resend returned no message ID')
  }

  return { messageId: data.id }
}
