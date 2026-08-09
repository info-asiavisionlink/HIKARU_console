-- ============================================================
-- HIKARU: photos Storage バケット + RLS ポリシー
--
-- 背景: Migration 004 では photos テーブルの RLS のみ定義し、
--       Storage バケットは「Dashboardから手動作成」としていた。
--       本 Migration でコードベースから完全に管理できるよう修正。
-- ============================================================

-- photos バケット作成（public: true — UIで直接画像表示するため）
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

-- 既存ポリシーをクリーンアップ
DROP POLICY IF EXISTS "photos_storage: worker upload"  ON storage.objects;
DROP POLICY IF EXISTS "photos_storage: worker delete"  ON storage.objects;
DROP POLICY IF EXISTS "photos_storage: public read"    ON storage.objects;
DROP POLICY IF EXISTS "photos_storage: admin read"     ON storage.objects;

-- 認証済みワーカーはアップロード可能
-- パス: {jobId}/{type}/{spotId}_{timestamp}.{ext}
CREATE POLICY "photos_storage: worker upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'photos');

-- 認証済みワーカーは自分がアップロードしたファイルを削除可能
CREATE POLICY "photos_storage: worker delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'photos' AND owner = auth.uid());

-- Public バケットのため public READ（フロント直接表示用）
CREATE POLICY "photos_storage: public read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'photos');
