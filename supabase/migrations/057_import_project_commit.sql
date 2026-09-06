-- ============================================================
-- 057: Secure Import — Project Commit RPC (Phase B)
--
-- 目的:
--   Review 済み import_staging_rows を projects テーブルへ atomic に反映する。
--   Migration 052 helper (055 修正済) を利用し、Project 固有部分だけを実装。
--
-- 呼び出し元:
--   POST /api/import/sessions/[id]/commit (service_role client, entity_type=project)
--
-- 契約 (051 client / 053 store / 054 employee と同一 pattern):
--   - session lock + eligibility は _import_commit_pre_check() 委任 (055 修正済 helper)
--   - update candidate 解決は _import_commit_resolve_update_candidate() 委任
--   - Skipped count / commit_records 挿入 / status 完了は helper 委任
--   - CREATE / UPDATE の allowlist 列 + FK 検証は本 RPC で厳密実装
--
-- Project 固有 field allowlist (public.projects の全 import 対象列):
--   name (required)
--   code
--   project_type (enum: spot/recurring/hotel, default spot)
--   status (enum: active/paused/completed/cancelled/scheduled_confirmed/
--                 scheduled_unconfirmed/reclean_requested/billing_pending/
--                 reclean_scheduled_confirmed/reclean_scheduled_unconfirmed,
--           default active)
--   client_id (optional FK: clients.id, Map phase で client_code/client_name から resolve 済)
--   store_id  (optional FK: stores.id, Map phase で store_code/store_name から resolve 済)
--   start_date, end_date
--   contract_info, notes
--   address, phone, emergency_contact, business_hours, assigned_to, location_name
--   work_start_time, work_end_time, entry_route
--   key_borrowing (boolean, default false)
-- Not imported (server-side / auto-managed / historical import では触らない):
--   id, company_id (auth context), created_at/updated_at (default NOW),
--   keys_info (default []), acquired_by (workflow 経由でのみ設定)
--
-- FK company scope 契約:
--   - client_id が与えられた場合、同 company の active client であることを RPC 内で verify
--   - store_id が与えられた場合、同 company の store であることを RPC 内で verify
--   - cross-company FK は 400 で拒否 (client_not_found_in_company / store_not_found_in_company)
--
-- Historical Import 副作用ゼロ契約:
--   - projects の INSERT/UPDATE で notification / LINE / email 発火なし
--     (production trigger 監査済: updated_at handler のみ、他 side effect trigger 存在せず)
--   - acquired_by は自動設定しない (workflow 経由でのみ設定される契約)
--
-- Rollback:
--   UPDATE: snapshot_data = to_jsonb(v_existing_project) (全列 before-image)
--   CREATE: snapshot_data = {"operation": "INSERT"} marker
-- ============================================================

CREATE OR REPLACE FUNCTION public.commit_project_import_session(
  p_session_id UUID,
  p_company_id UUID,
  p_actor_id   UUID
)
RETURNS TABLE (
  inserted_count   INT,
  updated_count    INT,
  skipped_count    INT,
  commit_record_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row               RECORD;
  v_candidate         RECORD;
  v_existing_project  projects%ROWTYPE;
  v_new_project_id    UUID;
  v_inserted          INT := 0;
  v_updated           INT := 0;
  v_skipped           INT := 0;
  v_commit_id         UUID;
  v_mapped            JSONB;
  v_name              TEXT;
  v_code              TEXT;
  v_project_type      TEXT;
  v_status            TEXT;
  v_client_id         UUID;
  v_store_id          UUID;
  v_start_date        DATE;
  v_end_date          DATE;
  v_contract_info     TEXT;
  v_notes             TEXT;
  v_address           TEXT;
  v_phone             TEXT;
  v_emergency_contact TEXT;
  v_business_hours    TEXT;
  v_assigned_to       TEXT;
  v_location_name     TEXT;
  v_work_start_time   TIME;
  v_work_end_time     TIME;
  v_entry_route       TEXT;
  v_key_borrowing     BOOLEAN;
BEGIN
  -- (1) Session lock + eligibility (共通 helper、055 修正済)
  PERFORM public._import_commit_pre_check(p_session_id, p_company_id, 'project');

  -- (2) Process approved staging rows
  FOR v_row IN
    SELECT id, mapped_data
    FROM import_staging_rows
    WHERE session_id = p_session_id
      AND company_id = p_company_id
      AND review_status = 'approved'
    ORDER BY row_index
  LOOP
    v_mapped := COALESCE(v_row.mapped_data, '{}'::jsonb);

    -- Project allowlist extraction
    v_name              := NULLIF(v_mapped ->> 'name', '');
    v_code              := NULLIF(v_mapped ->> 'code', '');
    v_project_type      := NULLIF(v_mapped ->> 'project_type', '');
    v_status            := NULLIF(v_mapped ->> 'status', '');
    v_contract_info     := NULLIF(v_mapped ->> 'contract_info', '');
    v_notes             := NULLIF(v_mapped ->> 'notes', '');
    v_address           := NULLIF(v_mapped ->> 'address', '');
    v_phone             := NULLIF(v_mapped ->> 'phone', '');
    v_emergency_contact := NULLIF(v_mapped ->> 'emergency_contact', '');
    v_business_hours    := NULLIF(v_mapped ->> 'business_hours', '');
    v_assigned_to       := NULLIF(v_mapped ->> 'assigned_to', '');
    v_location_name     := NULLIF(v_mapped ->> 'location_name', '');
    v_entry_route       := NULLIF(v_mapped ->> 'entry_route', '');

    -- FK: Map route が resolve 済 (UUID or NULL)
    v_client_id := NULLIF(v_mapped ->> 'client_id', '')::UUID;
    v_store_id  := NULLIF(v_mapped ->> 'store_id',  '')::UUID;

    -- Dates / times (defensive cast in isolated block)
    BEGIN
      v_start_date := NULLIF(v_mapped ->> 'start_date', '')::DATE;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'invalid_start_date_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END;
    BEGIN
      v_end_date := NULLIF(v_mapped ->> 'end_date', '')::DATE;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'invalid_end_date_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END;
    BEGIN
      v_work_start_time := NULLIF(v_mapped ->> 'work_start_time', '')::TIME;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'invalid_work_start_time_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END;
    BEGIN
      v_work_end_time := NULLIF(v_mapped ->> 'work_end_time', '')::TIME;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'invalid_work_end_time_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END;

    -- key_borrowing (boolean)
    IF v_mapped ? 'key_borrowing' AND NULLIF(v_mapped ->> 'key_borrowing', '') IS NOT NULL THEN
      v_key_borrowing := (v_mapped ->> 'key_borrowing')::BOOLEAN;
    ELSE
      v_key_borrowing := NULL;  -- keep existing on UPDATE, use DEFAULT (false) on CREATE
    END IF;

    -- Enum validation
    IF v_project_type IS NOT NULL AND v_project_type NOT IN ('spot', 'recurring', 'hotel') THEN
      RAISE EXCEPTION 'invalid_project_type_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END IF;
    IF v_status IS NOT NULL AND v_status NOT IN (
      'active', 'paused', 'completed', 'cancelled',
      'scheduled_confirmed', 'scheduled_unconfirmed',
      'reclean_requested', 'billing_pending',
      'reclean_scheduled_confirmed', 'reclean_scheduled_unconfirmed'
    ) THEN
      RAISE EXCEPTION 'invalid_project_status_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END IF;

    -- Date consistency
    IF v_start_date IS NOT NULL AND v_end_date IS NOT NULL AND v_start_date > v_end_date THEN
      RAISE EXCEPTION 'invalid_date_range_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END IF;

    -- FK company-scope verify (client_id given → same company)
    IF v_client_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM clients
        WHERE id = v_client_id
          AND company_id = p_company_id
          AND is_active = TRUE
      ) THEN
        RAISE EXCEPTION 'client_not_found_in_company: %', v_client_id USING ERRCODE = 'P0001';
      END IF;
    END IF;

    -- FK company-scope verify (store_id given → same company)
    IF v_store_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM stores
        WHERE id = v_store_id
          AND company_id = p_company_id
      ) THEN
        RAISE EXCEPTION 'store_not_found_in_company: %', v_store_id USING ERRCODE = 'P0001';
      END IF;
    END IF;

    -- Determine CREATE vs UPDATE
    SELECT * INTO v_candidate
    FROM public._import_commit_resolve_update_candidate(
      p_session_id, p_company_id, v_row.id, 'projects'
    );

    IF v_candidate.candidate_id IS NOT NULL THEN
      -- UPDATE branch
      SELECT * INTO v_existing_project
      FROM projects
      WHERE id = v_candidate.existing_record_id
        AND company_id = p_company_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'candidate_project_not_found_in_company: %', v_candidate.existing_record_id
          USING ERRCODE = 'P0001';
      END IF;

      IF v_name IS NULL THEN
        RAISE EXCEPTION 'update_missing_name_for_row: %', v_row.id USING ERRCODE = 'P0001';
      END IF;

      -- Snapshot BEFORE update (全列 before-image)
      INSERT INTO import_rollback_snapshots (
        session_id, company_id, target_table, record_id, snapshot_data
      ) VALUES (
        p_session_id, p_company_id, 'projects', v_existing_project.id, to_jsonb(v_existing_project)
      );

      -- Partial merge (NULL mapped → keep existing)
      -- acquired_by / keys_info / company_id は絶対に更新しない
      UPDATE projects
      SET name              = COALESCE(v_name,              name),
          code              = COALESCE(v_code,              code),
          project_type      = COALESCE(v_project_type::project_type, project_type),
          status            = COALESCE(v_status::project_status,     status),
          client_id         = COALESCE(v_client_id,         client_id),
          store_id          = COALESCE(v_store_id,          store_id),
          start_date        = COALESCE(v_start_date,        start_date),
          end_date          = COALESCE(v_end_date,          end_date),
          contract_info     = COALESCE(v_contract_info,     contract_info),
          notes             = COALESCE(v_notes,             notes),
          address           = COALESCE(v_address,           address),
          phone             = COALESCE(v_phone,             phone),
          emergency_contact = COALESCE(v_emergency_contact, emergency_contact),
          business_hours    = COALESCE(v_business_hours,    business_hours),
          assigned_to       = COALESCE(v_assigned_to,       assigned_to),
          location_name     = COALESCE(v_location_name,     location_name),
          work_start_time   = COALESCE(v_work_start_time,   work_start_time),
          work_end_time     = COALESCE(v_work_end_time,     work_end_time),
          entry_route       = COALESCE(v_entry_route,       entry_route),
          key_borrowing     = COALESCE(v_key_borrowing,     key_borrowing),
          updated_at        = NOW()
      WHERE id = v_existing_project.id AND company_id = p_company_id;

      v_updated := v_updated + 1;
    ELSE
      -- CREATE branch: name 必須
      IF v_name IS NULL THEN
        RAISE EXCEPTION 'create_missing_name_for_row: %', v_row.id USING ERRCODE = 'P0001';
      END IF;

      -- INSERT (NULL は DB default に任せる)
      INSERT INTO projects (
        company_id, client_id, store_id,
        name, code,
        project_type, status,
        start_date, end_date,
        contract_info, notes,
        address, phone, emergency_contact, business_hours,
        assigned_to, location_name,
        work_start_time, work_end_time,
        entry_route,
        key_borrowing
      ) VALUES (
        p_company_id, v_client_id, v_store_id,
        v_name, v_code,
        COALESCE(v_project_type::project_type, 'spot'::project_type),
        COALESCE(v_status::project_status,     'active'::project_status),
        v_start_date, v_end_date,
        v_contract_info, v_notes,
        v_address, v_phone, v_emergency_contact, v_business_hours,
        v_assigned_to, v_location_name,
        v_work_start_time, v_work_end_time,
        v_entry_route,
        COALESCE(v_key_borrowing, FALSE)
      )
      RETURNING id INTO v_new_project_id;

      -- CREATE marker snapshot
      INSERT INTO import_rollback_snapshots (
        session_id, company_id, target_table, record_id, snapshot_data
      ) VALUES (
        p_session_id, p_company_id, 'projects', v_new_project_id,
        jsonb_build_object('operation', 'INSERT')
      );

      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  -- (3) Count skipped rows (helper)
  v_skipped := public._import_commit_count_skipped(p_session_id, p_company_id);

  -- (4) Finalize (commit record insert + session=completed)
  v_commit_id := public._import_commit_finalize(
    p_session_id, p_company_id, p_actor_id,
    v_inserted, v_updated, v_skipped
  );

  RETURN QUERY SELECT v_inserted, v_updated, v_skipped, v_commit_id;
END;
$$;

-- ---- Grants ----
REVOKE ALL ON FUNCTION public.commit_project_import_session(UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commit_project_import_session(UUID, UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.commit_project_import_session(UUID, UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.commit_project_import_session(UUID, UUID, UUID) TO service_role;

-- ============================================================
-- Rollback Note:
--   DROP FUNCTION IF EXISTS public.commit_project_import_session(UUID, UUID, UUID);
-- ============================================================
