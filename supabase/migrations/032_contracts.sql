-- ============================================================
-- HIKARU Phase 7: 電子契約・契約書管理
-- ============================================================
-- 設計思想:
--   contracts: 契約の基本情報・ステータス・期間管理
--   contract_files: 契約書ファイルのバージョン管理
--   contract_events: 監査ログ（変更履歴）
--   contract_expiry_notifications: 期限通知の重複防止
-- Storage: contracts バケット（private）
-- ============================================================

-- ============================================================
-- 1. contracts（契約本体）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contracts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  -- 契約相手
  counterparty_type TEXT        NOT NULL CHECK (counterparty_type IN ('client', 'partner')),
  client_id         UUID        REFERENCES public.clients(id)  ON DELETE SET NULL,
  partner_id        UUID        REFERENCES public.partners(id) ON DELETE SET NULL,

  -- 関連案件（1契約:1案件。将来的に contract_projects 中間テーブルへ拡張可能）
  project_id        UUID        REFERENCES public.projects(id) ON DELETE SET NULL,

  -- 契約基本情報
  title             TEXT        NOT NULL,
  contract_number   TEXT,                    -- 契約番号（任意）
  contract_type     TEXT        NOT NULL DEFAULT 'service'
                    CHECK (contract_type IN ('service','subcontract','nda','other')),

  -- ステータス
  -- draft→sent→reviewing→signed→active→expired/terminated
  status            TEXT        NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','sent','reviewing','signed','active','expired','terminated')),

  -- 契約期間
  start_date        DATE,
  end_date          DATE,
  renewal_date      DATE,                    -- 更新日
  auto_renewal      BOOLEAN     NOT NULL DEFAULT false,

  -- 顧客ポータル公開
  published_to_portal BOOLEAN   NOT NULL DEFAULT false,
  published_at      TIMESTAMPTZ,
  published_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- 電子署名（将来: CloudSign/DocuSign等との連携）
  signed_at         TIMESTAMPTZ,
  signed_by         UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  sign_provider     TEXT        DEFAULT 'manual'
                    CHECK (sign_provider IN ('manual','cloudsign','docusign','other')),
  sign_request_id   TEXT,                    -- 外部サービスのリクエストID

  -- 備考・内部メモ
  notes             TEXT,
  internal_memo     TEXT,

  -- 監査
  created_by        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX contracts_company_id_idx      ON public.contracts(company_id);
CREATE INDEX contracts_client_id_idx       ON public.contracts(client_id);
CREATE INDEX contracts_partner_id_idx      ON public.contracts(partner_id);
CREATE INDEX contracts_project_id_idx      ON public.contracts(project_id);
CREATE INDEX contracts_status_idx          ON public.contracts(status);
CREATE INDEX contracts_end_date_idx        ON public.contracts(end_date);
CREATE INDEX contracts_counterparty_idx    ON public.contracts(counterparty_type, company_id);

CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 2. contract_files（契約書ファイル：バージョン管理）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contract_files (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id   UUID        NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  company_id    UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  version       INTEGER     NOT NULL DEFAULT 1,
  file_name     TEXT        NOT NULL,
  storage_path  TEXT        NOT NULL,        -- contracts/{company_id}/{contract_id}/v{version}/{file_name}
  mime_type     TEXT,
  file_size     INTEGER,                     -- bytes
  is_current    BOOLEAN     NOT NULL DEFAULT true,  -- 現在有効なバージョン
  uploaded_by   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX contract_files_contract_id_idx ON public.contract_files(contract_id);
CREATE INDEX contract_files_current_idx     ON public.contract_files(contract_id)
  WHERE is_current = true;

-- ============================================================
-- 3. contract_events（監査ログ）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contract_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     UUID        NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  company_id      UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  actor_id        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type      TEXT        NOT NULL,
  -- 例: created / status_changed / file_uploaded / file_replaced /
  --     published / signed / renewed / terminated / notes_updated
  old_value       JSONB,
  new_value       JSONB,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX contract_events_contract_id_idx ON public.contract_events(contract_id);
CREATE INDEX contract_events_created_at_idx  ON public.contract_events(created_at DESC);

-- ============================================================
-- 4. contract_expiry_notifications（通知重複防止）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contract_expiry_notifications (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     UUID        NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  company_id      UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  notification_type TEXT      NOT NULL CHECK (notification_type IN ('60d','30d','7d','0d')),
  notified_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 同一契約の同一通知種別は1回のみ（契約更新されたら再送可能にするため contract_id+type+year で管理）
  UNIQUE (contract_id, notification_type, EXTRACT(YEAR FROM notified_at)::INTEGER)
);

CREATE INDEX cen_contract_id_idx ON public.contract_expiry_notifications(contract_id);

-- ============================================================
-- 5. Storage: contracts バケット（private）
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', false)
ON CONFLICT (id) DO NOTHING;

-- 管理者: contracts バケットへのアップロード・削除
CREATE POLICY "contracts_storage: admin upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'contracts'
    AND public.is_admin_of(
      (storage.foldername(name))[1]::UUID
    )
  );

CREATE POLICY "contracts_storage: admin read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'contracts'
    AND public.is_admin_of(
      (storage.foldername(name))[1]::UUID
    )
  );

CREATE POLICY "contracts_storage: admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING   (bucket_id = 'contracts')
  WITH CHECK (bucket_id = 'contracts');

CREATE POLICY "contracts_storage: admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'contracts'
    AND public.is_admin_of(
      (storage.foldername(name))[1]::UUID
    )
  );

-- ============================================================
-- 6. RLS
-- ============================================================
ALTER TABLE public.contracts                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_files               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_expiry_notifications ENABLE ROW LEVEL SECURITY;

-- contracts: 管理者 CRUD
CREATE POLICY "contracts: admin CRUD"
  ON public.contracts FOR ALL TO authenticated
  USING   (public.is_admin_of(company_id))
  WITH CHECK (public.is_admin_of(company_id));

-- contracts: 顧客は公開済み・自社関連のみ SELECT
CREATE POLICY "contracts: client read published"
  ON public.contracts FOR SELECT TO authenticated
  USING (
    published_to_portal = true
    AND client_id IN (
      SELECT c.id FROM public.clients c
      JOIN public.client_portal_accounts cpa
        ON cpa.client_id = c.id AND cpa.profile_id = auth.uid() AND cpa.is_active = true
    )
  );

-- contract_files: 管理者 CRUD
CREATE POLICY "contract_files: admin CRUD"
  ON public.contract_files FOR ALL TO authenticated
  USING (
    contract_id IN (SELECT id FROM public.contracts WHERE public.is_admin_of(company_id))
  )
  WITH CHECK (
    contract_id IN (SELECT id FROM public.contracts WHERE public.is_admin_of(company_id))
  );

-- contract_events: 管理者 READ
CREATE POLICY "contract_events: admin read"
  ON public.contract_events FOR SELECT TO authenticated
  USING (public.is_admin_of(company_id));

-- contract_events: service_role INSERT のみ（API経由）
CREATE POLICY "contract_events: admin insert"
  ON public.contract_events FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_of(company_id));

-- contract_expiry_notifications: 管理者
CREATE POLICY "contract_expiry_notifications: admin"
  ON public.contract_expiry_notifications FOR ALL TO authenticated
  USING   (public.is_admin_of(company_id))
  WITH CHECK (public.is_admin_of(company_id));
