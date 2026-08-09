-- ============================================================
-- HIKARU Phase 6: 備品・消耗品管理
-- ============================================================
-- 設計思想:
--   在庫数量は直接UPDATEせず inventory_transactions から集計
--   stock_quantity は非正規化キャッシュ（RPCで整合性保証）
--   行ロック使用で同時出庫競合を防止
-- ============================================================

-- ============================================================
-- 1. inventory_items（在庫マスタ）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name             TEXT          NOT NULL,
  category         TEXT          NOT NULL DEFAULT 'other'
                   CHECK (category IN ('detergent','consumable','tool','hygiene','equipment','other')),
  unit             TEXT          NOT NULL DEFAULT '個',     -- 個/本/L/袋/箱/kg/セット etc.
  unit_price       NUMERIC(12,2),                            -- 単価（参考値）
  stock_quantity   NUMERIC(10,2) NOT NULL DEFAULT 0,         -- 現在在庫（RPCで更新）
  min_stock        NUMERIC(10,2) NOT NULL DEFAULT 0,         -- 最低在庫数
  storage_location TEXT,                                     -- 保管場所
  supplier_name    TEXT,                                     -- 仕入先名
  supplier_contact TEXT,                                     -- 仕入先電話
  supplier_email   TEXT,                                     -- 仕入先メール
  barcode          TEXT,                                     -- JAN/バーコード
  notes            TEXT,
  is_active        BOOLEAN       NOT NULL DEFAULT true,
  -- 通知管理（重複防止）
  last_low_stock_notified_at   TIMESTAMPTZ,                  -- 最後のlow_stock通知日時
  last_out_of_stock_notified_at TIMESTAMPTZ,                 -- 最後のout_of_stock通知日時
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX inventory_company_id_idx  ON public.inventory_items(company_id);
CREATE INDEX inventory_category_idx    ON public.inventory_items(category);
CREATE INDEX inventory_is_active_idx   ON public.inventory_items(is_active);
CREATE INDEX inventory_low_stock_idx   ON public.inventory_items(company_id)
  WHERE stock_quantity <= min_stock AND is_active = true;

CREATE TRIGGER inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 2. inventory_transactions（入出庫・調整履歴）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id          UUID          NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  company_id       UUID          NOT NULL REFERENCES public.companies(id)       ON DELETE CASCADE,
  -- 取引種別
  transaction_type TEXT          NOT NULL
                   CHECK (transaction_type IN ('in', 'out', 'adjustment')),
  quantity         NUMERIC(10,2) NOT NULL,   -- 正値: 増加、負値: 減少
  -- 関連エンティティ
  project_id       UUID          REFERENCES public.projects(id) ON DELETE SET NULL,
  shift_id         UUID          REFERENCES public.shifts(id)   ON DELETE SET NULL,
  job_id           UUID          REFERENCES public.jobs(id)     ON DELETE SET NULL,
  -- 担当者
  performed_by     UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- 補足情報
  reason           TEXT,                     -- 出庫理由・調整理由
  supplier_name    TEXT,                     -- 入庫時の仕入先
  notes            TEXT,
  performed_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX inv_tx_item_id_idx      ON public.inventory_transactions(item_id);
CREATE INDEX inv_tx_company_id_idx   ON public.inventory_transactions(company_id);
CREATE INDEX inv_tx_project_id_idx   ON public.inventory_transactions(project_id);
CREATE INDEX inv_tx_performed_at_idx ON public.inventory_transactions(performed_at DESC);
CREATE INDEX inv_tx_type_idx         ON public.inventory_transactions(transaction_type);

-- ============================================================
-- 3. アトミック在庫操作 RPC（競合防止）
-- ============================================================

-- 在庫記録RPC: 履歴 + stock_quantity 更新をトランザクションで実行
-- quantity: 正値=増加（入庫/プラス調整）、負値=減少（出庫/マイナス調整）
CREATE OR REPLACE FUNCTION public.record_stock_transaction(
  p_item_id          UUID,
  p_company_id       UUID,
  p_transaction_type TEXT,
  p_quantity         NUMERIC,    -- signed: 正=入庫/プラス, 負=出庫/マイナス
  p_project_id       UUID        DEFAULT NULL,
  p_shift_id         UUID        DEFAULT NULL,
  p_job_id           UUID        DEFAULT NULL,
  p_performed_by     UUID        DEFAULT NULL,
  p_reason           TEXT        DEFAULT NULL,
  p_supplier_name    TEXT        DEFAULT NULL,
  p_notes            TEXT        DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item         public.inventory_items;
  v_new_qty      NUMERIC;
  v_tx_id        UUID;
BEGIN
  -- 行ロック取得（同時実行の競合を防止）
  SELECT * INTO v_item
  FROM public.inventory_items
  WHERE id = p_item_id AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '商品が見つかりません');
  END IF;

  IF NOT v_item.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', '無効な商品です');
  END IF;

  v_new_qty := v_item.stock_quantity + p_quantity;

  -- マイナス在庫防止（調整以外）
  IF p_transaction_type != 'adjustment' AND v_new_qty < 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '在庫が不足しています',
      'current_stock', v_item.stock_quantity,
      'requested', ABS(p_quantity)
    );
  END IF;

  -- 在庫数を更新
  UPDATE public.inventory_items
  SET
    stock_quantity = v_new_qty,
    updated_at     = NOW()
  WHERE id = p_item_id;

  -- 取引履歴を記録
  INSERT INTO public.inventory_transactions (
    item_id, company_id, transaction_type, quantity,
    project_id, shift_id, job_id, performed_by,
    reason, supplier_name, notes
  ) VALUES (
    p_item_id, p_company_id, p_transaction_type, p_quantity,
    p_project_id, p_shift_id, p_job_id, p_performed_by,
    p_reason, p_supplier_name, p_notes
  ) RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success',       true,
    'transaction_id', v_tx_id,
    'new_stock',     v_new_qty,
    'prev_stock',    v_item.stock_quantity
  );
END;
$$;

-- ============================================================
-- 4. RLS
-- ============================================================
ALTER TABLE public.inventory_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

-- 管理者: 同一company_idの在庫をCRUD
CREATE POLICY "inventory_items: admin CRUD"
  ON public.inventory_items FOR ALL TO authenticated
  USING   (public.is_admin_of(company_id))
  WITH CHECK (public.is_admin_of(company_id));

-- 従業員: 有効商品のREAD（在庫数・価格を含む）
CREATE POLICY "inventory_items: worker read active"
  ON public.inventory_items FOR SELECT TO authenticated
  USING (
    is_active = true
    AND company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- 取引履歴: 管理者CRUD
CREATE POLICY "inventory_transactions: admin CRUD"
  ON public.inventory_transactions FOR ALL TO authenticated
  USING   (public.is_admin_of(company_id))
  WITH CHECK (public.is_admin_of(company_id));

-- 取引履歴: 従業員は自分が記録した履歴のみINSERT（使用報告用）
CREATE POLICY "inventory_transactions: worker insert own"
  ON public.inventory_transactions FOR INSERT TO authenticated
  WITH CHECK (
    performed_by = auth.uid()
    AND company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
    -- 出庫のみ（在庫マスタ変更には使用しない）
    AND transaction_type = 'out'
  );

-- 顧客: アクセス禁止（ポリシーなし）
