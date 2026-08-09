-- ============================================================
-- HIKARU: RLS 無限再帰修正
-- 問題: projects ↔ project_workers のポリシーが互いを参照
--
-- 再帰チェーン:
--   SELECT projects
--   → "projects: assigned workers read" が project_workers を SELECT
--   → "project_workers: admin CRUD" が projects を SELECT
--   → "projects: assigned workers read" が project_workers を SELECT → ∞
--
-- 修正方針:
--   SECURITY DEFINER ヘルパー関数を使い、
--   ポリシー内から他テーブルを参照する際に RLS をバイパスする
-- ============================================================

-- ================================================================
-- Step 1: SECURITY DEFINER ヘルパー関数
--   ※ SECURITY DEFINER 関数は関数オーナー（postgres）として実行されるため
--      関数内のクエリには RLS が適用されず、循環参照を回避できる
-- ================================================================

-- 現在のユーザー（作業者）が担当する project_id 一覧
-- project_workers を RLS なしで参照
CREATE OR REPLACE FUNCTION public.get_my_assigned_project_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT project_id
  FROM public.project_workers
  WHERE worker_id = auth.uid()
$$;

-- 現在の管理者が所属する会社の project_id 一覧
-- projects・profiles を RLS なしで参照
CREATE OR REPLACE FUNCTION public.get_my_admin_project_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.projects p
  INNER JOIN public.profiles prof
    ON prof.company_id = p.company_id
  WHERE prof.id = auth.uid()
    AND prof.role = 'admin'
$$;

-- ================================================================
-- Step 2: projects ポリシー修正
-- ================================================================

-- 旧ポリシー削除
DROP POLICY IF EXISTS "projects: assigned workers read" ON public.projects;

-- 新ポリシー: SECURITY DEFINER 関数を使用（再帰しない）
CREATE POLICY "projects: assigned workers read"
  ON public.projects FOR SELECT TO authenticated
  USING (
    id IN (SELECT public.get_my_assigned_project_ids())
  );

-- ================================================================
-- Step 3: project_workers ポリシー修正
-- ================================================================

DROP POLICY IF EXISTS "project_workers: admin CRUD" ON public.project_workers;

-- 新ポリシー: SECURITY DEFINER 関数を使用（再帰しない）
CREATE POLICY "project_workers: admin CRUD"
  ON public.project_workers FOR ALL TO authenticated
  USING (
    project_id IN (SELECT public.get_my_admin_project_ids())
  );

-- ================================================================
-- Step 4: manuals ポリシー修正（同じ再帰に巻き込まれる）
-- ================================================================

DROP POLICY IF EXISTS "manuals: admin CRUD" ON public.manuals;
DROP POLICY IF EXISTS "manuals: assigned workers read" ON public.manuals;

CREATE POLICY "manuals: admin CRUD"
  ON public.manuals FOR ALL TO authenticated
  USING (
    project_id IN (SELECT public.get_my_admin_project_ids())
  );

CREATE POLICY "manuals: assigned workers read"
  ON public.manuals FOR SELECT TO authenticated
  USING (
    project_id IN (SELECT public.get_my_assigned_project_ids())
  );

-- ================================================================
-- Step 5: photo_spots ポリシー修正（project 経由で同再帰に入る）
-- ================================================================

DROP POLICY IF EXISTS "photo_spots: admin manage by project" ON public.photo_spots;
DROP POLICY IF EXISTS "photo_spots: worker read by project"  ON public.photo_spots;

CREATE POLICY "photo_spots: admin manage by project"
  ON public.photo_spots FOR ALL TO authenticated
  USING (
    project_id IS NOT NULL
    AND project_id IN (SELECT public.get_my_admin_project_ids())
  )
  WITH CHECK (
    project_id IS NOT NULL
    AND project_id IN (SELECT public.get_my_admin_project_ids())
  );

CREATE POLICY "photo_spots: worker read by project"
  ON public.photo_spots FOR SELECT TO authenticated
  USING (
    project_id IS NOT NULL
    AND project_id IN (SELECT public.get_my_assigned_project_ids())
  );

-- ================================================================
-- 検証クエリ（実行して確認してください）
-- ================================================================
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE tablename IN ('projects','project_workers','manuals','photo_spots')
-- ORDER BY tablename, policyname;
