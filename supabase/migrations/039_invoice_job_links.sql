-- ============================================================
-- HIKARU Phase 2A: 請求書-作業紐付けテーブル（二重請求防止）
-- 039_invoice_job_links.sql
--
-- 目的:
--   「同じ作業（job）を複数の有効な請求書に重複して含めない」
--   ための台帳を追加する。
--
-- 設計思想:
--   invoice_job_links = どのjobをどのinvoiceで請求したかを記録
--   UNIQUE(job_id) により DBレベルで二重請求を防止する。
--
-- キャンセル時の設計（Phase 2C で実装予定）:
--   invoice.status='cancelled' 時に invoice_job_links を削除すると
--   job が再請求可能になる。今回はcancel APIは変更しない。
--
-- 安全方針:
--   - DROP / DELETE / UPDATE / TRUNCATE は一切なし
--   - 既存テーブルへの ALTER はなし
--   - 既存データのbackfillはなし
--   - 新規テーブル / index / RLS / policy のみ
--   - 既存 jobs / invoices / invoice_items は変更なし
-- ============================================================

-- ============================================================
-- 1. invoice_job_links テーブル
-- ============================================================

CREATE TABLE IF NOT EXISTS public.invoice_job_links (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 紐付け先の請求書（invoiceのみ、quoteは対象外）
  -- ON DELETE CASCADE: invoice削除時にリンクも削除（再請求可能になる）
  invoice_id  UUID        NOT NULL
                          REFERENCES public.invoices(id)  ON DELETE CASCADE,

  -- 紐付け元の作業セッション
  -- ON DELETE RESTRICT: 請求済みのjobは削除不可
  job_id      UUID        NOT NULL
                          REFERENCES public.jobs(id)      ON DELETE RESTRICT,

  -- 会社所属確認（RLSおよびAPI側ownership確認用）
  -- ON DELETE CASCADE: 会社削除時は全データ削除
  company_id  UUID        NOT NULL
                          REFERENCES public.companies(id) ON DELETE CASCADE,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. 二重請求防止 UNIQUE INDEX
--    1つのjobは最大1件のinvoice_job_linksにのみ存在できる。
--    同じjobを複数のinvoiceへ紐付けようとした場合に
--    DBレベルで UNIQUE制約違反エラーを発生させる。
--    このINDEXはjob_idの検索indexも兼ねる。
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS invoice_job_links_job_id_unique
  ON public.invoice_job_links(job_id);

-- ============================================================
-- 3. 検索用index
--    invoice_id / company_id の検索に使用する。
--    job_id は上記UNIQUE INDEXが兼ねるため重複作成しない。
-- ============================================================

CREATE INDEX IF NOT EXISTS invoice_job_links_invoice_id_idx
  ON public.invoice_job_links(invoice_id);

CREATE INDEX IF NOT EXISTS invoice_job_links_company_id_idx
  ON public.invoice_job_links(company_id);

-- ============================================================
-- 4. Row Level Security
-- ============================================================

ALTER TABLE public.invoice_job_links ENABLE ROW LEVEL SECURITY;

-- 管理者は自社データのみ CRUD 可能
-- public.is_admin_of() は 002_console_tables.sql で定義済み
CREATE POLICY "invoice_job_links: admin CRUD"
  ON public.invoice_job_links FOR ALL TO authenticated
  USING   (public.is_admin_of(company_id))
  WITH CHECK (public.is_admin_of(company_id));
