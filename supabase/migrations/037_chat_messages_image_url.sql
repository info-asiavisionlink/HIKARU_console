-- ============================================================
-- Migration 037: chat_messages に AI質問用画像URLを追加
--
-- 目的:
--   Workerがチャットで写真を添付してAIに質問できるようにする。
--   Before/After Photo (photosテーブル) とは完全に分離する。
--
-- 影響:
--   - 既存テキストチャットはimage_url=NULLのまま動作継続
--   - photosテーブル・RLSは一切変更しない
--   - 既存RLSポリシーはそのまま維持
-- ============================================================

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- image_url は NULL 許可（テキストのみの既存チャットに影響しない）
-- base64をDBに保存することは禁止（URLのみ許可）
-- Storage path: chat/{worker_id}/{timestamp}.{ext}
-- （photosテーブルのpath: {jobId}/{type}/{spotId}_{timestamp}.{ext} と分離済み）

COMMENT ON COLUMN public.chat_messages.image_url IS
  'AI質問用添付画像のStorage URL。Before/After Photoとは別管理。NULL=テキストのみ';
