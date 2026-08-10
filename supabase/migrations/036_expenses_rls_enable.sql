-- 036_expenses_rls_enable.sql
-- expenses テーブルの RLS 有効化
-- 027_expense_claims.sql でポリシーは定義済みだが ENABLE が漏れていた

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
