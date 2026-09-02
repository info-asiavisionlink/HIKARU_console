-- ============================================================
-- 051: Platform Operator Authorization Foundation
--
-- Phase P1 — 権限基盤のみ
--
-- 目的:
--   HIKARU運営(Platform Operator)を、
--   Customer Company Admin (profiles.role='admin') と
--   完全に分離した権限として管理する。
--
-- 方針:
--   ADDITIVE ONLY — 既存テーブル/カラム/ポリシー/トリガーは一切変更しない
--   最小Schemaのみ追加
--
-- 追加するもの:
--   1. platform_operators テーブル
--   2. is_platform_operator() 判定関数
--   3. RLS (authenticatedからのアクセス完全禁止 — Service Roleのみ)
--
-- 変更禁止:
--   companies / profiles / employees / clients / stores / projects /
--   jobs / expenses / invoices / handle_new_user() トリガー等
--
-- 重要な設計判断:
--   - platform_operators は Tenant Data ではないため company_id を持たない
--   - authenticated clientからの直接CRUDを一切許可しない (Policy無)
--   - Service Role (Server-side trusted) 経由でのみ管理可能
--   - is_platform_operator() は auth.uid() のみ参照。引数受け取らない
-- ============================================================

-- ============================================================
-- 1. platform_operators テーブル
-- ============================================================

CREATE TABLE IF NOT EXISTS public.platform_operators (
  auth_user_id UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note         TEXT
);

COMMENT ON TABLE public.platform_operators
  IS 'HIKARU Platform Operator (運営) の権限マスタ。Customer Admin (profiles.role=admin) とは完全に別権限。管理は Service Role SQL のみ。';

COMMENT ON COLUMN public.platform_operators.auth_user_id
  IS 'auth.users.id への参照。同一ユーザーは1度のみ登録可 (PK)。';

COMMENT ON COLUMN public.platform_operators.granted_at
  IS '権限付与日時。監査用。';

COMMENT ON COLUMN public.platform_operators.note
  IS '運用メモ (誰が/なぜ付与したか等)。任意。';

-- ============================================================
-- 2. RLS
--
-- 設計:
--   - ENABLE RLS
--   - Policyを一切作成しない
--   → authenticated / anon からは SELECT/INSERT/UPDATE/DELETE 全て拒否
--   → Service Role (postgres role) のみ操作可能
--
-- Customer Admin, Worker, Client, Public は
-- このテーブルの存在すら確認できない。
-- ============================================================

ALTER TABLE public.platform_operators ENABLE ROW LEVEL SECURITY;

-- NOTE: 意図的に CREATE POLICY を書かない。
--       RLS有効 + Policy無 = 全 authenticated roleから完全deny。
--       Service Role は BYPASSRLS のため引き続きアクセス可能。

-- ============================================================
-- 3. is_platform_operator() 判定関数
--
-- 特徴:
--   - 引数なし (auth.uid() のみ参照 — Browser供給値を信用しない)
--   - BOOLEAN のみ返却 (Tenantデータを漏らさない)
--   - SECURITY DEFINER (RLSで完全denyされている platform_operators を参照するため)
--   - search_path 固定 (search_path injection攻撃対策)
--
-- 使用場所 (将来):
--   - RLS Policy 内で is_platform_operator()
--   - Server-side helper でも呼び出し可能 (adminClient経由)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_platform_operator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_operators
    WHERE auth_user_id = auth.uid()
  )
$$;

COMMENT ON FUNCTION public.is_platform_operator()
  IS 'HIKARU Platform Operator判定。auth.uid() のみ参照。Customer Adminとは別権限。';

-- ============================================================
-- Rollback (参考):
--   DROP FUNCTION IF EXISTS public.is_platform_operator();
--   DROP TABLE     IF EXISTS public.platform_operators;
-- ============================================================
