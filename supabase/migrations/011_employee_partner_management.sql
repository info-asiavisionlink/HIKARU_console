-- ============================================================
-- HIKARU: 従業員・協力業者管理 / 案件割り当てリファクタリング
--
-- 変更内容:
--   1. employees テーブル（従業員マスタ）
--   2. partners テーブル（協力業者マスタ）
--   3. project_assignments テーブル（案件割り当て: 従業員・協力業者両対応）
--   4. profiles テーブルに entity_type / entity_id を追加
--   5. RLS ポリシー更新
-- ============================================================

-- ============================================================
-- 1. Enum 追加
-- ============================================================

CREATE TYPE public.employee_status AS ENUM (
  'active',      -- 在籍中
  'on_leave',    -- 休職中
  'resigned',    -- 退職
  'suspended',   -- 利用停止
  'deleted'      -- 削除済み（論理削除）
);

CREATE TYPE public.partner_status AS ENUM (
  'active',      -- 契約中
  'suspended',   -- 一時停止
  'terminated',  -- 契約終了
  'deleted'      -- 削除済み（論理削除）
);

-- ============================================================
-- 2. employees テーブル（従業員マスタ）
-- ============================================================

CREATE TABLE public.employees (
  id                  UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number     TEXT                   UNIQUE,
  company_id          UUID                   NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name                TEXT                   NOT NULL,
  name_kana           TEXT,
  birth_date          DATE,
  gender              TEXT                   CHECK (gender IN ('male', 'female', 'other')),
  phone               TEXT,
  email               TEXT,
  address             TEXT,
  emergency_contact   TEXT,
  hire_date           DATE,
  department          TEXT,
  position            TEXT,
  qualifications      TEXT[]                 NOT NULL DEFAULT '{}',
  notes               TEXT,
  status              public.employee_status NOT NULL DEFAULT 'active',
  -- ログインアカウントとの紐付け（任意）
  auth_user_id        UUID                   UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ            NOT NULL DEFAULT NOW()
);

CREATE INDEX employees_company_id_idx   ON public.employees(company_id);
CREATE INDEX employees_status_idx       ON public.employees(status);
CREATE INDEX employees_auth_user_id_idx ON public.employees(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- 社員番号の自動採番
CREATE SEQUENCE public.employee_number_seq START 1;

CREATE OR REPLACE FUNCTION public.set_employee_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.employee_number IS NULL THEN
    NEW.employee_number = 'EMP-' || LPAD(nextval('employee_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER employees_set_number
  BEFORE INSERT ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_employee_number();

CREATE TRIGGER employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 3. partners テーブル（協力業者マスタ）
-- ============================================================

CREATE TABLE public.partners (
  id                    UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID                  NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  company_name          TEXT                  NOT NULL,
  company_name_kana     TEXT,
  contact_person_name   TEXT,
  contact_person_kana   TEXT,
  phone                 TEXT,
  email                 TEXT,
  address               TEXT,
  billing_info          JSONB,
  contract_start_date   DATE,
  contract_end_date     DATE,
  service_areas         TEXT[]                NOT NULL DEFAULT '{}',
  service_types         TEXT[]                NOT NULL DEFAULT '{}',
  qualifications        TEXT[]                NOT NULL DEFAULT '{}',
  notes                 TEXT,
  status                public.partner_status NOT NULL DEFAULT 'active',
  -- ログインアカウントとの紐付け（任意）
  auth_user_id          UUID                  UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

CREATE INDEX partners_company_id_idx   ON public.partners(company_id);
CREATE INDEX partners_status_idx       ON public.partners(status);
CREATE INDEX partners_auth_user_id_idx ON public.partners(auth_user_id) WHERE auth_user_id IS NOT NULL;

CREATE TRIGGER partners_updated_at
  BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 4. project_assignments テーブル（案件割り当て）
--    project_workers の後継: 従業員・協力業者の両方に対応
-- ============================================================

CREATE TABLE public.project_assignments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  assignee_type TEXT        NOT NULL CHECK (assignee_type IN ('employee', 'partner')),
  assignee_id   UUID        NOT NULL,
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, assignee_type, assignee_id)
);

CREATE INDEX project_assignments_project_id_idx ON public.project_assignments(project_id);
CREATE INDEX project_assignments_assignee_idx   ON public.project_assignments(assignee_type, assignee_id);

-- ============================================================
-- 5. profiles テーブルに entity_type / entity_id を追加
--    auth_user_id から従業員・協力業者レコードを特定するため
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS entity_type TEXT CHECK (entity_type IN ('employee', 'partner')),
  ADD COLUMN IF NOT EXISTS entity_id   UUID;

-- ============================================================
-- 6. SECURITY DEFINER ヘルパー関数
--    RLS 内からのクロステーブル参照による再帰を防ぐ
-- ============================================================

-- 現在のユーザーの entity_id（employees.id or partners.id）を取得
CREATE OR REPLACE FUNCTION public.get_my_entity_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT entity_id FROM public.profiles WHERE id = auth.uid()
$$;

-- 現在のユーザーの entity_type を取得
CREATE OR REPLACE FUNCTION public.get_my_entity_type()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT entity_type FROM public.profiles WHERE id = auth.uid()
$$;

-- 現在のユーザーが担当する project_id 一覧（project_assignments 経由）
CREATE OR REPLACE FUNCTION public.get_my_assigned_project_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pa.project_id
  FROM public.project_assignments pa
  WHERE pa.assignee_id   = public.get_my_entity_id()
    AND pa.assignee_type = public.get_my_entity_type()
$$;

-- 管理者の会社の全 project_id（既存 get_my_admin_project_ids を上書き）
CREATE OR REPLACE FUNCTION public.get_my_admin_project_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.projects p
  INNER JOIN public.profiles prof ON prof.company_id = p.company_id
  WHERE prof.id = auth.uid() AND prof.role = 'admin'
$$;

-- 管理者の company_id を取得
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid()
$$;

-- ============================================================
-- 7. RLS ポリシー
-- ============================================================

ALTER TABLE public.employees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;

-- ---- employees RLS ----

-- 管理者は自社の全従業員を参照・管理可能
CREATE POLICY "employees: admin manage"
  ON public.employees FOR ALL TO authenticated
  USING   (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

-- 従業員は自分のレコードのみ参照可能
CREATE POLICY "employees: self read"
  ON public.employees FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

-- ---- partners RLS ----

-- 管理者は自社の全協力業者を参照・管理可能
CREATE POLICY "partners: admin manage"
  ON public.partners FOR ALL TO authenticated
  USING   (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

-- 協力業者は自分のレコードのみ参照可能
CREATE POLICY "partners: self read"
  ON public.partners FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

-- ---- project_assignments RLS ----

-- 管理者は自社案件の割り当てを全管理
CREATE POLICY "project_assignments: admin manage"
  ON public.project_assignments FOR ALL TO authenticated
  USING   (project_id IN (SELECT public.get_my_admin_project_ids()))
  WITH CHECK (project_id IN (SELECT public.get_my_admin_project_ids()));

-- 担当者は自分の割り当てのみ参照
CREATE POLICY "project_assignments: self read"
  ON public.project_assignments FOR SELECT TO authenticated
  USING (
    assignee_id   = public.get_my_entity_id()
    AND assignee_type = public.get_my_entity_type()
  );

-- ================================================================
-- 8. projects の RLS ポリシー更新（project_assignments に対応）
-- ================================================================

-- 作業者（従業員・協力業者）向けポリシーを更新
DROP POLICY IF EXISTS "projects: assigned workers read" ON public.projects;

CREATE POLICY "projects: assigned workers read"
  ON public.projects FOR SELECT TO authenticated
  USING (
    id IN (SELECT public.get_my_assigned_project_ids())
  );

-- ================================================================
-- 9. 既存 project_workers データを project_assignments へ移行
--    （profiles に entity_id が設定された後に再実行）
-- ================================================================
-- 下記は初回移行用。profiles.entity_id 設定後に実行してください。
-- INSERT INTO public.project_assignments (project_id, assignee_type, assignee_id, assigned_at)
-- SELECT pw.project_id, 'employee', e.id, pw.assigned_at
-- FROM public.project_workers pw
-- INNER JOIN public.employees e ON e.auth_user_id = pw.worker_id
-- ON CONFLICT DO NOTHING;

-- ================================================================
-- 10. jobs / manuals / photo_spots の RLS を project_assignments に対応
-- ================================================================

-- jobs: 担当プロジェクトの job を参照可能
DROP POLICY IF EXISTS "jobs: assigned workers read" ON public.jobs;
CREATE POLICY "jobs: assigned workers read"
  ON public.jobs FOR SELECT TO authenticated
  USING (
    project_id IN (SELECT public.get_my_assigned_project_ids())
  );
