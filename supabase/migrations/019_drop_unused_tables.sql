-- ============================================================
-- HIKARU: 不使用テーブルの削除
--
-- 削除対象:
--   1. project_workers  → project_assignments に完全移行済み、コード参照0件
--   2. locations        → 旧店舗ベース設計の残骸、コード参照0件
-- ============================================================

-- 1. project_workers（旧担当者テーブル）
--    project_assignments（employees/partners両対応）で置き換え済み
DROP TABLE IF EXISTS public.project_workers;

-- 2. locations（旧店舗内作業場所テーブル）
--    案件中心設計への移行後、完全に不使用
DROP TABLE IF EXISTS public.locations;
