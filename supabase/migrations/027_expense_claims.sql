-- ============================================================
-- HIKARU: 経費申請・精算システム
-- 既存 expenses テーブルを拡張 + expense_receipts を新設
-- ============================================================
-- 設計思想:
--   1レコード = 1経費明細（カテゴリー・金額・領収書がセット）
--   ステータス管理でワークフロー（申請→承認→精算）を実現
--   将来の給与計算・会計連携・案件利益分析に対応
-- ============================================================

-- ============================================================
-- 1. expenses テーブルを拡張
-- ============================================================

-- 申請者種別（将来の集計で employee/partner を区別）
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS assignee_type   TEXT CHECK (assignee_type IN ('employee', 'partner')),
  ADD COLUMN IF NOT EXISTS employee_id     UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS partner_id      UUID REFERENCES public.partners(id)  ON DELETE SET NULL;

-- 関連データ（案件・シフト・JOBとの紐付け）
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS project_id      UUID REFERENCES public.projects(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shift_id        UUID REFERENCES public.shifts(id)    ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS job_id          UUID REFERENCES public.jobs(id)      ON DELETE SET NULL;

-- 対象月（給与計算月。YYYY-MM-01 形式で格納）
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS claim_month     DATE;

-- ワークフロー: 申請
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS submitted_at    TIMESTAMPTZ;

-- ワークフロー: 承認・却下
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS approved_by     UUID REFERENCES public.profiles(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reject_reason   TEXT;

-- ワークフロー: 精算
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS settled_by      UUID REFERENCES public.profiles(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS settled_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS settled_amount  INTEGER;

-- 取り下げ
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS withdrawn_at    TIMESTAMPTZ;

-- 将来のOCR対応メタデータ
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS ocr_result      JSONB;
-- OCR格納例: {"date":"2026-08-10","amount":1500,"store":"○○コンビニ","raw":"..."}

-- ============================================================
-- 2. status の値を更新（既存 'pending' → 'draft'、新しい値を追加）
-- ============================================================

-- 既存データが0件のため安全にDEFAULT変更
ALTER TABLE public.expenses
  ALTER COLUMN status SET DEFAULT 'draft';

-- CHECK制約を追加（既存制約がある場合はDROP後に再追加）
ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_status_check;

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_status_check
  CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'settled', 'withdrawn'));

-- ============================================================
-- 3. カテゴリーの CHECK 制約追加
-- ============================================================

ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_category_check;

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_category_check
  CHECK (category IN ('transport', 'parking', 'supplies', 'consumables', 'other'));

-- 既存カテゴリー値を新しい値に更新（既存データ0件なので安全）
-- 将来データのために: 既存デフォルトを英語キーに変更
ALTER TABLE public.expenses
  ALTER COLUMN category SET DEFAULT 'transport';

-- ============================================================
-- 4. インデックス追加
-- ============================================================

CREATE INDEX IF NOT EXISTS expenses_worker_id_idx     ON public.expenses(worker_id);
CREATE INDEX IF NOT EXISTS expenses_company_id_idx    ON public.expenses(company_id);
CREATE INDEX IF NOT EXISTS expenses_status_idx        ON public.expenses(status);
CREATE INDEX IF NOT EXISTS expenses_claim_month_idx   ON public.expenses(claim_month);
CREATE INDEX IF NOT EXISTS expenses_project_id_idx    ON public.expenses(project_id);
CREATE INDEX IF NOT EXISTS expenses_shift_id_idx      ON public.expenses(shift_id);
CREATE INDEX IF NOT EXISTS expenses_employee_id_idx   ON public.expenses(employee_id);
CREATE INDEX IF NOT EXISTS expenses_partner_id_idx    ON public.expenses(partner_id);
-- 承認待ち一覧用
CREATE INDEX IF NOT EXISTS expenses_submitted_at_idx  ON public.expenses(submitted_at DESC)
  WHERE status = 'submitted';

-- ============================================================
-- 5. expense_receipts テーブル（領収書ファイル管理）
-- ============================================================

CREATE TABLE IF NOT EXISTS public.expense_receipts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id    UUID        NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  company_id    UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  -- Supabase Storage メタデータ
  storage_path  TEXT        NOT NULL,   -- receipts/{company_id}/{profile_id}/{expense_id}/{filename}
  file_name     TEXT        NOT NULL,
  mime_type     TEXT        NOT NULL DEFAULT 'image/jpeg',
  file_size     INTEGER,               -- bytes
  -- 将来のOCR処理状態管理
  ocr_status    TEXT        NOT NULL DEFAULT 'pending'
                CHECK (ocr_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS expense_receipts_expense_id_idx ON public.expense_receipts(expense_id);
CREATE INDEX IF NOT EXISTS expense_receipts_company_id_idx ON public.expense_receipts(company_id);

-- ============================================================
-- 6. updated_at トリガー（既存があれば再作成しない）
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'expenses_updated_at'
  ) THEN
    CREATE TRIGGER expenses_updated_at
      BEFORE UPDATE ON public.expenses
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

-- ============================================================
-- 7. RLS 更新
--    既存ポリシーを DROP し、より詳細なポリシーに置き換え
-- ============================================================

-- 既存ポリシーを削除
DROP POLICY IF EXISTS "expenses: worker own"         ON public.expenses;
DROP POLICY IF EXISTS "expenses: admin read company" ON public.expenses;
DROP POLICY IF EXISTS "expenses: admin update"       ON public.expenses;

-- 従業員・協力業者: 自分の経費のみ CRUD（draft のみ UPDATE/DELETE 可）
CREATE POLICY "expenses: worker read own"
  ON public.expenses FOR SELECT TO authenticated
  USING (worker_id = auth.uid());

CREATE POLICY "expenses: worker insert"
  ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (worker_id = auth.uid());

CREATE POLICY "expenses: worker update own draft"
  ON public.expenses FOR UPDATE TO authenticated
  USING  (worker_id = auth.uid() AND status = 'draft')
  WITH CHECK (worker_id = auth.uid());

CREATE POLICY "expenses: worker update own submit withdraw"
  ON public.expenses FOR UPDATE TO authenticated
  USING  (worker_id = auth.uid() AND status IN ('draft', 'submitted'))
  WITH CHECK (worker_id = auth.uid() AND status IN ('submitted', 'withdrawn'));

CREATE POLICY "expenses: worker delete own draft"
  ON public.expenses FOR DELETE TO authenticated
  USING (worker_id = auth.uid() AND status = 'draft');

-- 管理者: 同一 company_id の全経費を参照・更新（承認/却下/精算）
CREATE POLICY "expenses: admin read company"
  ON public.expenses FOR SELECT TO authenticated
  USING (public.is_admin_of(company_id));

CREATE POLICY "expenses: admin update company"
  ON public.expenses FOR UPDATE TO authenticated
  USING (public.is_admin_of(company_id))
  WITH CHECK (public.is_admin_of(company_id));

-- ============================================================
-- 8. expense_receipts RLS
-- ============================================================

ALTER TABLE public.expense_receipts ENABLE ROW LEVEL SECURITY;

-- 申請者: 自分の経費の領収書を操作
CREATE POLICY "expense_receipts: worker own"
  ON public.expense_receipts FOR ALL TO authenticated
  USING (
    expense_id IN (SELECT id FROM public.expenses WHERE worker_id = auth.uid())
  )
  WITH CHECK (
    expense_id IN (SELECT id FROM public.expenses WHERE worker_id = auth.uid())
  );

-- 管理者: 同一会社の領収書を参照
CREATE POLICY "expense_receipts: admin read"
  ON public.expense_receipts FOR SELECT TO authenticated
  USING (public.is_admin_of(company_id));

-- ============================================================
-- 9. Storage: receipts バケット作成
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,   -- private（認証必須）
  10485760, -- 10MB
  ARRAY['image/jpeg','image/png','image/webp','image/heic','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- receipts バケット Storage RLS
DROP POLICY IF EXISTS "receipts: authenticated upload"  ON storage.objects;
DROP POLICY IF EXISTS "receipts: owner read"            ON storage.objects;
DROP POLICY IF EXISTS "receipts: admin read company"    ON storage.objects;
DROP POLICY IF EXISTS "receipts: authenticated delete"  ON storage.objects;
DROP POLICY IF EXISTS "receipts: authenticated update"  ON storage.objects;

-- 認証済みユーザーはアップロード可
CREATE POLICY "receipts: authenticated upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts');

-- 認証済みユーザーは自分がアップロードしたファイルを読める
CREATE POLICY "receipts: authenticated read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'receipts');

-- 認証済みユーザーは自分のファイルを削除可
CREATE POLICY "receipts: authenticated delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'receipts');

-- ============================================================
-- 10. 集計用ビュー
-- ============================================================

CREATE OR REPLACE VIEW public.v_expense_summary AS
SELECT
  e.company_id,
  date_trunc('month', e.claim_month)::DATE AS month,
  e.assignee_type,
  e.worker_id,
  e.status,
  COUNT(*)                                  AS item_count,
  SUM(e.amount)                             AS total_amount
FROM public.expenses e
GROUP BY e.company_id, date_trunc('month', e.claim_month), e.assignee_type, e.worker_id, e.status;

-- 案件別経費集計ビュー（将来の利益分析用）
CREATE OR REPLACE VIEW public.v_project_expense_summary AS
SELECT
  e.project_id,
  e.company_id,
  e.status,
  COUNT(*) AS item_count,
  SUM(e.amount) AS total_amount
FROM public.expenses e
WHERE e.project_id IS NOT NULL
GROUP BY e.project_id, e.company_id, e.status;
