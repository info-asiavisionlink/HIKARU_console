-- ============================================================
-- 042: 顧客支払条件の構造化カラム追加
-- 支払期限（due_date）の自動算出を安全に行うための土台
-- ============================================================
--
-- 追加カラム:
--   payment_month_offset: 支払月オフセット（基準月から何ヶ月後に支払うか）
--     0 = 当月  1 = 翌月（最も一般的）  2 = 翌々月  ...  最大6ヶ月後
--   payment_day: 支払日（1〜31, 31は月末）
--
-- 注意:
--   既存clients.payment_terms（自由テキスト）は表示用途のまま残す。削除禁止。
--   今回追加カラムはDEFAULT NULLのまま開始。
--   既存顧客のbackfillは禁止。
--   既存顧客はpayment_month_offset=NULL, payment_day=NULLのまま。
--   NULLの場合はdue_date = issue_date + 30日 fallbackを維持。
-- ============================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS payment_month_offset INTEGER
    CONSTRAINT clients_payment_month_offset_check
      CHECK (payment_month_offset IS NULL OR payment_month_offset BETWEEN 0 AND 6),

  ADD COLUMN IF NOT EXISTS payment_day INTEGER
    CONSTRAINT clients_payment_day_check
      CHECK (payment_day IS NULL OR payment_day BETWEEN 1 AND 31);
