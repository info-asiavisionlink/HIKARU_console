/**
 * document_email_logs 共通ヘルパー
 *
 * 請求書・見積書・作業完了報告書の3種類で共通利用できる。
 * 実送信Phaseで createPendingLog / markSent / markFailed を実装する。
 */

// ── 再送判定 ────────────────────────────────────────────────────
//
// 同じ書類に対して status='sent' のログが存在すれば再送扱い。
// invoice_id (請求書・見積書) または report_id (報告書) で判定。

export interface HasSentOptions {
  invoiceId?: string
  reportId?:  string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function hasSentDocument(
  adminClient: any,
  companyId:   string,
  opts:        HasSentOptions
): Promise<boolean> {
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

// ── 将来フェーズ用スタブ ─────────────────────────────────────────
// 実送信Phaseで以下を実装する:
//   createPendingLog(adminClient, companyId, params) → log.id
//   markSent(adminClient, logId, providerMessageId)
//   markFailed(adminClient, logId, errorMessage)
