-- ============================================================
-- 047: document_email_logs race condition 対策
--
-- 同一書類への重複 pending / sent をDBレベルで防止する。
-- 失敗後のリトライ・明示的再送（is_resend=true）は引き続き許可。
-- ============================================================

-- MAIL-02監査で欠落を確認した report_id インデックス
CREATE INDEX IF NOT EXISTS email_logs_report_id_idx
  ON public.document_email_logs(report_id);

-- ============================================================
-- Invoice / Quote 重複防止
--
-- 同一 (company_id, invoice_id) で
--   status IN ('pending', 'sent') かつ is_resend = false
-- は 1件のみ許可。
--
-- 効果:
--   - createPendingLog() の INSERT 時点で二重 POST を DB がブロック
--   - sent 後に通常経路（is_resend=false）で再 pending を防止
--   - failed → 新 pending（リトライ）は許可（index 対象外）
--   - is_resend=true の明示再送は許可（index 対象外）
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS email_logs_invoice_no_dup_idx
  ON public.document_email_logs (company_id, invoice_id)
  WHERE invoice_id IS NOT NULL
    AND status IN ('pending', 'sent')
    AND is_resend = false;

-- ============================================================
-- Report 重複防止（同上設計）
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS email_logs_report_no_dup_idx
  ON public.document_email_logs (company_id, report_id)
  WHERE report_id IS NOT NULL
    AND status IN ('pending', 'sent')
    AND is_resend = false;
