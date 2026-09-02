-- ============================================================
-- 053: Platform Provisioning Idempotency Foundation
--
-- Phase P6 — Provisioning API 用の最小 idempotency store
--
-- 目的:
--   POST /api/platform/companies が
--   同じ Idempotency-Key で二重実行されても
--   Company / Auth user が二重生成されないようにする。
--
-- 方針:
--   ADDITIVE ONLY — 既存テーブル / 関数 / トリガー / RLS は一切変更しない
--   最小 Schema のみ追加 (大規模 provisioning state machine は避ける)
--
-- 変更禁止:
--   companies / profiles / employees / clients / stores / projects /
--   jobs / expenses / invoices / import_* /
--   platform_operators (051) / platform_audit_logs (052) /
--   handle_new_user() トリガー等
--
-- 設計:
--   - operator_user_id + idempotency_key で UNIQUE (二重実行防止)
--   - status: processing | completed | failed
--   - request_hash: 同一 key で異なる payload の検出用 (409)
--   - response: 完了時の response payload を保存 (idempotent replay 用)
--   - RLS ENABLE + Policy 無 → Service Role のみアクセス可
-- ============================================================

-- ============================================================
-- 1. platform_provisioning_idempotency テーブル
-- ============================================================

CREATE TABLE IF NOT EXISTS public.platform_provisioning_idempotency (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 誰が発行したリクエストか (Platform Operator の auth.users.id)
  -- ON DELETE RESTRICT: idempotency record の actor を消せない
  operator_user_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  -- HTTP header Idempotency-Key (UUID 形式)
  idempotency_key   UUID        NOT NULL,

  -- request payload の hash (companyName + adminName + adminEmail の
  -- normalize → SHA256)。同一 key で別 payload を検出するため。
  request_hash      TEXT        NOT NULL,

  -- 状態:
  --   processing : 現在実行中
  --   completed  : 成功完了 (response payload 保存済み)
  --   failed     : 明示的に失敗。自動再実行しない。新しい key を要求。
  status            TEXT        NOT NULL
                                CHECK (status IN ('processing', 'completed', 'failed')),

  -- 結果 (完了時のみ set される可能性あり)
  company_id        UUID,       -- NOT REFERENCES: company が cleanup で消える可能性を許容
  admin_user_id     UUID,       -- NOT REFERENCES: auth user が cleanup で消える可能性を許容

  -- idempotent replay 用の response body
  response          JSONB,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 同一 Operator が同じ Idempotency-Key を使えるのは 1 回だけ
  CONSTRAINT platform_provisioning_idempotency_unique
    UNIQUE (operator_user_id, idempotency_key)
);

COMMENT ON TABLE public.platform_provisioning_idempotency
  IS 'Provisioning API の Idempotency-Key 記録。二重実行防止のみが目的。';

COMMENT ON COLUMN public.platform_provisioning_idempotency.operator_user_id
  IS 'Platform Operator の auth.users.id (namespace分離)';

COMMENT ON COLUMN public.platform_provisioning_idempotency.request_hash
  IS 'normalized payload の SHA256 hex。同一 key + 異なる payload → 409 検出用';

COMMENT ON COLUMN public.platform_provisioning_idempotency.response
  IS 'completed 時の response JSON。同 key で再度呼ばれたら replay で返却';

-- ============================================================
-- 2. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS platform_provisioning_idempotency_operator_idx
  ON public.platform_provisioning_idempotency(operator_user_id);

CREATE INDEX IF NOT EXISTS platform_provisioning_idempotency_created_at_idx
  ON public.platform_provisioning_idempotency(created_at);

-- ============================================================
-- 3. updated_at trigger (既存 handle_updated_at() 再利用)
-- ============================================================

CREATE TRIGGER platform_provisioning_idempotency_updated_at
  BEFORE UPDATE ON public.platform_provisioning_idempotency
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 4. RLS
--
-- 設計:
--   - ENABLE RLS
--   - Policy 一切作成しない
--   → SELECT/INSERT/UPDATE/DELETE 全て authenticated から拒否
--   → Service Role (BYPASSRLS) のみ操作可能
--
-- 理由:
--   - Customer Admin / Worker / Client からこのテーブルを一切見せない
--   - Platform Operator本人からも Browser 経由の直接書き換えを防止
--   - 全操作は /api/platform/* API 経由 (Service Role) のみ
-- ============================================================

ALTER TABLE public.platform_provisioning_idempotency ENABLE ROW LEVEL SECURITY;

-- NOTE: 意図的に CREATE POLICY を書かない。
--       RLS有効 + Policy無 = 全 authenticated から完全deny。
--       Service Role は BYPASSRLS のため引き続きアクセス可能。

-- ============================================================
-- Rollback (参考):
--   DROP TABLE IF EXISTS public.platform_provisioning_idempotency;
-- ============================================================
