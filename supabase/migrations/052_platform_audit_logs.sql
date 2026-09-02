-- ============================================================
-- 052: Platform Provisioning Audit Foundation
--
-- Phase P2 — Audit基盤のみ
--
-- 目的:
--   HIKARU Platform Operator による Provisioning 操作
--   (Company作成 / First Admin招待 / Profile紐付け 等) を
--   誰が/いつ/何を/成否 で追跡可能にする。
--
-- 方針:
--   ADDITIVE ONLY — 既存テーブル/関数/トリガー/RLSは一切変更しない
--   Provisioning専用の独立table
--
-- 追加するもの:
--   1. platform_audit_logs テーブル
--   2. RLS (authenticatedからのアクセス完全禁止 — Service Roleのみ)
--
-- 変更禁止:
--   companies / profiles / employees / clients / stores / projects /
--   jobs / expenses / invoices / import_* / platform_operators (051) /
--   handle_new_user() 等
--
-- Secure Import audit (import_audit_logs) を流用しない理由:
--   - import_audit_logs は Tenant-scoped (company_id NOT NULL FK)
--   - session_id NOT NULL + FK to import_sessions
--   - Provisioning は Company作成の "前" イベントを含む → FK制約に合わない
--   - Actor は Platform Operator であり Customer Admin ではない
--
-- 設計原則:
--   - Append-only (INSERT のみ、UPDATE/DELETE policy無)
--   - Company未生成状態のイベントも記録可能 (target_id nullable)
--   - metadata JSONB は helper 側で機密key除去してから INSERT
-- ============================================================

-- ============================================================
-- 1. platform_audit_logs テーブル
-- ============================================================

CREATE TABLE IF NOT EXISTS public.platform_audit_logs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 誰が (Platform Operator)
  -- ON DELETE RESTRICT: auditの actor を消せない (監査整合性)
  actor_user_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  -- 何をしたか
  -- 例: 'company.provisioning.started', 'company.provisioning.completed',
  --     'company.provisioning.failed', 'admin.invitation.sent',
  --     'admin.invitation.failed', 'admin.profile_linked'
  action         TEXT        NOT NULL,

  -- 対象種別 (例: 'company', 'auth_user', 'profile')
  target_type    TEXT,

  -- 対象ID (例: 作成された company.id, auth.users.id)
  -- NULL 許容: pre-creation event (started等) では ID 未確定
  target_id      UUID,

  -- 結果
  -- 'started' : 処理開始 (compensation調査用)
  -- 'success' : 正常完了
  -- 'failure' : 失敗
  status         TEXT        NOT NULL
                             CHECK (status IN ('started', 'success', 'failure')),

  -- Idempotency-Key (HTTP header由来)。重複request検出/追跡用
  request_id     UUID,

  -- 補助情報 (機密除去済み)
  -- helper側で password/token/authorization/cookie/secret/service_role/api_key を除去
  metadata       JSONB,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()

  -- updated_at は意図的に省略 — このテーブルは append-only 不変
);

COMMENT ON TABLE public.platform_audit_logs
  IS 'HIKARU Platform Operator による Provisioning 操作の監査ログ。Append-only, Service Role書き込み専用。';

COMMENT ON COLUMN public.platform_audit_logs.actor_user_id
  IS '操作を実行した Platform Operator の auth.users.id';

COMMENT ON COLUMN public.platform_audit_logs.action
  IS '実行アクション。例: company.provisioning.completed';

COMMENT ON COLUMN public.platform_audit_logs.target_id
  IS '対象エンティティのID。start event等では未確定のためNULL可';

COMMENT ON COLUMN public.platform_audit_logs.status
  IS '結果: started | success | failure';

COMMENT ON COLUMN public.platform_audit_logs.request_id
  IS 'Idempotency-Key HTTP header由来。重複request検出用';

COMMENT ON COLUMN public.platform_audit_logs.metadata
  IS '補助情報 JSONB。password/token/cookie/secret 等の機密key は保存禁止';

-- ============================================================
-- 2. Indexes
--
-- - actor_user_id: 特定Operatorの操作履歴を追う
-- - action: 特定イベント種別で絞り込む
-- - created_at: 時系列表示
-- - request_id: Idempotency確認 (WHERE付き partial index)
-- ============================================================

CREATE INDEX IF NOT EXISTS platform_audit_logs_actor_idx
  ON public.platform_audit_logs(actor_user_id);

CREATE INDEX IF NOT EXISTS platform_audit_logs_action_idx
  ON public.platform_audit_logs(action);

CREATE INDEX IF NOT EXISTS platform_audit_logs_created_at_idx
  ON public.platform_audit_logs(created_at);

CREATE INDEX IF NOT EXISTS platform_audit_logs_request_id_idx
  ON public.platform_audit_logs(request_id)
  WHERE request_id IS NOT NULL;

-- ============================================================
-- 3. RLS
--
-- 設計:
--   - ENABLE RLS
--   - authenticated / anon 向け Policy を一切作成しない
--   → SELECT/INSERT/UPDATE/DELETE 全て authenticated から拒否
--   → Service Role (BYPASSRLS) のみ INSERT/SELECT 可能
--
-- 理由:
--   - Customer Admin/Worker/Client からは このテーブルの存在すら見せない
--   - Platform Operator本人からも Browser経由の直接書き換え/削除を防止
--   - INSERT は Server-side helper (writePlatformAudit) を経由するのみ
--   - UPDATE/DELETE は Application code から実行しない (append-only invariant)
--
-- 将来 Platform Operator UI から audit閲覧が必要になったら、
-- 別 migration で SELECT policy (is_platform_operator() USING) を追加検討。
-- 今回P2では閲覧UIも作らないため policyは不要。
-- ============================================================

ALTER TABLE public.platform_audit_logs ENABLE ROW LEVEL SECURITY;

-- NOTE: 意図的に CREATE POLICY を書かない。
--       RLS有効 + Policy無 = 全 authenticated から完全deny。
--       Service Role は BYPASSRLS のため引き続きアクセス可能。

-- ============================================================
-- Rollback (参考):
--   DROP TABLE IF EXISTS public.platform_audit_logs;
-- ============================================================
