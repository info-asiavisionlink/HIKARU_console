-- ============================================================
-- HIKARU: 案件中心設計へのマイグレーション
-- 店舗管理を廃止し、案件に作業場所情報を統合
-- ============================================================

-- ---- projects テーブルに作業場所情報を追加 ----
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS location_name   TEXT,         -- 作業場所名（建物名・施設名）
  ADD COLUMN IF NOT EXISTS phone           TEXT,         -- 連絡先電話番号
  ADD COLUMN IF NOT EXISTS emergency_contact TEXT,       -- 緊急連絡先
  ADD COLUMN IF NOT EXISTS business_hours  TEXT;         -- 作業可能時間帯

-- store_id をオプション（NULL許容）に変更
ALTER TABLE public.projects
  ALTER COLUMN store_id DROP NOT NULL;

-- ---- photo_spots に project_id を追加 ----
ALTER TABLE public.photo_spots
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS photo_spots_project_id_idx
  ON public.photo_spots(project_id);

-- ---- photo_spots の RLS に project_id ベースのポリシーを追加 ----

-- 管理者: project経由で撮影箇所を管理
DROP POLICY IF EXISTS "photo_spots: admin manage by project" ON public.photo_spots;
CREATE POLICY "photo_spots: admin manage by project"
  ON public.photo_spots FOR ALL TO authenticated
  USING (
    project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = photo_spots.project_id
        AND public.is_admin_of(p.company_id)
    )
  )
  WITH CHECK (
    project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = photo_spots.project_id
        AND public.is_admin_of(p.company_id)
    )
  );

-- 作業者: 自分のjobに紐づく案件の撮影箇所を参照
DROP POLICY IF EXISTS "photo_spots: worker read by project" ON public.photo_spots;
CREATE POLICY "photo_spots: worker read by project"
  ON public.photo_spots FOR SELECT TO authenticated
  USING (
    project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.project_id = photo_spots.project_id
        AND j.worker_id  = auth.uid()
    )
  );

-- ============================================================
-- 既存データ移行: stores経由のphoto_spotsをプロジェクトに紐付け
-- store_id → store に紐づく最初のprojectへ移行
-- ============================================================
UPDATE public.photo_spots ps
SET    project_id = (
  SELECT p.id
  FROM   public.projects p
  WHERE  p.store_id = ps.store_id
  ORDER  BY p.created_at ASC
  LIMIT  1
)
WHERE  ps.project_id IS NULL
  AND  ps.store_id IS NOT NULL;
