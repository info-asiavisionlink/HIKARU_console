-- ============================================================
-- 041: メール送信履歴テーブル
-- 請求書・見積書・報告書の顧客へのメール送信記録
-- ============================================================
-- 目的:
--   - 誰が・いつ・どの顧客へ・どの書類を・どの宛先へ送ったかを記録
--   - 送信成功 / 失敗 / 再送 を区別
--   - 将来の二重送信防止・トラブル調査に使用
-- 今回は:
--   - テーブル・インデックス・RLS 追加のみ
--   - メール送信API / メールサービス導入は別Phase (2G-C以降)

CREATE TABLE IF NOT EXISTS public.document_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- テナント（必須）
  company_id UUID NOT NULL
    REFERENCES public.companies(id) ON DELETE CASCADE,

  -- 送信書類（いずれかが入る。両方NULLも将来許容）
  invoice_id UUID
    REFERENCES public.invoices(id) ON DELETE SET NULL,

  report_id  UUID
    REFERENCES public.reports(id)  ON DELETE SET NULL,

  -- 送信対象
  client_id  UUID
    REFERENCES public.clients(id)  ON DELETE SET NULL,

  project_id UUID
    REFERENCES public.projects(id) ON DELETE SET NULL,

  -- 送信内容スナップショット（送信時点の実際の値を保存）
  to_email          TEXT   NOT NULL,
  cc_emails         TEXT[],
  subject           TEXT   NOT NULL,
  body_text         TEXT,
  attached_pdf_path TEXT,           -- Supabase Storage path

  -- 送信者（管理者）
  sent_by UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL,

  sent_at TIMESTAMPTZ,              -- プロバイダへ送信成功した日時

  -- 送信ステータス
  status TEXT NOT NULL DEFAULT 'pending'
    CONSTRAINT document_email_logs_status_check
      CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),

  -- メールサービスプロバイダからの返却ID（Resend等）
  provider_message_id TEXT,

  -- エラー内容
  error_message TEXT,

  -- 再送フラグ
  is_resend       BOOLEAN NOT NULL DEFAULT false,
  original_log_id UUID
    REFERENCES public.document_email_logs(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- インデックス
-- ============================================================

CREATE INDEX IF NOT EXISTS email_logs_company_id_idx
  ON public.document_email_logs(company_id);

CREATE INDEX IF NOT EXISTS email_logs_invoice_id_idx
  ON public.document_email_logs(invoice_id);

CREATE INDEX IF NOT EXISTS email_logs_status_idx
  ON public.document_email_logs(status);

CREATE INDEX IF NOT EXISTS email_logs_sent_at_idx
  ON public.document_email_logs(sent_at DESC);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.document_email_logs ENABLE ROW LEVEL SECURITY;

-- 管理者: 自社ログのみ参照可能
CREATE POLICY "email_logs: admin read own company"
  ON public.document_email_logs FOR SELECT
  TO authenticated
  USING (public.is_admin_of(company_id));

-- INSERT / UPDATE は service_role（サーバーサイド adminClient）が行う
-- service_role は RLS をバイパスするためポリシー不要
-- Worker・顧客はメール送信ログを参照不可
