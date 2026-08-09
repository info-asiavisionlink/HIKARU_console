-- ============================================================
-- HIKARU: profiles RLS 無限再帰修正
-- 問題: profiles ポリシーが profiles 自身を参照 → 42P17
--
-- 再帰チェーン（例）:
--   SELECT profiles
--   → "profiles: admin read same company" が profiles を SELECT
--   → "profiles: admin read same company" が profiles を SELECT → ∞
--
-- 修正方針:
--   既存の SECURITY DEFINER 関数 is_admin_of() / is_member_of() を使う
--   (migration 002 で作成済み)
-- ============================================================

-- ================================================================
-- profiles ポリシー修正
-- ================================================================

DROP POLICY IF EXISTS "profiles: admin read same company"  ON public.profiles;
DROP POLICY IF EXISTS "profiles: admin update same company" ON public.profiles;

-- SECURITY DEFINER 関数経由で参照（RLS をバイパスするため再帰しない）
CREATE POLICY "profiles: admin read same company"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin_of(company_id));

CREATE POLICY "profiles: admin update same company"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin_of(company_id));

-- ================================================================
-- companies ポリシー修正
-- 問題: profiles を直接参照 → profiles RLS 評価 → 再帰の連鎖
-- ================================================================

DROP POLICY IF EXISTS "companies: members read own" ON public.companies;

-- is_member_of() は SECURITY DEFINER なので profiles RLS をバイパス
CREATE POLICY "companies: members read own"
  ON public.companies FOR SELECT
  TO authenticated
  USING (public.is_member_of(id));

-- ================================================================
-- 確認クエリ
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('profiles', 'companies')
-- ORDER BY tablename, policyname;
-- ================================================================
