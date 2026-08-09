-- ============================================================
-- HIKARU: 案件管理リファクタリング
--   単発案件 / 定期案件 / ホテル案件 の3種類に対応
--   拡張性・パフォーマンスを考慮した設計
-- ============================================================

-- ============================================================
-- 1. project_type Enum 追加
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.project_type AS ENUM ('spot', 'recurring', 'hotel');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. projects テーブルに project_type を追加
-- ============================================================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_type public.project_type NOT NULL DEFAULT 'spot',
  ADD COLUMN IF NOT EXISTS client_id    UUID REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS projects_project_type_idx ON public.projects(project_type);
CREATE INDEX IF NOT EXISTS projects_client_id_idx    ON public.projects(client_id);

-- ============================================================
-- 3. 単発案件詳細 (spot_project_details)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.spot_project_details (
  project_id        UUID        PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  work_datetime     TIMESTAMPTZ,          -- 作業日時
  work_content      TEXT,                 -- 作業内容
  required_staff    INTEGER     DEFAULT 1, -- 必要人数
  estimated_hours   NUMERIC(4,1),         -- 予定時間（例: 3.5時間）
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER spot_project_details_updated_at
  BEFORE UPDATE ON public.spot_project_details
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 4. 定期案件詳細 (recurring_project_details)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.cycle_type AS ENUM (
    'daily',    -- 毎日
    'weekly',   -- 毎週
    'monthly',  -- 毎月
    'biweekly', -- 隔週
    'nth_weekday', -- 第○曜日
    'custom'    -- 自由設定
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.recurring_project_details (
  project_id        UUID              PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  cycle_type        public.cycle_type NOT NULL DEFAULT 'monthly',
  -- cycle_config: サイクルの詳細設定 (JSONB)
  -- daily: {}
  -- weekly: {"weekdays": [1,3,5]}  (0=日〜6=土)
  -- monthly: {"day": 1}            (毎月1日)
  -- biweekly: {"weekday": 1}       (隔週月曜)
  -- nth_weekday: {"n": 2, "weekday": 5} (第2金曜)
  -- custom: {"description": "..."}
  cycle_config      JSONB             NOT NULL DEFAULT '{}',
  work_start_time   TIME,             -- 作業開始時刻
  work_end_time     TIME,             -- 作業終了時刻
  required_staff    INTEGER           DEFAULT 1,
  auto_generate     BOOLEAN           NOT NULL DEFAULT TRUE, -- 自動案件生成ON/OFF
  last_generated_at TIMESTAMPTZ,      -- 最後に自動生成した日時
  created_at        TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE TRIGGER recurring_project_details_updated_at
  BEFORE UPDATE ON public.recurring_project_details
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 5. 年間作業スケジュール (recurring_monthly_schedules)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.recurring_monthly_schedules (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  month         INTEGER     NOT NULL CHECK (month BETWEEN 1 AND 12),
  work_content  TEXT        NOT NULL DEFAULT '',  -- その月の作業内容
  notes         TEXT,
  UNIQUE (project_id, month)
);

CREATE INDEX IF NOT EXISTS recurring_monthly_schedules_project_id_idx
  ON public.recurring_monthly_schedules(project_id);

-- ============================================================
-- 6. ホテル案件詳細 (hotel_project_details)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.hotel_project_details (
  project_id            UUID        PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  total_floors          INTEGER     DEFAULT 0,
  operating_start_time  TIME,           -- 稼働開始時間
  operating_end_time    TIME,           -- 稼働終了時間
  manager_name          TEXT,           -- 担当責任者
  phone                 TEXT,           -- 電話番号
  contract_start_date   DATE,
  contract_end_date     DATE,
  auto_generate         BOOLEAN     NOT NULL DEFAULT TRUE,
  last_generated_at     TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER hotel_project_details_updated_at
  BEFORE UPDATE ON public.hotel_project_details
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 7. ホテルフロア情報 (hotel_floors)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.hotel_floors (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_detail_id UUID        NOT NULL REFERENCES public.hotel_project_details(project_id) ON DELETE CASCADE,
  floor_name      TEXT        NOT NULL,   -- "1F", "2F", "B1", "PH" など
  room_count      INTEGER     NOT NULL DEFAULT 0,
  notes           TEXT,
  order_num       INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hotel_floors_hotel_detail_id_idx ON public.hotel_floors(hotel_detail_id);

-- ============================================================
-- 8. ホテル稼働管理 (hotel_staffing_rules)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.hotel_staffing_rules (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_detail_id UUID        NOT NULL REFERENCES public.hotel_project_details(project_id) ON DELETE CASCADE,
  time_slot       TEXT        NOT NULL,   -- '朝', '昼', '夜' または自由設定
  required_staff  INTEGER     NOT NULL DEFAULT 0,
  notes           TEXT,
  order_num       INTEGER     NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS hotel_staffing_rules_hotel_detail_id_idx
  ON public.hotel_staffing_rules(hotel_detail_id);

-- ============================================================
-- 9. ホテル作業エリア (hotel_work_areas)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.hotel_work_areas (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_detail_id UUID        NOT NULL REFERENCES public.hotel_project_details(project_id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,   -- '部屋清掃', '共用部', 'ロビー' など
  description     TEXT,
  order_num       INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hotel_work_areas_hotel_detail_id_idx
  ON public.hotel_work_areas(hotel_detail_id);

-- ============================================================
-- 10. jobs テーブルに project_type を追加（UI切替用）
-- ============================================================

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS project_type public.project_type;

-- 既存レコードに project_type をバックフィル
UPDATE public.jobs j
SET project_type = p.project_type
FROM public.projects p
WHERE j.project_id = p.id
  AND j.project_type IS NULL;

-- ============================================================
-- 11. RLS ポリシー追加
-- ============================================================

ALTER TABLE public.spot_project_details      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_project_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_monthly_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_project_details     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_floors              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_staffing_rules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_work_areas          ENABLE ROW LEVEL SECURITY;

-- 管理者: 自社案件に紐づく全詳細テーブルを管理
CREATE POLICY "spot_details: admin manage"
  ON public.spot_project_details FOR ALL TO authenticated
  USING   (project_id IN (SELECT public.get_my_admin_project_ids()))
  WITH CHECK (project_id IN (SELECT public.get_my_admin_project_ids()));

CREATE POLICY "spot_details: worker read"
  ON public.spot_project_details FOR SELECT TO authenticated
  USING (project_id IN (SELECT public.get_my_assigned_project_ids()));

CREATE POLICY "recurring_details: admin manage"
  ON public.recurring_project_details FOR ALL TO authenticated
  USING   (project_id IN (SELECT public.get_my_admin_project_ids()))
  WITH CHECK (project_id IN (SELECT public.get_my_admin_project_ids()));

CREATE POLICY "recurring_details: worker read"
  ON public.recurring_project_details FOR SELECT TO authenticated
  USING (project_id IN (SELECT public.get_my_assigned_project_ids()));

CREATE POLICY "recurring_monthly: admin manage"
  ON public.recurring_monthly_schedules FOR ALL TO authenticated
  USING   (project_id IN (SELECT public.get_my_admin_project_ids()))
  WITH CHECK (project_id IN (SELECT public.get_my_admin_project_ids()));

CREATE POLICY "recurring_monthly: worker read"
  ON public.recurring_monthly_schedules FOR SELECT TO authenticated
  USING (project_id IN (SELECT public.get_my_assigned_project_ids()));

CREATE POLICY "hotel_details: admin manage"
  ON public.hotel_project_details FOR ALL TO authenticated
  USING   (project_id IN (SELECT public.get_my_admin_project_ids()))
  WITH CHECK (project_id IN (SELECT public.get_my_admin_project_ids()));

CREATE POLICY "hotel_details: worker read"
  ON public.hotel_project_details FOR SELECT TO authenticated
  USING (project_id IN (SELECT public.get_my_assigned_project_ids()));

CREATE POLICY "hotel_floors: admin manage"
  ON public.hotel_floors FOR ALL TO authenticated
  USING   (hotel_detail_id IN (SELECT project_id FROM public.hotel_project_details WHERE project_id IN (SELECT public.get_my_admin_project_ids())));

CREATE POLICY "hotel_floors: worker read"
  ON public.hotel_floors FOR SELECT TO authenticated
  USING (hotel_detail_id IN (SELECT project_id FROM public.hotel_project_details WHERE project_id IN (SELECT public.get_my_assigned_project_ids())));

CREATE POLICY "hotel_staffing: admin manage"
  ON public.hotel_staffing_rules FOR ALL TO authenticated
  USING   (hotel_detail_id IN (SELECT project_id FROM public.hotel_project_details WHERE project_id IN (SELECT public.get_my_admin_project_ids())));

CREATE POLICY "hotel_staffing: worker read"
  ON public.hotel_staffing_rules FOR SELECT TO authenticated
  USING (hotel_detail_id IN (SELECT project_id FROM public.hotel_project_details WHERE project_id IN (SELECT public.get_my_assigned_project_ids())));

CREATE POLICY "hotel_work_areas: admin manage"
  ON public.hotel_work_areas FOR ALL TO authenticated
  USING   (hotel_detail_id IN (SELECT project_id FROM public.hotel_project_details WHERE project_id IN (SELECT public.get_my_admin_project_ids())));

CREATE POLICY "hotel_work_areas: worker read"
  ON public.hotel_work_areas FOR SELECT TO authenticated
  USING (hotel_detail_id IN (SELECT project_id FROM public.hotel_project_details WHERE project_id IN (SELECT public.get_my_assigned_project_ids())));
