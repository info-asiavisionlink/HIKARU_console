-- ============================================================
-- HIKARU: 案件テーブル拡張 + 通知テーブル
-- ============================================================

-- ---- projects に住所・担当者フィールド追加 ----
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS assigned_to TEXT;

-- ============================================================
-- notifications（管理者通知）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  body        TEXT,
  type        TEXT        NOT NULL DEFAULT 'info',  -- info | warning | error | success
  is_read     BOOLEAN     NOT NULL DEFAULT false,
  target_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX notifications_company_id_idx ON public.notifications(company_id);
CREATE INDEX notifications_is_read_idx    ON public.notifications(is_read);
CREATE INDEX notifications_created_at_idx ON public.notifications(created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications: admin CRUD"
  ON public.notifications FOR ALL TO authenticated
  USING (public.is_admin_of(company_id));
