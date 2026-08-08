-- ============================================================
-- HIKARU: マニュアルに会社レベルのテンプレート機能を追加
-- project_id を nullable に変更し、company_id を追加
-- ============================================================

-- company_id カラムを追加
ALTER TABLE public.manuals
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- project_id の NOT NULL 制約を解除
ALTER TABLE public.manuals
  ALTER COLUMN project_id DROP NOT NULL;

-- カテゴリカラムを追加（清掃種別など）
ALTER TABLE public.manuals
  ADD COLUMN IF NOT EXISTS category TEXT;

-- is_template フラグ追加（会社共通マニュアル）
ALTER TABLE public.manuals
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false;

-- インデックス
CREATE INDEX IF NOT EXISTS manuals_company_id_idx ON public.manuals(company_id);
CREATE INDEX IF NOT EXISTS manuals_is_template_idx ON public.manuals(is_template);
