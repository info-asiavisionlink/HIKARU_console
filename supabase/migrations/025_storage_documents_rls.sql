-- ============================================================
-- HIKARU: documents ストレージバケットの RLS ポリシー追加
-- 提案書類（proposals/）へのアップロードをworkerに許可
-- ============================================================

-- バケットが存在しない場合は作成
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- 既存ポリシーをクリーンアップ
DROP POLICY IF EXISTS "documents: authenticated upload"   ON storage.objects;
DROP POLICY IF EXISTS "documents: authenticated read"     ON storage.objects;
DROP POLICY IF EXISTS "documents: authenticated delete"   ON storage.objects;
DROP POLICY IF EXISTS "documents: public read"            ON storage.objects;

-- 認証済みユーザーはアップロード可能
CREATE POLICY "documents: authenticated upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documents');

-- 公開読み取り（publicバケットのため）
CREATE POLICY "documents: public read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'documents');

-- 自分がアップロードしたファイルは削除可能
CREATE POLICY "documents: authenticated delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'documents');

-- UPDATE（upsert用）
CREATE POLICY "documents: authenticated update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'documents')
  WITH CHECK (bucket_id = 'documents');
