-- ============================================================
-- HIKARU Phase 5: 顧客満足度アンケート + AI品質統合
-- ============================================================
-- 変更内容:
--   1. satisfaction_surveys テーブル新設
--   2. client_project_permissions に AI公開フラグ追加
--   3. companies に 品質スコア重み設定追加
--   4. jobs にアンケート招待管理カラム追加
-- ============================================================

-- ============================================================
-- 1. satisfaction_surveys（顧客満足度アンケート）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.satisfaction_surveys (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  job_id              UUID        NOT NULL REFERENCES public.jobs(id)      ON DELETE CASCADE,
  project_id          UUID        NOT NULL REFERENCES public.projects(id)  ON DELETE CASCADE,
  portal_account_id   UUID        NOT NULL REFERENCES public.client_portal_accounts(id) ON DELETE CASCADE,

  -- 基本評価 (1-5)
  rating              SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment             TEXT,                           -- 顧客コメント（原文保持）

  -- 詳細評価 (1-5, 任意)
  rating_quality      SMALLINT    CHECK (rating_quality  BETWEEN 1 AND 5), -- 清掃品質
  rating_speed        SMALLINT    CHECK (rating_speed    BETWEEN 1 AND 5), -- 作業スピード
  rating_attitude     SMALLINT    CHECK (rating_attitude BETWEEN 1 AND 5), -- スタッフ対応

  -- AI品質との統合（記録時点のスナップショット）
  ai_score            SMALLINT,                       -- ai_evaluations の平均スコア（記録時）

  -- AI分析結果（原文とは別フィールドに保存）
  ai_summary          TEXT,                           -- AI要約
  ai_positive_points  TEXT[],                         -- ポジティブ点
  ai_improvement_points TEXT[],                       -- 改善点
  ai_analyzed_at      TIMESTAMPTZ,                    -- AI分析日時

  -- タイムスタンプ
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 1ジョブにつき1ポータルアカウントは1回のみ回答可能
  UNIQUE (job_id, portal_account_id)
);

CREATE INDEX surveys_company_id_idx     ON public.satisfaction_surveys(company_id);
CREATE INDEX surveys_job_id_idx         ON public.satisfaction_surveys(job_id);
CREATE INDEX surveys_project_id_idx     ON public.satisfaction_surveys(project_id);
CREATE INDEX surveys_portal_account_idx ON public.satisfaction_surveys(portal_account_id);
CREATE INDEX surveys_rating_idx         ON public.satisfaction_surveys(rating);
CREATE INDEX surveys_created_at_idx     ON public.satisfaction_surveys(created_at DESC);

CREATE TRIGGER satisfaction_surveys_updated_at
  BEFORE UPDATE ON public.satisfaction_surveys
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 2. client_project_permissions: AI公開フラグ追加
-- ============================================================
ALTER TABLE public.client_project_permissions
  ADD COLUMN IF NOT EXISTS show_ai_score_to_client BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_submit_survey        BOOLEAN NOT NULL DEFAULT true;

-- ============================================================
-- 3. companies: 品質スコア重み設定追加
-- ============================================================
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS quality_weight_ai       NUMERIC(3,2) NOT NULL DEFAULT 0.60,
  ADD COLUMN IF NOT EXISTS quality_weight_customer NUMERIC(3,2) NOT NULL DEFAULT 0.40;
-- ai_weight + customer_weight = 1.00 (アプリ側で検証)

-- ============================================================
-- 4. jobs: アンケート招待管理
-- ============================================================
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS survey_invited_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS survey_reminded_at TIMESTAMPTZ;

-- ============================================================
-- 5. RLS
-- ============================================================
ALTER TABLE public.satisfaction_surveys ENABLE ROW LEVEL SECURITY;

-- 管理者: 同一company_idの全アンケートを参照
CREATE POLICY "surveys: admin read company"
  ON public.satisfaction_surveys FOR SELECT TO authenticated
  USING (public.is_admin_of(company_id));

-- 顧客: 自分のportal_accountに紐付くアンケートのみCRUD
CREATE POLICY "surveys: client own"
  ON public.satisfaction_surveys FOR ALL TO authenticated
  USING (
    portal_account_id IN (
      SELECT id FROM public.client_portal_accounts
      WHERE profile_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    portal_account_id IN (
      SELECT id FROM public.client_portal_accounts
      WHERE profile_id = auth.uid() AND is_active = true
    )
  );

-- 従業員・協力業者: アクセス不可（ポリシーなし）

-- ============================================================
-- 6. 統合品質ビュー（CONSOLEダッシュボード用）
-- ============================================================
CREATE OR REPLACE VIEW public.v_job_quality AS
SELECT
  j.id              AS job_id,
  j.project_id,
  j.company_id,
  j.worker_id,
  j.work_date,
  j.status          AS job_status,
  -- AI品質スコア（スポット単位の平均）
  AVG(ae.score)::NUMERIC(5,1) AS ai_score_avg,
  COUNT(ae.id)                AS ai_eval_count,
  MIN(ae.recommendation)      AS ai_worst_recommendation,
  -- 顧客満足度
  ss.rating         AS customer_rating,
  ss.rating_quality,
  ss.rating_speed,
  ss.rating_attitude,
  ss.comment        AS customer_comment,
  ss.id             AS survey_id,
  ss.created_at     AS survey_at
FROM public.jobs j
LEFT JOIN public.ai_evaluations ae ON ae.job_id = j.id
LEFT JOIN public.satisfaction_surveys ss ON ss.job_id = j.id
GROUP BY
  j.id, j.project_id, j.company_id, j.worker_id, j.work_date, j.status,
  ss.rating, ss.rating_quality, ss.rating_speed, ss.rating_attitude,
  ss.comment, ss.id, ss.created_at;
