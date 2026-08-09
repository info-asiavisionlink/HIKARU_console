-- ============================================================
-- HIKARU: 顧客ポータル（Client Portal）テーブル・RLS
-- ============================================================

-- ============================================================
-- client_portal_accounts（ポータルアカウント）
-- profiles(role='client') と紐付く顧客担当者アカウント
-- ============================================================
CREATE TABLE IF NOT EXISTS public.client_portal_accounts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   UUID        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  company_id   UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id    UUID        NOT NULL REFERENCES public.clients(id)   ON DELETE CASCADE,
  login_id     TEXT        NOT NULL,           -- CLT-0001 形式
  contact_name TEXT        NOT NULL,           -- 担当者名
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (login_id, company_id)
);

CREATE INDEX cpa_profile_id_idx   ON public.client_portal_accounts(profile_id);
CREATE INDEX cpa_company_id_idx   ON public.client_portal_accounts(company_id);
CREATE INDEX cpa_client_id_idx    ON public.client_portal_accounts(client_id);
CREATE INDEX cpa_is_active_idx    ON public.client_portal_accounts(is_active);

-- ============================================================
-- client_project_permissions（案件閲覧権限）
-- 顧客が閲覧できる案件と権限レベルを管理
-- ============================================================
CREATE TABLE IF NOT EXISTS public.client_project_permissions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_account_id UUID        NOT NULL REFERENCES public.client_portal_accounts(id) ON DELETE CASCADE,
  project_id        UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  can_view_reports  BOOLEAN     NOT NULL DEFAULT true,
  can_view_photos   BOOLEAN     NOT NULL DEFAULT true,
  can_view_timeline BOOLEAN     NOT NULL DEFAULT true,
  can_download_pdf  BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (portal_account_id, project_id)
);

CREATE INDEX cpp_portal_account_id_idx ON public.client_project_permissions(portal_account_id);
CREATE INDEX cpp_project_id_idx        ON public.client_project_permissions(project_id);

-- ============================================================
-- client_notifications（顧客向け通知）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.client_notifications (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_account_id UUID        NOT NULL REFERENCES public.client_portal_accounts(id) ON DELETE CASCADE,
  type              TEXT        NOT NULL DEFAULT 'info'
                    CHECK (type IN ('job_started','job_completed','report_ready','quality_evaluated','redo_requested','info')),
  title             TEXT        NOT NULL,
  body              TEXT,
  is_read           BOOLEAN     NOT NULL DEFAULT false,
  job_id            UUID        REFERENCES public.jobs(id)     ON DELETE SET NULL,
  project_id        UUID        REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX cn_portal_account_id_idx ON public.client_notifications(portal_account_id);
CREATE INDEX cn_is_read_idx           ON public.client_notifications(is_read);
CREATE INDEX cn_created_at_idx        ON public.client_notifications(created_at DESC);

-- ============================================================
-- report_views（報告書閲覧履歴）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.report_views (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_account_id UUID        NOT NULL REFERENCES public.client_portal_accounts(id) ON DELETE CASCADE,
  report_id         UUID        NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  first_viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_viewed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  view_count        INT         NOT NULL DEFAULT 1,
  UNIQUE (portal_account_id, report_id)
);

CREATE INDEX rv_portal_account_id_idx ON public.report_views(portal_account_id);
CREATE INDEX rv_report_id_idx         ON public.report_views(report_id);

-- ============================================================
-- ヘルパー関数: 顧客が該当案件へのアクセス権を持つか確認
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_client_with_project_access(target_project_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.client_project_permissions cpp
    JOIN   public.client_portal_accounts     cpa ON cpa.id = cpp.portal_account_id
    WHERE  cpa.profile_id = auth.uid()
      AND  cpp.project_id = target_project_id
      AND  cpa.is_active  = true
  )
$$;

-- ヘルパー関数: 現在のユーザーのポータルアカウントIDを返す
CREATE OR REPLACE FUNCTION public.my_portal_account_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM public.client_portal_accounts
  WHERE  profile_id = auth.uid()
    AND  is_active   = true
  LIMIT  1
$$;

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE public.client_portal_accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_project_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_views               ENABLE ROW LEVEL SECURITY;

-- ---- client_portal_accounts ----
-- 管理者: 同一会社のアカウントを全操作
CREATE POLICY "cpa: admin CRUD"
  ON public.client_portal_accounts FOR ALL TO authenticated
  USING (public.is_admin_of(company_id));

-- 顧客: 自分のアカウントのみ参照
CREATE POLICY "cpa: client read own"
  ON public.client_portal_accounts FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

-- ---- client_project_permissions ----
-- 管理者: 全操作
CREATE POLICY "cpp: admin CRUD"
  ON public.client_project_permissions FOR ALL TO authenticated
  USING (
    portal_account_id IN (
      SELECT id FROM public.client_portal_accounts
      WHERE  public.is_admin_of(company_id)
    )
  );

-- 顧客: 自分のポータルに紐づく権限を参照
CREATE POLICY "cpp: client read own"
  ON public.client_project_permissions FOR SELECT TO authenticated
  USING (
    portal_account_id IN (
      SELECT id FROM public.client_portal_accounts WHERE profile_id = auth.uid()
    )
  );

-- ---- client_notifications ----
-- 管理者: INSERT（通知の発行）
CREATE POLICY "cn: admin insert"
  ON public.client_notifications FOR INSERT TO authenticated
  WITH CHECK (
    portal_account_id IN (
      SELECT id FROM public.client_portal_accounts
      WHERE  public.is_admin_of(company_id)
    )
  );

-- 顧客: 自分の通知を参照・既読更新
CREATE POLICY "cn: client read own"
  ON public.client_notifications FOR SELECT TO authenticated
  USING (portal_account_id = public.my_portal_account_id());

CREATE POLICY "cn: client update read"
  ON public.client_notifications FOR UPDATE TO authenticated
  USING  (portal_account_id = public.my_portal_account_id())
  WITH CHECK (portal_account_id = public.my_portal_account_id());

-- service role: 通知INSERT
CREATE POLICY "cn: service insert"
  ON public.client_notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ---- report_views ----
-- 顧客: 自分の閲覧記録を操作
CREATE POLICY "rv: client own"
  ON public.report_views FOR ALL TO authenticated
  USING  (portal_account_id = public.my_portal_account_id())
  WITH CHECK (portal_account_id = public.my_portal_account_id());

-- ============================================================
-- 既存テーブルへ顧客アクセスポリシーを追加
-- ============================================================

-- projects: 顧客は権限がある案件のみ参照
CREATE POLICY "projects: client read permitted"
  ON public.projects FOR SELECT TO authenticated
  USING (public.is_client_with_project_access(id));

-- jobs: 顧客は権限がある案件のジョブを参照
CREATE POLICY "jobs: client read permitted"
  ON public.jobs FOR SELECT TO authenticated
  USING (public.is_client_with_project_access(project_id));

-- photos: 顧客は権限がある案件の写真を参照
CREATE POLICY "photos: client read permitted"
  ON public.photos FOR SELECT TO authenticated
  USING (
    job_id IN (
      SELECT id FROM public.jobs
      WHERE  public.is_client_with_project_access(project_id)
    )
  );

-- ai_evaluations: 顧客は権限がある案件の評価を参照
CREATE POLICY "ai_evaluations: client read permitted"
  ON public.ai_evaluations FOR SELECT TO authenticated
  USING (
    job_id IN (
      SELECT id FROM public.jobs
      WHERE  public.is_client_with_project_access(project_id)
    )
  );

-- reports: 顧客は権限がある案件の報告書を参照
CREATE POLICY "reports: client read permitted"
  ON public.reports FOR SELECT TO authenticated
  USING (public.is_client_with_project_access(project_id));

-- ============================================================
-- updated_at トリガー
-- ============================================================
CREATE TRIGGER cpa_updated_at
  BEFORE UPDATE ON public.client_portal_accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
