-- ============================================================
-- HIKARU: 単価・売上管理機能
--   請求書作成・売上分析・月次/年次集計の基盤
-- ============================================================

-- ============================================================
-- 1. 請求ステータス Enum
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.billing_status AS ENUM (
    'unbilled',          -- 未請求
    'billed',            -- 請求済
    'awaiting_payment',  -- 入金待ち
    'paid',              -- 入金済
    'on_hold',           -- 保留
    'cancelled'          -- キャンセル
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. 案件請求情報 (project_billing) — 1:1 with projects
--    契約日・請求日・入金日・請求状況など
-- ============================================================

CREATE TABLE IF NOT EXISTS public.project_billing (
  project_id          UUID                   PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  billing_status      public.billing_status  NOT NULL DEFAULT 'unbilled',
  quote_number        TEXT,                             -- 見積番号
  contract_date       DATE,                             -- 契約日
  billing_date        DATE,                             -- 請求予定日
  payment_due_date    DATE,                             -- 入金予定日
  actual_payment_date DATE,                             -- 実際の入金日
  notes               TEXT,                             -- 備考
  created_at          TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ            NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS project_billing_status_idx
  ON public.project_billing(billing_status);

CREATE TRIGGER project_billing_updated_at
  BEFORE UPDATE ON public.project_billing
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 3. 案件単価情報 (project_prices)
--    spot/hotel: period_month IS NULL (1レコード)
--    recurring:  period_month 1-12 (最大12レコード)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.project_prices (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  -- 定期案件: 1-12（月） / 単発・ホテル: NULL
  period_month    INTEGER     CHECK (period_month BETWEEN 1 AND 12),

  -- 金額（税抜）
  amount_ex_tax   NUMERIC(14,0) NOT NULL DEFAULT 0,

  -- 消費税
  tax_rate        NUMERIC(5,4) NOT NULL DEFAULT 0.10,   -- 0.10 = 10%
  tax_amount      NUMERIC(14,0) NOT NULL DEFAULT 0,     -- 自動計算・保存
  amount_inc_tax  NUMERIC(14,0) NOT NULL DEFAULT 0,     -- 自動計算・保存

  -- ホテル専用: 1室単価 × 客室数
  unit_price      NUMERIC(14,0),                        -- 1室単価（税抜）
  quantity        INTEGER,                              -- 客室数

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- spot/hotel: project_id ごとに1レコードのみ (period_month IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS project_prices_single_idx
  ON public.project_prices(project_id)
  WHERE period_month IS NULL;

-- recurring: project_id × month でユニーク
CREATE UNIQUE INDEX IF NOT EXISTS project_prices_monthly_idx
  ON public.project_prices(project_id, period_month)
  WHERE period_month IS NOT NULL;

CREATE INDEX IF NOT EXISTS project_prices_project_id_idx
  ON public.project_prices(project_id);

CREATE TRIGGER project_prices_updated_at
  BEFORE UPDATE ON public.project_prices
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 4. 売上集計用 VIEW（パフォーマンス向上）
-- ============================================================

CREATE OR REPLACE VIEW public.v_project_revenue AS
SELECT
  p.id              AS project_id,
  p.company_id,
  p.name            AS project_name,
  p.project_type,
  p.status          AS project_status,
  p.client_id,
  pb.billing_status,
  pb.billing_date,
  pb.payment_due_date,
  pb.actual_payment_date,
  pb.contract_date,
  SUM(pp.amount_ex_tax)  AS total_ex_tax,
  SUM(pp.tax_amount)     AS total_tax,
  SUM(pp.amount_inc_tax) AS total_inc_tax
FROM public.projects p
LEFT JOIN public.project_billing pb ON pb.project_id = p.id
LEFT JOIN public.project_prices  pp ON pp.project_id = p.id
GROUP BY p.id, p.company_id, p.name, p.project_type, p.status, p.client_id,
         pb.billing_status, pb.billing_date, pb.payment_due_date,
         pb.actual_payment_date, pb.contract_date;

-- ============================================================
-- 5. RLS
-- ============================================================

ALTER TABLE public.project_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_prices  ENABLE ROW LEVEL SECURITY;

-- 管理者のみアクセス可（作業者は閲覧不可）
CREATE POLICY "project_billing: admin only"
  ON public.project_billing FOR ALL TO authenticated
  USING (
    project_id IN (SELECT public.get_my_admin_project_ids())
  )
  WITH CHECK (
    project_id IN (SELECT public.get_my_admin_project_ids())
  );

CREATE POLICY "project_prices: admin only"
  ON public.project_prices FOR ALL TO authenticated
  USING (
    project_id IN (SELECT public.get_my_admin_project_ids())
  )
  WITH CHECK (
    project_id IN (SELECT public.get_my_admin_project_ids())
  );
