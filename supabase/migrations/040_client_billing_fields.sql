-- ============================================================
-- 040: 会社情報・顧客請求情報の追加カラム
-- 見積書・請求書自動生成・自動送付に必要な項目
-- ============================================================

-- companies: 住所・電話番号・メールアドレスを追加（PDF発行元として使用）
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS phone   TEXT,
  ADD COLUMN IF NOT EXISTS email   TEXT;

-- clients: 請求書送付先・支払条件・締日を追加
-- invoice_email: 請求書・見積書の送付先（NULLの場合は clients.email をfallbackとして使用）
-- payment_terms: 支払条件（例: 翌月末払い、30日以内など）TEXT保存
-- closing_day: 締日 1〜31の整数（月末は31として扱う）
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS invoice_email TEXT,
  ADD COLUMN IF NOT EXISTS payment_terms TEXT,
  ADD COLUMN IF NOT EXISTS closing_day   INTEGER
    CONSTRAINT clients_closing_day_check
      CHECK (closing_day IS NULL OR (closing_day BETWEEN 1 AND 31));
