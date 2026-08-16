/**
 * メール送信設定ヘルパー
 *
 * RESEND_API_KEY と EMAIL_FROM が両方セットされている場合のみ
 * configured = true を返す。
 *
 * API key の実値はクライアントへ返さない。
 * ログにも出力しない。
 */

export interface EmailConfig {
  configured: boolean
  from: string | null
}

export function getEmailConfig(): EmailConfig {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from   = process.env.EMAIL_FROM?.trim()

  return {
    configured: Boolean(apiKey && from),
    from:       from ?? null,
  }
}
