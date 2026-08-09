-- ============================================================
-- HIKARU Phase 4: LINE通知連携
-- ============================================================
-- 変更内容:
--   1. profiles に LINE連携カラム追加
--   2. client_portal_accounts に LINE連携カラム追加
--   3. line_notification_logs テーブル新設
-- ============================================================

-- ============================================================
-- 1. profiles: LINE連携カラム追加
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS line_user_id        TEXT,
  ADD COLUMN IF NOT EXISTS line_notify_enabled BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS profiles_line_user_id_idx
  ON public.profiles(line_user_id)
  WHERE line_user_id IS NOT NULL;

-- ============================================================
-- 2. client_portal_accounts: 顧客LINE連携
-- ============================================================
ALTER TABLE public.client_portal_accounts
  ADD COLUMN IF NOT EXISTS line_user_id        TEXT,
  ADD COLUMN IF NOT EXISTS line_notify_enabled BOOLEAN NOT NULL DEFAULT true;

-- ============================================================
-- 3. line_notification_logs: 通知送信ログ
-- ============================================================
CREATE TABLE IF NOT EXISTS public.line_notification_logs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  -- 通知先プロフィール（nullable: 顧客ポータルアカウント経由の場合もある）
  profile_id       UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- 顧客ポータルアカウント（顧客向け通知の場合）
  portal_account_id UUID       REFERENCES public.client_portal_accounts(id) ON DELETE SET NULL,
  -- イベント種別
  event_type       TEXT        NOT NULL,
  -- 冪等キー: 同一イベントの重複送信防止
  -- 例: "shift_created:shift-uuid", "expense_approved:expense-uuid"
  notification_key TEXT,
  -- 送信内容
  message          TEXT        NOT NULL,
  line_user_id     TEXT,
  -- 送信ステータス
  status           TEXT        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  error_message    TEXT,
  -- タイムスタンプ
  sent_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS line_logs_company_id_idx    ON public.line_notification_logs(company_id);
CREATE INDEX IF NOT EXISTS line_logs_profile_id_idx    ON public.line_notification_logs(profile_id);
CREATE INDEX IF NOT EXISTS line_logs_status_idx        ON public.line_notification_logs(status);
CREATE INDEX IF NOT EXISTS line_logs_event_type_idx    ON public.line_notification_logs(event_type);
CREATE INDEX IF NOT EXISTS line_logs_created_at_idx    ON public.line_notification_logs(created_at DESC);

-- 冪等キーのユニーク制約（同一company + keyの重複を防ぐ）
CREATE UNIQUE INDEX IF NOT EXISTS line_logs_notification_key_idx
  ON public.line_notification_logs(company_id, notification_key)
  WHERE notification_key IS NOT NULL;

-- ============================================================
-- 4. RLS
-- ============================================================
ALTER TABLE public.line_notification_logs ENABLE ROW LEVEL SECURITY;

-- 管理者: 同一company_idのログを全件参照・削除可能
CREATE POLICY "line_logs: admin read own company"
  ON public.line_notification_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
        AND p.company_id = line_notification_logs.company_id
    )
  );

-- INSERT は service_role（サーバーサイドのみ）が担う
-- workerはログ閲覧不可（UIでは不要）
-- 顧客はLINEログを閲覧不可
