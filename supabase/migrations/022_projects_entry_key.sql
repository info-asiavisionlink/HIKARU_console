-- ============================================================
-- HIKARU: 案件テーブルに入館経路・鍵情報カラムを追加
-- ============================================================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS entry_route  TEXT,           -- 入館経路・入室経路
  ADD COLUMN IF NOT EXISTS key_borrowing BOOLEAN NOT NULL DEFAULT false, -- 鍵の借用有無
  ADD COLUMN IF NOT EXISTS key_count    INTEGER,         -- 鍵の本数
  ADD COLUMN IF NOT EXISTS key_model    TEXT,            -- 鍵の型番
  ADD COLUMN IF NOT EXISTS key_usage    TEXT;            -- 鍵の使用箇所
