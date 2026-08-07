-- ============================================================
-- HIKARU: photo_spots.store_id を NULL 許容に変更
--
-- 案件中心設計（migration 008）でproject_idを追加したが、
-- store_id NOT NULL制約が残っておりproject_idのみでのINSERTが失敗していた。
-- ============================================================

ALTER TABLE public.photo_spots
  ALTER COLUMN store_id DROP NOT NULL;
