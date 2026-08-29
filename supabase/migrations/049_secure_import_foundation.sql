-- ============================================================
-- 049: Secure Import Foundation
-- Phase 1A + 1B — Import Storage + DB Schema + RLS
--
-- 方針:
--   ADDITIVE ONLY — 既存テーブル/カラム/ポリシーは一切変更しない
--   Import専用テーブル・Bucket・RLSのみ追加
--
-- 追加するもの:
--   1. Enum types (import_*)
--   2. hikaru-imports Private Storage Bucket + RLS
--   3. 7 Import Tables + RLS
--
-- 変更禁止:
--   clients / stores / projects / invoices / expenses
--   profiles / companies — 既存テーブルに手を加えない
--
-- MVP制約:
--   Malware scan: scan_status = 'not_required' で統一
--   許可ファイル: CSV / XLSX のみ (.xlsm 等は禁止)
--
-- Cross-Tenant Integrity:
--   import_sessions(id, company_id) に UNIQUE 制約 → 複合FK可能
--   各下位テーブルが (session_id, company_id) の複合FK を保持
--   → A社SessionにB社のFile等を紐付けることをDB層で防止
-- ============================================================

-- ============================================================
-- 1. Enum Types
-- ============================================================

CREATE TYPE public.import_session_status AS ENUM (
  'created',         -- セッション作成直後
  'uploading',       -- ファイルアップロード中
  'uploaded',        -- ファイルアップロード完了
  'scanning',        -- Malwareスキャン中 (MVP: scan_status=not_required で管理、このstateはskip)
  'extracting',      -- ファイルパース・ステージングテーブル格納中
  'mapping',         -- フィールドマッピング中 (MVP Phase: 手動または将来AI)
  'validating',      -- バリデーション実行中
  'review_required', -- ユーザーレビュー待ち
  'ready_to_commit', -- コミット待機中 (全レビュー完了)
  'committing',      -- コミット実行中
  'completed',       -- 本番DBへコミット完了
  'failed',          -- エラー終了
  'cancelled',       -- ユーザーによるキャンセル
  'rolled_back'      -- ロールバック済み
);

CREATE TYPE public.import_source_type AS ENUM (
  'csv',
  'xlsx'
);

CREATE TYPE public.import_entity_type AS ENUM (
  'client',
  'store',
  'employee',
  'project',
  'invoice',
  'expense'
);

CREATE TYPE public.import_validation_status AS ENUM (
  'pending',
  'valid',
  'invalid',
  'warning'
);

CREATE TYPE public.import_review_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'skipped'
);

CREATE TYPE public.import_commit_action AS ENUM (
  'insert',
  'update',
  'skip',
  'merge'
);

-- ============================================================
-- 2. hikaru-imports Private Storage Bucket
-- ============================================================

-- Private bucket — 匿名・一般ユーザーからの直接アクセス不可
-- path: {company_id}/{session_id}/{uuid}.{csv|xlsx}
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hikaru-imports',
  'hikaru-imports',
  false,
  10485760,  -- 10MB
  ARRAY[
    'text/csv',
    'application/csv',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2a. Storage RLS — hikaru-imports
--
-- 設計:
--   - Admin のみ許可 (is_admin_of)
--   - path[1] = user の company_id を強制
--   - 他社のパスへのアクセスを防止
-- ============================================================

-- SELECT: Admin が自社フォルダのみ参照可能
CREATE POLICY "hikaru-imports: admin select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'hikaru-imports'
    AND public.is_admin_of(
      (storage.foldername(name))[1]::uuid
    )
  );

-- INSERT: Admin が自社フォルダのみアップロード可能
CREATE POLICY "hikaru-imports: admin insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'hikaru-imports'
    AND public.is_admin_of(
      (storage.foldername(name))[1]::uuid
    )
  );

-- UPDATE: Admin が自社ファイルのみ更新可能
CREATE POLICY "hikaru-imports: admin update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'hikaru-imports'
    AND public.is_admin_of(
      (storage.foldername(name))[1]::uuid
    )
  )
  WITH CHECK (
    bucket_id = 'hikaru-imports'
    AND public.is_admin_of(
      (storage.foldername(name))[1]::uuid
    )
  );

-- DELETE: Admin が自社ファイルのみ削除可能
CREATE POLICY "hikaru-imports: admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'hikaru-imports'
    AND public.is_admin_of(
      (storage.foldername(name))[1]::uuid
    )
  );

-- ============================================================
-- 3. import_sessions
--
-- インポートセッションのトップレベルレコード。
-- 1インポート操作 = 1セッション。
-- ============================================================

CREATE TABLE public.import_sessions (
  id            UUID                          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID                          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by    UUID                          NOT NULL REFERENCES public.profiles(id)  ON DELETE RESTRICT,
  status        public.import_session_status  NOT NULL DEFAULT 'created',
  entity_type   public.import_entity_type     NOT NULL,
  source_type   public.import_source_type     NOT NULL,
  label         TEXT,
  total_rows    INT,
  valid_rows    INT,
  invalid_rows  INT,
  duplicate_rows INT,
  error_message TEXT,
  -- Malware scan: MVP では not_required で統一。将来スキャナー導入時に拡張可能
  scan_status   TEXT                          NOT NULL DEFAULT 'not_required',
  created_at    TIMESTAMPTZ                   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ                   NOT NULL DEFAULT NOW(),

  -- Cross-Tenant Integrity: 複合UNIQUEで下位テーブルが複合FKを張れるようにする
  UNIQUE (id, company_id)
);

CREATE INDEX import_sessions_company_id_idx ON public.import_sessions(company_id);
CREATE INDEX import_sessions_status_idx     ON public.import_sessions(status);
CREATE INDEX import_sessions_created_by_idx ON public.import_sessions(created_by);

ALTER TABLE public.import_sessions ENABLE ROW LEVEL SECURITY;

-- Admin が自社セッションのみ操作可能
CREATE POLICY "import_sessions: admin CRUD"
  ON public.import_sessions FOR ALL
  TO authenticated
  USING   (public.is_admin_of(company_id))
  WITH CHECK (public.is_admin_of(company_id));

-- ============================================================
-- 4. import_files
--
-- セッションにアップロードされたファイルのメタデータ。
-- 実ファイルは hikaru-imports bucket 内に保存。
-- ============================================================

CREATE TABLE public.import_files (
  id                  UUID                            PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID                            NOT NULL,
  company_id          UUID                            NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  original_filename   TEXT                            NOT NULL,  -- サニタイズ済みの元ファイル名
  storage_path        TEXT                            NOT NULL,  -- {company_id}/{session_id}/{uuid}.ext
  mime_type           TEXT                            NOT NULL,
  file_size_bytes     BIGINT                          NOT NULL,
  row_count           INT,
  validation_status   public.import_validation_status NOT NULL DEFAULT 'pending',
  validation_errors   JSONB,
  created_at          TIMESTAMPTZ                     NOT NULL DEFAULT NOW(),

  -- Cross-Tenant: session が同一 company であることをDB層で保証
  CONSTRAINT fk_import_files_session
    FOREIGN KEY (session_id, company_id)
    REFERENCES public.import_sessions(id, company_id)
    ON DELETE CASCADE
);

CREATE INDEX import_files_session_id_idx   ON public.import_files(session_id);
CREATE INDEX import_files_company_id_idx   ON public.import_files(company_id);
CREATE INDEX import_files_storage_path_idx ON public.import_files(storage_path);

ALTER TABLE public.import_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_files: admin CRUD"
  ON public.import_files FOR ALL
  TO authenticated
  USING   (public.is_admin_of(company_id))
  WITH CHECK (public.is_admin_of(company_id));

-- ============================================================
-- 5. import_staging_rows
--
-- アップロードファイルをパースした各行データ。
--
-- データ3層分離:
--   raw_data:        ファイル由来の元データ (不変、key=元ヘッダー名)
--   normalized_data: deterministic normalization後 (key=正規化ヘッダー名)
--   mapped_data:     HIKARU canonical schemaへのMapping結果 (NULL until mapped)
-- ============================================================

CREATE TABLE public.import_staging_rows (
  id                UUID                            PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID                            NOT NULL,
  file_id           UUID                            NOT NULL REFERENCES public.import_files(id) ON DELETE CASCADE,
  company_id        UUID                            NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  row_index         INT                             NOT NULL,  -- ファイル内の行番号 (1始まり)
  raw_data          JSONB                           NOT NULL,  -- 元データ (不変、key=元ヘッダー名)
  normalized_data   JSONB                           NOT NULL DEFAULT '{}'::jsonb,  -- 正規化後 (key=正規化ヘッダー名)
  mapped_data       JSONB,                                     -- HIKARUスキーマへのMapping結果
  validation_status public.import_validation_status NOT NULL DEFAULT 'pending',
  validation_errors JSONB,
  review_status     public.import_review_status     NOT NULL DEFAULT 'pending',
  created_at        TIMESTAMPTZ                     NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ                     NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_import_staging_session
    FOREIGN KEY (session_id, company_id)
    REFERENCES public.import_sessions(id, company_id)
    ON DELETE CASCADE,

  UNIQUE (session_id, row_index)
);

CREATE INDEX import_staging_rows_session_id_idx       ON public.import_staging_rows(session_id);
CREATE INDEX import_staging_rows_company_id_idx       ON public.import_staging_rows(company_id);
CREATE INDEX import_staging_rows_validation_status_idx ON public.import_staging_rows(validation_status);
CREATE INDEX import_staging_rows_review_status_idx    ON public.import_staging_rows(review_status);

ALTER TABLE public.import_staging_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_staging_rows: admin CRUD"
  ON public.import_staging_rows FOR ALL
  TO authenticated
  USING   (public.is_admin_of(company_id))
  WITH CHECK (public.is_admin_of(company_id));

-- ============================================================
-- 6. import_duplicate_candidates
--
-- ステージング行と既存レコードの重複検出結果。
-- resolved_action: ユーザーが選択したアクション (skip/update/merge 等)
-- ============================================================

CREATE TABLE public.import_duplicate_candidates (
  id                     UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id             UUID                        NOT NULL,
  company_id             UUID                        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  staging_row_id         UUID                        NOT NULL REFERENCES public.import_staging_rows(id) ON DELETE CASCADE,
  existing_record_id     UUID                        NOT NULL,  -- 既存テーブルのレコードID
  existing_record_table  TEXT                        NOT NULL,  -- 対象テーブル名
  similarity_score       NUMERIC(5,4),                          -- 0.0000–1.0000
  review_status          public.import_review_status NOT NULL DEFAULT 'pending',
  resolved_action        public.import_commit_action,
  resolved_at            TIMESTAMPTZ,
  resolved_by            UUID REFERENCES public.profiles(id),
  created_at             TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_import_dup_session
    FOREIGN KEY (session_id, company_id)
    REFERENCES public.import_sessions(id, company_id)
    ON DELETE CASCADE
);

CREATE INDEX import_dup_candidates_session_id_idx ON public.import_duplicate_candidates(session_id);
CREATE INDEX import_dup_candidates_company_id_idx ON public.import_duplicate_candidates(company_id);
CREATE INDEX import_dup_candidates_review_idx     ON public.import_duplicate_candidates(review_status);

ALTER TABLE public.import_duplicate_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_duplicate_candidates: admin CRUD"
  ON public.import_duplicate_candidates FOR ALL
  TO authenticated
  USING   (public.is_admin_of(company_id))
  WITH CHECK (public.is_admin_of(company_id));

-- ============================================================
-- 7. import_audit_logs
--
-- 不変の監査ログ。
-- INSERT のみ許可 — UPDATE/DELETE は RLS で禁止。
-- actor_id は必須 (誰が操作したか常に記録)
-- ============================================================

CREATE TABLE public.import_audit_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID        NOT NULL,
  company_id UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  actor_id   UUID        NOT NULL REFERENCES public.profiles(id)  ON DELETE RESTRICT,
  action     TEXT        NOT NULL,  -- 例: 'session.created', 'file.uploaded', 'commit.applied'
  detail     JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_import_audit_session
    FOREIGN KEY (session_id, company_id)
    REFERENCES public.import_sessions(id, company_id)
    ON DELETE CASCADE
  -- updated_at は意図的に省略 — このテーブルは不変
);

CREATE INDEX import_audit_logs_session_id_idx ON public.import_audit_logs(session_id);
CREATE INDEX import_audit_logs_company_id_idx ON public.import_audit_logs(company_id);
CREATE INDEX import_audit_logs_actor_id_idx   ON public.import_audit_logs(actor_id);
CREATE INDEX import_audit_logs_created_at_idx ON public.import_audit_logs(created_at);

ALTER TABLE public.import_audit_logs ENABLE ROW LEVEL SECURITY;

-- Admin は閲覧のみ (SELECT)
CREATE POLICY "import_audit_logs: admin select"
  ON public.import_audit_logs FOR SELECT
  TO authenticated
  USING (public.is_admin_of(company_id));

-- Admin は書き込みのみ (INSERT) — アプリ層から監査ログを追記
CREATE POLICY "import_audit_logs: admin insert"
  ON public.import_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_of(company_id));

-- UPDATE / DELETE ポリシーは作成しない → RLS により完全禁止

-- ============================================================
-- 8. import_rollback_snapshots
--
-- コミット前の既存レコードスナップショット。
-- コミット後にロールバックが必要になった場合に使用。
-- ============================================================

CREATE TABLE public.import_rollback_snapshots (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID        NOT NULL,
  company_id    UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  target_table  TEXT        NOT NULL,   -- スナップショット対象テーブル名
  record_id     UUID        NOT NULL,   -- 対象レコードのID
  snapshot_data JSONB       NOT NULL,   -- コミット前のデータ全体
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_import_rollback_session
    FOREIGN KEY (session_id, company_id)
    REFERENCES public.import_sessions(id, company_id)
    ON DELETE CASCADE
);

CREATE INDEX import_rollback_snapshots_session_id_idx ON public.import_rollback_snapshots(session_id);
CREATE INDEX import_rollback_snapshots_company_id_idx ON public.import_rollback_snapshots(company_id);

ALTER TABLE public.import_rollback_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_rollback_snapshots: admin CRUD"
  ON public.import_rollback_snapshots FOR ALL
  TO authenticated
  USING   (public.is_admin_of(company_id))
  WITH CHECK (public.is_admin_of(company_id));

-- ============================================================
-- 9. import_commit_records
--
-- 本番DBへのコミット完了記録。
-- 1セッションにつき最大1レコード (セッションが committed 状態の証跡)
-- ============================================================

CREATE TABLE public.import_commit_records (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID        NOT NULL,
  company_id        UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  committed_by      UUID        NOT NULL REFERENCES public.profiles(id)  ON DELETE RESTRICT,
  committed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_inserted    INT         NOT NULL DEFAULT 0,
  total_updated     INT         NOT NULL DEFAULT 0,
  total_skipped     INT         NOT NULL DEFAULT 0,
  rollback_available BOOLEAN    NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_import_commit_session
    FOREIGN KEY (session_id, company_id)
    REFERENCES public.import_sessions(id, company_id)
    ON DELETE CASCADE,

  UNIQUE (session_id)  -- 1セッション1コミット
);

CREATE INDEX import_commit_records_session_id_idx  ON public.import_commit_records(session_id);
CREATE INDEX import_commit_records_company_id_idx  ON public.import_commit_records(company_id);
CREATE INDEX import_commit_records_committed_by_idx ON public.import_commit_records(committed_by);

ALTER TABLE public.import_commit_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_commit_records: admin CRUD"
  ON public.import_commit_records FOR ALL
  TO authenticated
  USING   (public.is_admin_of(company_id))
  WITH CHECK (public.is_admin_of(company_id));

-- ============================================================
-- Rollback Note:
--   DROP TABLE public.import_commit_records;
--   DROP TABLE public.import_rollback_snapshots;
--   DROP TABLE public.import_audit_logs;
--   DROP TABLE public.import_duplicate_candidates;
--   DROP TABLE public.import_staging_rows;
--   DROP TABLE public.import_files;
--   DROP TABLE public.import_sessions;
--   DROP TYPE  public.import_commit_action;
--   DROP TYPE  public.import_review_status;
--   DROP TYPE  public.import_validation_status;
--   DROP TYPE  public.import_entity_type;
--   DROP TYPE  public.import_source_type;
--   DROP TYPE  public.import_session_status;
--   DELETE FROM storage.buckets WHERE id = 'hikaru-imports';
-- ============================================================
