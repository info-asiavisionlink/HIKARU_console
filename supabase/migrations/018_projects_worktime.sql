-- ============================================================
-- HIKARU: 案件テーブルに開始・終了時刻カラムを追加
-- ============================================================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS work_start_time TIME,
  ADD COLUMN IF NOT EXISTS work_end_time   TIME;
