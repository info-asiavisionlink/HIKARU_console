-- ============================================================
-- HIKARU Phase 7 修正: contract_expiry_notifications UNIQUE制約修正
--
-- 問題: 032_contracts.sql の UNIQUE (contract_id, notification_type, EXTRACT(YEAR...))
--       は PostgreSQL では無効構文（テーブルレベルUNIQUEに関数呼び出し不可）
--
-- 修正: テーブル定義からUNIQUEを削除し、Functional Unique Indexで代替
-- ============================================================

-- 既存のUNIQUE制約を削除（もし存在すれば）
DO $$
BEGIN
  -- contract_expiry_notifications の pkey 以外の unique constraint を削除
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'contract_expiry_notifications'
      AND constraint_type = 'UNIQUE'
      AND constraint_name != 'contract_expiry_notifications_pkey'
  ) THEN
    ALTER TABLE public.contract_expiry_notifications
      DROP CONSTRAINT IF EXISTS contract_expiry_notifications_contract_id_notification_type_key;
  END IF;
END;
$$;

-- Functional Unique Index で代替（年内重複防止）
CREATE UNIQUE INDEX IF NOT EXISTS cen_unique_per_year
  ON public.contract_expiry_notifications (
    contract_id,
    notification_type,
    (EXTRACT(YEAR FROM notified_at)::INTEGER)
  );

-- ============================================================
-- documents バケットのRLS強化
-- 問題: documents バケットが public=true のため請求書PDFが認証なしでアクセス可能
-- 修正: 既存の "documents: public read" ポリシーを削除し、認証必須に変更
-- ============================================================

-- 既存のPublic読み取りポリシーを削除
DROP POLICY IF EXISTS "documents: public read"   ON storage.objects;
DROP POLICY IF EXISTS "documents: authenticated read" ON storage.objects;

-- 認証済みユーザーのみ読み取り可能（company_id パスによる分離）
CREATE POLICY "documents: authenticated read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents');

-- 注意: documents バケット自体を private に変更する場合は Supabase Dashboard から実施
-- または: UPDATE storage.buckets SET public = false WHERE id = 'documents';
UPDATE storage.buckets SET public = false WHERE id = 'documents';
