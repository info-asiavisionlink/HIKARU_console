-- ============================================================
-- 048: パッケージ版メール設定 / 送信ログスナップショット
--
-- 1社1環境 (deploy-per-customer) 販売対応。
-- 今回は ADD COLUMN のみ。既存データは一切変更しない。
-- ============================================================

-- ============================================================
-- companies テーブルへの追加
--
--   mail_reply_to
--     Reply-To に使用するメールアドレス。
--     NULL の場合は companies.email をフォールバックとして使用。
--
--   invoice_auto_send
--     請求書発行時の自動メール送信フラグ。
--     DEFAULT false — Migration 適用だけで自動送信が始まらない。
--
--   report_auto_send
--     作業完了報告書完成時の自動メール送信フラグ。
--     DEFAULT false — 同上。
-- ============================================================
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS mail_reply_to    TEXT,
  ADD COLUMN IF NOT EXISTS invoice_auto_send BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS report_auto_send  BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- document_email_logs テーブルへの追加
--
-- 送信設定は運用で変わりうるため、
-- 送信時点のスナップショットをログに残す。
-- 後から設定を変更しても「当時どの From / Reply-To で送ったか」を追跡可能にする。
--
--   from_email    送信時の From メールアドレス
--   from_name     送信時の From 表示名
--   reply_to      送信時の Reply-To アドレス（設定なし時は NULL）
-- ============================================================
ALTER TABLE public.document_email_logs
  ADD COLUMN IF NOT EXISTS from_email TEXT,
  ADD COLUMN IF NOT EXISTS from_name  TEXT,
  ADD COLUMN IF NOT EXISTS reply_to   TEXT;
