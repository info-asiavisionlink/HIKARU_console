-- ============================================================
-- HIKARU: 見積書・請求書・入金管理
-- ============================================================
-- 設計思想:
--   invoices テーブル = 見積書(quote) + 請求書(invoice) の両方
--   invoice_items = 発行時点の金額Snapshot（案件単価と独立）
--   invoice_payments = 入金履歴（分割払い対応）
--   連番はDB関数で管理（並行処理でも重複しない）
-- ============================================================

-- ============================================================
-- 1. 請求書番号連番管理テーブル
-- ============================================================

CREATE TABLE IF NOT EXISTS public.invoice_number_counters (
  company_id     UUID   NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_type   TEXT   NOT NULL CHECK (invoice_type IN ('quote', 'invoice')),
  year           INTEGER NOT NULL,
  last_seq       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, invoice_type, year)
);

-- 次の番号を発行する関数（並行処理対応：行ロック使用）
CREATE OR REPLACE FUNCTION public.next_invoice_number(
  p_company_id   UUID,
  p_invoice_type TEXT,
  p_year         INTEGER DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_seq   INTEGER;
  v_prefix TEXT;
BEGIN
  v_prefix := CASE p_invoice_type
    WHEN 'quote'   THEN 'QUO'
    WHEN 'invoice' THEN 'INV'
    ELSE 'DOC'
  END;

  INSERT INTO public.invoice_number_counters (company_id, invoice_type, year, last_seq)
  VALUES (p_company_id, p_invoice_type, p_year, 1)
  ON CONFLICT (company_id, invoice_type, year)
  DO UPDATE SET last_seq = invoice_number_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;

  RETURN v_prefix || '-' || p_year || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$;

-- ============================================================
-- 2. invoices テーブル（見積書・請求書の本体）
-- ============================================================

CREATE TABLE IF NOT EXISTS public.invoices (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID        NOT NULL REFERENCES public.companies(id)  ON DELETE CASCADE,
  client_id         UUID        NOT NULL REFERENCES public.clients(id)    ON DELETE RESTRICT,
  project_id        UUID        REFERENCES public.projects(id)            ON DELETE SET NULL,

  -- 文書種別と番号
  invoice_type      TEXT        NOT NULL CHECK (invoice_type IN ('quote', 'invoice')),
  invoice_number    TEXT        NOT NULL,

  -- 見積書→請求書変換時の参照
  converted_from_id UUID        REFERENCES public.invoices(id)           ON DELETE SET NULL,

  -- 発行情報
  issue_date        DATE        NOT NULL DEFAULT CURRENT_DATE,
  due_date          DATE,                            -- 支払期限（請求書）/ 有効期限（見積書）
  billing_period_from DATE,                          -- 請求対象期間 開始
  billing_period_to   DATE,                          -- 請求対象期間 終了
  period_month      INTEGER CHECK (period_month BETWEEN 1 AND 12), -- 定期案件の対象月

  -- 金額（Snapshot: 発行時点で確定。item合計から自動計算）
  subtotal          NUMERIC(14,0) NOT NULL DEFAULT 0,
  tax_rate          NUMERIC(5,4)  NOT NULL DEFAULT 0.10,
  tax_amount        NUMERIC(14,0) NOT NULL DEFAULT 0,
  total_amount      NUMERIC(14,0) NOT NULL DEFAULT 0,

  -- 端数処理: 'floor'=切り捨て, 'round'=四捨五入, 'ceil'=切り上げ
  rounding_method   TEXT        NOT NULL DEFAULT 'floor'
                    CHECK (rounding_method IN ('floor', 'round', 'ceil')),

  -- ステータス
  -- quote:   draft → issued → accepted / rejected / cancelled
  -- invoice: draft → issued → sent → awaiting_payment → paid / overdue / cancelled
  status            TEXT        NOT NULL DEFAULT 'draft',

  -- 顧客ポータル公開
  published_to_portal BOOLEAN   NOT NULL DEFAULT false,
  published_at      TIMESTAMPTZ,

  -- PDF
  pdf_path          TEXT,                            -- Storage path
  pdf_generated_at  TIMESTAMPTZ,

  -- 入金情報（請求書）
  paid_amount       NUMERIC(14,0) NOT NULL DEFAULT 0,
  paid_at           TIMESTAMPTZ,

  -- 内容
  title             TEXT,                            -- 例: "定期清掃 2026年8月分"
  notes             TEXT,
  internal_memo     TEXT,                            -- 顧客には非表示

  -- 監査ログ
  created_by        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  issued_by         UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  issued_at         TIMESTAMPTZ,
  published_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancelled_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancelled_at      TIMESTAMPTZ,
  cancel_reason     TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (company_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS invoices_company_id_idx    ON public.invoices(company_id);
CREATE INDEX IF NOT EXISTS invoices_client_id_idx     ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS invoices_project_id_idx    ON public.invoices(project_id);
CREATE INDEX IF NOT EXISTS invoices_invoice_type_idx  ON public.invoices(invoice_type);
CREATE INDEX IF NOT EXISTS invoices_status_idx        ON public.invoices(status);
CREATE INDEX IF NOT EXISTS invoices_issue_date_idx    ON public.invoices(issue_date DESC);
CREATE INDEX IF NOT EXISTS invoices_due_date_idx      ON public.invoices(due_date);
CREATE INDEX IF NOT EXISTS invoices_published_idx     ON public.invoices(published_to_portal, client_id);

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 3. invoice_items テーブル（明細 / Snapshot）
-- ============================================================

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id     UUID          NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  order_num      INTEGER       NOT NULL DEFAULT 0,
  description    TEXT          NOT NULL,
  quantity       NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit           TEXT,                              -- 式/回/時間/㎡/室 etc.
  unit_price     NUMERIC(14,0) NOT NULL DEFAULT 0,
  amount         NUMERIC(14,0) NOT NULL DEFAULT 0, -- quantity × unit_price（サーバー計算）
  tax_rate       NUMERIC(5,4)  NOT NULL DEFAULT 0.10,
  -- Snapshot用（案件単価の参照元。金額は変化しない）
  source_type    TEXT,                              -- 'project_price' / 'manual' / 'discount'
  source_id      UUID,                              -- project_prices.id など
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invoice_items_invoice_id_idx ON public.invoice_items(invoice_id);

-- ============================================================
-- 4. invoice_payments テーブル（入金履歴）
-- ============================================================

CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID          NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  company_id      UUID          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount          NUMERIC(14,0) NOT NULL,
  paid_at         DATE          NOT NULL,
  payment_method  TEXT,                             -- bank_transfer / cash / credit_card / other
  notes           TEXT,
  recorded_by     UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invoice_payments_invoice_id_idx ON public.invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS invoice_payments_company_id_idx ON public.invoice_payments(company_id);

-- ============================================================
-- 5. RLS
-- ============================================================

ALTER TABLE public.invoices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

-- invoices: 管理者 CRUD
CREATE POLICY "invoices: admin CRUD"
  ON public.invoices FOR ALL TO authenticated
  USING   (public.is_admin_of(company_id))
  WITH CHECK (public.is_admin_of(company_id));

-- invoices: 顧客は公開済み + 自社案件のみ
CREATE POLICY "invoices: client read published"
  ON public.invoices FOR SELECT TO authenticated
  USING (
    published_to_portal = true
    AND client_id IN (
      SELECT c.id FROM public.clients c
      JOIN public.client_portal_accounts cpa
        ON cpa.client_id = c.id AND cpa.profile_id = auth.uid() AND cpa.is_active = true
    )
  );

-- invoice_items: 管理者
CREATE POLICY "invoice_items: admin CRUD"
  ON public.invoice_items FOR ALL TO authenticated
  USING (
    invoice_id IN (SELECT id FROM public.invoices WHERE public.is_admin_of(company_id))
  )
  WITH CHECK (
    invoice_id IN (SELECT id FROM public.invoices WHERE public.is_admin_of(company_id))
  );

-- invoice_items: 顧客は公開済み
CREATE POLICY "invoice_items: client read published"
  ON public.invoice_items FOR SELECT TO authenticated
  USING (
    invoice_id IN (
      SELECT id FROM public.invoices
      WHERE published_to_portal = true
      AND client_id IN (
        SELECT c.id FROM public.clients c
        JOIN public.client_portal_accounts cpa
          ON cpa.client_id = c.id AND cpa.profile_id = auth.uid() AND cpa.is_active = true
      )
    )
  );

-- invoice_payments: 管理者
CREATE POLICY "invoice_payments: admin CRUD"
  ON public.invoice_payments FOR ALL TO authenticated
  USING   (public.is_admin_of(company_id))
  WITH CHECK (public.is_admin_of(company_id));

-- invoice_number_counters: service_role のみ（関数経由でアクセス）
ALTER TABLE public.invoice_number_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoice_number_counters: admin read"
  ON public.invoice_number_counters FOR SELECT TO authenticated
  USING (public.is_admin_of(company_id));

-- ============================================================
-- 6. Storage: invoices パス用ポリシー（documents バケット内）
-- ============================================================

-- 管理者: invoices/ パスへのアップロード許可
CREATE POLICY "documents: admin upload invoices"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND name LIKE 'invoices/%'
  );

-- 管理者・顧客: invoices/ パスの読み取り許可
CREATE POLICY "documents: read invoices"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND name LIKE 'invoices/%'
  );

-- ============================================================
-- 7. 集計View
-- ============================================================

CREATE OR REPLACE VIEW public.v_invoice_summary AS
SELECT
  i.company_id,
  i.invoice_type,
  i.status,
  date_trunc('month', i.issue_date)::DATE AS month,
  COUNT(*)                                 AS count,
  SUM(i.total_amount)                      AS total_amount,
  SUM(i.paid_amount)                       AS paid_amount,
  SUM(i.total_amount - i.paid_amount)      AS unpaid_amount
FROM public.invoices i
GROUP BY i.company_id, i.invoice_type, i.status, date_trunc('month', i.issue_date);
