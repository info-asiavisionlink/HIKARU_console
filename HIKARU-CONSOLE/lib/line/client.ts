// ============================================================
// LINE Messaging API クライアント
// サーバーサイド専用。クライアントコンポーネントから呼び出し禁止。
// ============================================================

const LINE_API_URL = 'https://api.line.me/v2/bot/message/push'

export interface LinePushResult {
  success: boolean
  error?: string
}

/**
 * LINE Push Message を送信する
 * @param lineUserId 送信先の LINE User ID
 * @param message テキストメッセージ本文
 */
export async function sendLinePushMessage(
  lineUserId: string,
  message: string
): Promise<LinePushResult> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) {
    return { success: false, error: 'LINE_CHANNEL_ACCESS_TOKEN が設定されていません' }
  }

  try {
    const res = await fetch(LINE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: 'text', text: message }],
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      return { success: false, error: `LINE API エラー ${res.status}: ${body}` }
    }

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}
