-- ============================================================
-- HIKARU: 鍵情報を個別カラムからJSONB配列に変更
-- key_count / key_model / key_usage → keys_info JSONB
-- 例: [{"model": "MIWA LA", "usage": "玄関"}, {"model": "GOAL V18", "usage": "倉庫"}]
-- ============================================================

ALTER TABLE public.projects
  DROP COLUMN IF EXISTS key_count,
  DROP COLUMN IF EXISTS key_model,
  DROP COLUMN IF EXISTS key_usage,
  ADD COLUMN IF NOT EXISTS keys_info JSONB NOT NULL DEFAULT '[]';
