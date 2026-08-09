-- ============================================================
-- HIKARU: 作業セッション（jobs）・写真（photos）テーブル
-- ============================================================

-- ============================================================
-- jobs（作業セッション）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.jobs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID        NOT NULL REFERENCES public.projects(id)  ON DELETE CASCADE,
  worker_id     UUID        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  company_id    UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  status        TEXT        NOT NULL DEFAULT 'in_progress'
                            CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  work_date     DATE        NOT NULL DEFAULT CURRENT_DATE,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX jobs_project_id_idx  ON public.jobs(project_id);
CREATE INDEX jobs_worker_id_idx   ON public.jobs(worker_id);
CREATE INDEX jobs_company_id_idx  ON public.jobs(company_id);
CREATE INDEX jobs_work_date_idx   ON public.jobs(work_date);
CREATE INDEX jobs_status_idx      ON public.jobs(status);

-- 同一プロジェクト・作業者・日付でのユニーク制約（1日1セッション）
CREATE UNIQUE INDEX jobs_unique_daily
  ON public.jobs(project_id, worker_id, work_date)
  WHERE status != 'cancelled';

-- ============================================================
-- photos（撮影写真）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.photos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       UUID        NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  spot_id      UUID        REFERENCES public.photo_spots(id)  ON DELETE SET NULL,
  photo_type   TEXT        NOT NULL CHECK (photo_type IN ('before', 'after')),
  storage_path TEXT        NOT NULL,
  url          TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX photos_job_id_idx    ON public.photos(job_id);
CREATE INDEX photos_spot_id_idx   ON public.photos(spot_id);
CREATE INDEX photos_type_idx      ON public.photos(photo_type);

-- 同一job・spot・typeで1枚のみ（上書き用にupsert対応）
CREATE UNIQUE INDEX photos_unique_spot
  ON public.photos(job_id, spot_id, photo_type)
  WHERE spot_id IS NOT NULL;

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE public.jobs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- jobs: 作業者は自分のジョブのみ CRUD
CREATE POLICY "jobs: worker own CRUD"
  ON public.jobs FOR ALL TO authenticated
  USING (worker_id = auth.uid());

-- jobs: 管理者は同一会社のジョブを参照可能
CREATE POLICY "jobs: admin read company"
  ON public.jobs FOR SELECT TO authenticated
  USING (public.is_admin_of(company_id));

-- photos: 作業者は自分のジョブの写真を操作可能
CREATE POLICY "photos: worker own CRUD"
  ON public.photos FOR ALL TO authenticated
  USING (
    job_id IN (SELECT id FROM public.jobs WHERE worker_id = auth.uid())
  );

-- photos: 管理者は同一会社の写真を参照可能
CREATE POLICY "photos: admin read company"
  ON public.photos FOR SELECT TO authenticated
  USING (
    job_id IN (
      SELECT id FROM public.jobs WHERE public.is_admin_of(company_id)
    )
  );

-- ============================================================
-- Updated_at トリガー
-- ============================================================
CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- NOTE: Supabase Storage バケット設定
-- ============================================================
-- ダッシュボード > Storage から以下のバケットを作成してください:
--   バケット名: photos
--   Public: true（または signed URL ポリシーを設定）
-- RLS policy for storage:
--   authenticated users can upload to photos/
--   public can read from photos/
