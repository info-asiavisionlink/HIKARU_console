-- ============================================================
-- HIKARU Phase A: notifications テーブル拡張
-- 038_notifications_target_app.sql
--
-- 目的:
--   1. recipient_profile_id を正式に migration 管理へ取り込む
--   2. target_app カラムを追加（worker/console 分離のため）
--   3. 通知取得用インデックスを追加する
--
-- 注意:
--   - 本番 DB には recipient_profile_id が既に存在する可能性がある
--   - 既存データの UPDATE/DELETE は一切行わない
--   - 既存 RLS/policy は変更しない
--   - 既存通知レコードは NULL のまま維持する（backfill 禁止）
-- ============================================================

-- ============================================================
-- 1. recipient_profile_id 正式化
--    本番 DB で既に存在する場合は IF NOT EXISTS でスキップ
-- ============================================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS recipient_profile_id UUID;

-- ============================================================
-- 2. recipient_profile_id → profiles(id) FK 安全追加
--    本番 DB に既に同 FK が存在する場合は追加しない
--    fk_column と fk_referenced の両条件で既存 FK を判定
--    NOT VALID: 既存レコードの整合性チェックをスキップして
--               高速・ロック最小化で追加する
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.referential_constraints rc
    JOIN   information_schema.key_column_usage         kcu
           ON  kcu.constraint_name  = rc.constraint_name
           AND kcu.constraint_schema = rc.constraint_schema
    JOIN   information_schema.constraint_column_usage  ccu
           ON  ccu.constraint_name  = rc.unique_constraint_name
           AND ccu.constraint_schema = rc.constraint_schema
    WHERE  kcu.table_schema   = 'public'
    AND    kcu.table_name     = 'notifications'
    AND    kcu.column_name    = 'recipient_profile_id'
    AND    ccu.table_name     = 'profiles'
    AND    ccu.column_name    = 'id'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_recipient_profile_id_fkey
        FOREIGN KEY (recipient_profile_id)
        REFERENCES public.profiles(id)
        ON DELETE SET NULL
        NOT VALID;
  END IF;
END $$;

-- ============================================================
-- 3. recipient_profile_id インデックス
-- ============================================================

CREATE INDEX IF NOT EXISTS notifications_recipient_profile_id_idx
  ON public.notifications(recipient_profile_id);

-- ============================================================
-- 4. 未読通知用複合インデックス
--    Worker/CONSOLE 双方の未読一覧クエリを高速化する
-- ============================================================

CREATE INDEX IF NOT EXISTS notifications_recipient_unread_idx
  ON public.notifications(recipient_profile_id, type, created_at DESC)
  WHERE is_read = false;

-- ============================================================
-- 5. target_app カラム追加
--    'worker' | 'console' | NULL(legacy)
--    DEFAULT なし: 既存レコードはすべて NULL のまま
--    Phase B 以降でコード側から明示的に設定する
-- ============================================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS target_app TEXT
  CHECK (target_app IS NULL OR target_app IN ('worker', 'console'));

-- ============================================================
-- 6. target_app インデックス
-- ============================================================

CREATE INDEX IF NOT EXISTS notifications_target_app_idx
  ON public.notifications(target_app);

-- ============================================================
-- 注: 既存通知への UPDATE は一切行わない
--     target_app = NULL のレコードは Phase B 以降の API で
--     後方互換として 'target_app IS NULL' を許容する設計
-- ============================================================
