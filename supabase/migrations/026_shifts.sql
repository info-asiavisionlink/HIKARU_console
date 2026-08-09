-- ============================================================
-- HIKARU: シフト管理テーブル
-- SHIFT = 予定（JOB = 実績と明確に区別）
-- ============================================================
-- 設計思想:
--   1シフト = 1人の予定。複数人配置は複数レコードで表現。
--   employee / partner 両方対応。
--   将来のLINE通知・給与計算と接続できる構造。
-- ============================================================

-- ============================================================
-- 1. shifts テーブル
-- ============================================================

CREATE TABLE IF NOT EXISTS public.shifts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id      UUID        NOT NULL REFERENCES public.projects(id)  ON DELETE CASCADE,

  -- 担当者種別: employee または partner
  assignee_type   TEXT        NOT NULL CHECK (assignee_type IN ('employee', 'partner')),
  employee_id     UUID        REFERENCES public.employees(id) ON DELETE SET NULL,
  partner_id      UUID        REFERENCES public.partners(id)  ON DELETE SET NULL,

  -- 日時（予定）
  shift_date      DATE        NOT NULL,
  start_time      TIME        NOT NULL,
  end_time        TIME        NOT NULL,

  -- ステータス
  status          TEXT        NOT NULL DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled')),

  notes           TEXT,
  created_by      UUID        REFERENCES public.profiles(id)  ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 制約: assignee_type と実IDの整合性
  CONSTRAINT shifts_assignee_check CHECK (
    (assignee_type = 'employee' AND employee_id IS NOT NULL AND partner_id IS NULL) OR
    (assignee_type = 'partner'  AND partner_id  IS NOT NULL AND employee_id IS NULL)
  ),
  -- 開始 < 終了
  CONSTRAINT shifts_time_check CHECK (start_time < end_time)
);

-- インデックス
CREATE INDEX IF NOT EXISTS shifts_company_id_idx   ON public.shifts(company_id);
CREATE INDEX IF NOT EXISTS shifts_project_id_idx   ON public.shifts(project_id);
CREATE INDEX IF NOT EXISTS shifts_shift_date_idx   ON public.shifts(shift_date);
CREATE INDEX IF NOT EXISTS shifts_employee_id_idx  ON public.shifts(employee_id);
CREATE INDEX IF NOT EXISTS shifts_partner_id_idx   ON public.shifts(partner_id);
CREATE INDEX IF NOT EXISTS shifts_status_idx       ON public.shifts(status);
CREATE INDEX IF NOT EXISTS shifts_date_company_idx ON public.shifts(company_id, shift_date);
CREATE INDEX IF NOT EXISTS shifts_date_project_idx ON public.shifts(shift_date, project_id);

-- updated_at トリガー
CREATE TRIGGER shifts_updated_at
  BEFORE UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 2. RLS
-- ============================================================

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

-- 管理者: 同一会社のシフトをCRUD
CREATE POLICY "shifts: admin CRUD"
  ON public.shifts FOR ALL TO authenticated
  USING   (public.is_admin_of(company_id))
  WITH CHECK (public.is_admin_of(company_id));

-- 従業員: auth_user_id 経由で自分のシフトのみSELECT
CREATE POLICY "shifts: employee read own"
  ON public.shifts FOR SELECT TO authenticated
  USING (
    assignee_type = 'employee'
    AND employee_id IN (
      SELECT id FROM public.employees
      WHERE auth_user_id = auth.uid()
    )
  );

-- 協力業者: auth_user_id 経由で自分のシフトのみSELECT
CREATE POLICY "shifts: partner read own"
  ON public.shifts FOR SELECT TO authenticated
  USING (
    assignee_type = 'partner'
    AND partner_id IN (
      SELECT id FROM public.partners
      WHERE auth_user_id = auth.uid()
    )
  );

-- ============================================================
-- 3. ヘルパー関数: 自分のシフト取得（RLS再帰回避用）
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_shift_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id FROM public.shifts s
  WHERE (
    s.assignee_type = 'employee' AND s.employee_id IN (
      SELECT id FROM public.employees WHERE auth_user_id = auth.uid()
    )
  ) OR (
    s.assignee_type = 'partner' AND s.partner_id IN (
      SELECT id FROM public.partners WHERE auth_user_id = auth.uid()
    )
  )
$$;

-- ============================================================
-- 4. 重複チェック用関数
--    同一人物が同日時に別シフトを持つか確認
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_shift_overlap(
  p_employee_id  UUID,
  p_partner_id   UUID,
  p_assignee_type TEXT,
  p_shift_date   DATE,
  p_start_time   TIME,
  p_end_time     TIME,
  p_exclude_id   UUID DEFAULT NULL
)
RETURNS TABLE (
  shift_id     UUID,
  project_name TEXT,
  start_time   TIME,
  end_time     TIME
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    p.name,
    s.start_time,
    s.end_time
  FROM public.shifts s
  JOIN public.projects p ON p.id = s.project_id
  WHERE s.shift_date   = p_shift_date
    AND s.status       NOT IN ('cancelled')
    AND (p_exclude_id IS NULL OR s.id != p_exclude_id)
    AND (
      (p_assignee_type = 'employee' AND s.employee_id = p_employee_id)
      OR
      (p_assignee_type = 'partner'  AND s.partner_id  = p_partner_id)
    )
    AND s.start_time < p_end_time
    AND s.end_time   > p_start_time
$$;
