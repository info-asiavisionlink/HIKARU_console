-- ============================================================
-- HIKARU: 報告書テーブル
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reports (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        UUID        NOT NULL REFERENCES public.jobs(id)       ON DELETE CASCADE,
  project_id    UUID        NOT NULL REFERENCES public.projects(id)   ON DELETE CASCADE,
  worker_id     UUID        NOT NULL REFERENCES public.profiles(id)   ON DELETE CASCADE,
  company_id    UUID        NOT NULL REFERENCES public.companies(id)  ON DELETE CASCADE,
  version       SMALLINT    NOT NULL DEFAULT 1,
  content       JSONB       NOT NULL,   -- 全報告書データ（再生成に使用）
  overall_score SMALLINT,               -- 総合スコア
  pdf_url       TEXT,                   -- 将来: Supabase Storage PDF
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX reports_job_id_idx     ON public.reports(job_id);
CREATE INDEX reports_project_id_idx ON public.reports(project_id);
CREATE INDEX reports_worker_id_idx  ON public.reports(worker_id);
CREATE INDEX reports_company_id_idx ON public.reports(company_id);
CREATE INDEX reports_created_at_idx ON public.reports(created_at DESC);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 作業者は自分のジョブの報告書を参照・作成
CREATE POLICY "reports: worker own"
  ON public.reports FOR ALL TO authenticated
  USING  (worker_id = auth.uid())
  WITH CHECK (worker_id = auth.uid());

-- 管理者は同一会社の報告書を参照
CREATE POLICY "reports: admin read company"
  ON public.reports FOR SELECT TO authenticated
  USING (public.is_admin_of(company_id));
