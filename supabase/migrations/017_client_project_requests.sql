-- ============================================================
-- HIKARU: 顧客からの案件依頼テーブル
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_project_requests (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_account_id UUID        NOT NULL REFERENCES public.client_portal_accounts(id) ON DELETE CASCADE,
  client_id         UUID        NOT NULL REFERENCES public.clients(id)   ON DELETE CASCADE,
  company_id        UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title             TEXT        NOT NULL,
  description       TEXT,
  desired_date      DATE,
  location          TEXT,
  project_type      TEXT        NOT NULL DEFAULT 'spot'
                    CHECK (project_type IN ('spot', 'recurring', 'hotel', 'other')),
  status            TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX cpr_portal_account_id_idx ON public.client_project_requests(portal_account_id);
CREATE INDEX cpr_client_id_idx         ON public.client_project_requests(client_id);
CREATE INDEX cpr_company_id_idx        ON public.client_project_requests(company_id);
CREATE INDEX cpr_status_idx            ON public.client_project_requests(status);
CREATE INDEX cpr_created_at_idx        ON public.client_project_requests(created_at DESC);

ALTER TABLE public.client_project_requests ENABLE ROW LEVEL SECURITY;

-- 管理者: 同一会社の依頼を全操作
CREATE POLICY "cpr: admin CRUD"
  ON public.client_project_requests FOR ALL TO authenticated
  USING (public.is_admin_of(company_id));

-- 顧客: 自分の依頼をINSERT
CREATE POLICY "cpr: client insert"
  ON public.client_project_requests FOR INSERT TO authenticated
  WITH CHECK (portal_account_id = public.my_portal_account_id());

-- 顧客: 自分の依頼をSELECT
CREATE POLICY "cpr: client read own"
  ON public.client_project_requests FOR SELECT TO authenticated
  USING (portal_account_id = public.my_portal_account_id());

-- service role
CREATE POLICY "cpr: service all"
  ON public.client_project_requests FOR ALL
  TO service_role WITH CHECK (true);

CREATE TRIGGER cpr_updated_at
  BEFORE UPDATE ON public.client_project_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
