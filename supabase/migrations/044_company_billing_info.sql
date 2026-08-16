-- ============================================================
-- 044: companies へ請求発行情報カラムを追加
-- 見積書・請求書PDFへの自社情報充実・インボイス制度対応のため
-- ============================================================
--
-- 追加カラム概要:
--
--   postal_code                  TEXT NULL
--     郵便番号（例: 150-0001）。フォーマットはアプリ側で管理。
--
--   invoice_registration_number  TEXT NULL
--     適格請求書発行事業者登録番号（例: T1234567890123）。
--     T + 13桁の検証はアプリ側で実施。DBには型制約なし。
--
--   bank_name                    TEXT NULL
--     振込先銀行名（例: ○○銀行）。
--
--   bank_branch_name             TEXT NULL
--     振込先支店名（例: ○○支店）。
--
--   bank_account_type            TEXT NULL
--     口座種別。'普通' または '当座' のみ許可。NULL は未設定を示す。
--     CHECK 制約: companies_bank_account_type_check
--
--   bank_account_number          TEXT NULL
--     口座番号。先頭0を保持するため INTEGER ではなく TEXT とする。
--
--   bank_account_holder          TEXT NULL
--     口座名義（漢字・法人名等）。
--
--   bank_account_holder_kana     TEXT NULL
--     口座名義カナ（振込依頼人名表示用）。
--
-- 設計方針:
--   - 全項目 NULL 許可・DEFAULT なし
--   - 既存 company レコードはすべて新カラムが NULL のまま開始
--   - backfill（UPDATE）は行わない
--   - 既存カラム（name/address/phone/email/logo_url 等）は一切変更しない
--   - companies 以外のテーブルは変更しない
-- ============================================================

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS postal_code                  TEXT,
  ADD COLUMN IF NOT EXISTS invoice_registration_number  TEXT,
  ADD COLUMN IF NOT EXISTS bank_name                    TEXT,
  ADD COLUMN IF NOT EXISTS bank_branch_name             TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_type            TEXT
    CONSTRAINT companies_bank_account_type_check
      CHECK (bank_account_type IS NULL OR bank_account_type IN ('普通', '当座')),
  ADD COLUMN IF NOT EXISTS bank_account_number          TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_holder          TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_holder_kana     TEXT;
