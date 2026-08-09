-- ============================================================
-- HIKARU: AI品質評価テーブル
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_evaluations (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              UUID        NOT NULL REFERENCES public.jobs(id)         ON DELETE CASCADE,
  spot_id             UUID        NOT NULL REFERENCES public.photo_spots(id)  ON DELETE CASCADE,
  before_photo_id     UUID        REFERENCES public.photos(id) ON DELETE SET NULL,
  after_photo_id      UUID        REFERENCES public.photos(id) ON DELETE SET NULL,

  -- 評価スコア (0-100)
  score               SMALLINT    NOT NULL CHECK (score BETWEEN 0 AND 100),
  dirty_removal       SMALLINT    CHECK (dirty_removal BETWEEN 0 AND 100),
  thoroughness        SMALLINT    CHECK (thoroughness BETWEEN 0 AND 100),
  shine               SMALLINT    CHECK (shine BETWEEN 0 AND 100),

  -- 判定
  passed              BOOLEAN     NOT NULL,
  recommendation      TEXT        NOT NULL CHECK (recommendation IN ('pass', 'check', 'redo')),

  -- コメント
  before_summary      TEXT,       -- Before状態の説明
  after_summary       TEXT,       -- After状態の説明
  comparison          TEXT,       -- Before/After比較コメント
  comment             TEXT        NOT NULL,   -- 総合評価コメント
  improvements        TEXT[],     -- 改善提案リスト
  remaining_issues    TEXT[],     -- 残課題リスト

  -- 写真品質チェック
  photo_quality_ok    BOOLEAN     NOT NULL DEFAULT true,
  photo_quality_issues TEXT[],

  -- メタ
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ai_evaluations_job_id_idx  ON public.ai_evaluations(job_id);
CREATE INDEX ai_evaluations_spot_id_idx ON public.ai_evaluations(spot_id);
CREATE INDEX ai_evaluations_score_idx   ON public.ai_evaluations(score);

-- 1ジョブ1スポットにつき最新評価のみ残す（upsert対応）
CREATE UNIQUE INDEX ai_evaluations_unique_spot ON public.ai_evaluations(job_id, spot_id);

ALTER TABLE public.ai_evaluations ENABLE ROW LEVEL SECURITY;

-- 作業者は自分のジョブの評価を参照
CREATE POLICY "ai_evaluations: worker read own"
  ON public.ai_evaluations FOR SELECT TO authenticated
  USING (job_id IN (SELECT id FROM public.jobs WHERE worker_id = auth.uid()));

-- 管理者は同一会社の評価を参照
CREATE POLICY "ai_evaluations: admin read company"
  ON public.ai_evaluations FOR SELECT TO authenticated
  USING (job_id IN (
    SELECT id FROM public.jobs WHERE public.is_admin_of(company_id)
  ));

-- サービスロールによる INSERT/UPDATE
CREATE POLICY "ai_evaluations: service insert"
  ON public.ai_evaluations FOR INSERT TO authenticated
  WITH CHECK (job_id IN (SELECT id FROM public.jobs WHERE worker_id = auth.uid()));
