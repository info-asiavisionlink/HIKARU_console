-- ============================================================
-- 045: companies へ法人番号・電子印カラムを追加
-- Phase 1 — DB schema追加のみ
-- ============================================================
--
-- 追加カラム概要:
--
--   corporate_number  TEXT NULL
--     法人番号（13桁数字）。フォーマット検証はアプリ側で管理。
--     NULL は未設定を示す。
--
--   seal_path  TEXT NULL
--     会社電子印のSupabase Storage path。
--     例: {company_id}/seal.png
--     URLではなくpath形式で保存する。NULL は未登録を示す。
--
-- 設計方針:
--   - 全項目 NULL 許可・DEFAULT なし
--   - 既存 company レコードはすべて新カラムが NULL のまま開始
--   - backfill（UPDATE）は行わない
--   - 既存カラムは一切変更しない
--   - RLS・policy・Storage は変更しない
--   - companies 以外のテーブルは変更しない
--
-- rollback:
--   ALTER TABLE public.companies
--     DROP COLUMN IF EXISTS corporate_number,
--     DROP COLUMN IF EXISTS seal_path;
-- ============================================================

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS corporate_number TEXT,
  ADD COLUMN IF NOT EXISTS seal_path        TEXT;

COMMENT ON COLUMN public.companies.corporate_number
  IS '法人番号（13桁数字）。NULLは未設定。';

COMMENT ON COLUMN public.companies.seal_path
  IS '会社電子印のSupabase Storage path。NULLは未登録。';
