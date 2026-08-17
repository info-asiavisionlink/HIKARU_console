-- ============================================================
-- 046: company-assets Private Storage bucket 作成
-- Phase 2 — 会社電子印用 bucket のみ
-- ============================================================
--
-- 背景:
--   Migration 045 で companies.seal_path (TEXT NULL) を追加済み。
--   seal_path には bucket 内 path（{company_id}/seal.png）を保存する。
--   本 Migration で storage bucket 基盤だけを作成する。
--
-- 設計方針:
--   - Public = false（Private bucket）
--   - 匿名・一般ユーザーの直接アクセス不可
--   - upload/download は Server側 service role で行う予定
--   - そのため Browser upload 用 RLS policy は追加しない
--   - 既存 bucket（documents / photos）は一切変更しない
--
-- path 仕様（将来 API 実装時に確定）:
--   bucket: company-assets
--   path:   {company_id}/seal.png
--   DB:     companies.seal_path = '{company_id}/seal.png'
--
-- rollback:
--   DELETE FROM storage.buckets WHERE id = 'company-assets';
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', false)
ON CONFLICT (id) DO NOTHING;
