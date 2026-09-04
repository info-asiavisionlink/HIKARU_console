-- ============================================================
-- 053: Secure Import — Store Commit RPC
--
-- 目的:
--   Review 済み import_staging_rows を stores テーブルへ atomic に反映する。
--   Migration 052 helper を利用し、Store 固有部分だけを実装。
--
-- 呼び出し元:
--   POST /api/import/sessions/[id]/commit (service_role client, entity_type=store)
--
-- 契約 (051 client と同一 pattern):
--   - session lock + eligibility は _import_commit_pre_check() 委任
--   - update candidate 解決は _import_commit_resolve_update_candidate() 委任
--   - Skipped count / commit_records 挿入 / status 完了は helper 委任
--   - CREATE / UPDATE の allowlist 列と client_id FK 検証は本 RPC で厳密実装
--
-- Store 固有 field allowlist:
--   name (required)
--   code (optional, unique per company 想定だが DB constraint なし)
--   address, phone, business_hours, manager_name, emergency_contact,
--   contract_info, notes
--   client_id (required、Map 段階で client_code/client_name から resolve 済)
-- Not imported: is_active (default true), created_at/updated_at (default NOW)
--
-- Rollback:
--   UPDATE: snapshot_data = to_jsonb(v_existing_store) (全列 before-image)
--   CREATE: snapshot_data = {"operation": "INSERT"} marker
-- ============================================================

CREATE OR REPLACE FUNCTION public.commit_store_import_session(
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
  v_row              RECORD;
  v_candidate        RECORD;
  v_existing_store   stores%ROWTYPE;
  v_new_store_id     UUID;
  v_inserted         INT := 0;
  v_updated          INT := 0;
  v_skipped          INT := 0;
  v_commit_id        UUID;
  v_mapped           JSONB;
  v_name             TEXT;
  v_code             TEXT;
  v_address          TEXT;
  v_phone            TEXT;
  v_business_hours   TEXT;
  v_manager_name     TEXT;
  v_emergency_contact TEXT;
  v_contract_info    TEXT;
  v_notes            TEXT;
  v_client_id        UUID;
BEGIN
  -- (1) Session lock + eligibility (共通 helper)
  PERFORM public._import_commit_pre_check(p_session_id, p_company_id, 'store');

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

    -- Store allowlist extraction
    v_name              := NULLIF(v_mapped ->> 'name', '');
    v_code              := NULLIF(v_mapped ->> 'code', '');
    v_address           := NULLIF(v_mapped ->> 'address', '');
    v_phone             := NULLIF(v_mapped ->> 'phone', '');
    v_business_hours    := NULLIF(v_mapped ->> 'business_hours', '');
    v_manager_name      := NULLIF(v_mapped ->> 'manager_name', '');
    v_emergency_contact := NULLIF(v_mapped ->> 'emergency_contact', '');
    v_contract_info     := NULLIF(v_mapped ->> 'contract_info', '');
    v_notes             := NULLIF(v_mapped ->> 'notes', '');

    -- client_id は Map route が FK resolve 済 (UUID or NULL)
    v_client_id := NULLIF(v_mapped ->> 'client_id', '')::UUID;

    -- Determine CREATE vs UPDATE
    SELECT * INTO v_candidate
    FROM public._import_commit_resolve_update_candidate(
      p_session_id, p_company_id, v_row.id, 'stores'
    );

    IF v_candidate.candidate_id IS NOT NULL THEN
      -- UPDATE branch
      SELECT * INTO v_existing_store
      FROM stores
      WHERE id = v_candidate.existing_record_id
        AND company_id = p_company_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'candidate_store_not_found_in_company: %', v_candidate.existing_record_id
          USING ERRCODE = 'P0001';
      END IF;

      IF v_name IS NULL THEN
        RAISE EXCEPTION 'update_missing_name_for_row: %', v_row.id USING ERRCODE = 'P0001';
      END IF;

      -- Snapshot BEFORE update
      INSERT INTO import_rollback_snapshots (
        session_id, company_id, target_table, record_id, snapshot_data
      ) VALUES (
        p_session_id, p_company_id, 'stores', v_existing_store.id, to_jsonb(v_existing_store)
      );

      -- Partial merge (NULL mapped → keep existing)
      -- client_id は 変更しない (元 client 関係を維持)。
      UPDATE stores
      SET name               = COALESCE(v_name,              name),
          code               = COALESCE(v_code,              code),
          address            = COALESCE(v_address,           address),
          phone              = COALESCE(v_phone,             phone),
          business_hours     = COALESCE(v_business_hours,    business_hours),
          manager_name       = COALESCE(v_manager_name,      manager_name),
          emergency_contact  = COALESCE(v_emergency_contact, emergency_contact),
          contract_info      = COALESCE(v_contract_info,     contract_info),
          notes              = COALESCE(v_notes,             notes),
          updated_at         = NOW()
      WHERE id = v_existing_store.id AND company_id = p_company_id;

      v_updated := v_updated + 1;
    ELSE
      -- CREATE branch: name + client_id は必須
      IF v_name IS NULL THEN
        RAISE EXCEPTION 'create_missing_name_for_row: %', v_row.id USING ERRCODE = 'P0001';
      END IF;

      IF v_client_id IS NULL THEN
        RAISE EXCEPTION 'create_missing_client_id_for_row: %', v_row.id USING ERRCODE = 'P0001';
      END IF;

      -- client_id 検証: 同 company の active client であることを確認
      IF NOT EXISTS (
        SELECT 1 FROM clients
        WHERE id = v_client_id
          AND company_id = p_company_id
          AND is_active = TRUE
      ) THEN
        RAISE EXCEPTION 'client_not_found_in_company: %', v_client_id USING ERRCODE = 'P0001';
      END IF;

      INSERT INTO stores (
        company_id, client_id, name, code, address, phone,
        business_hours, manager_name, emergency_contact, contract_info, notes
      ) VALUES (
        p_company_id, v_client_id, v_name, v_code, v_address, v_phone,
        v_business_hours, v_manager_name, v_emergency_contact, v_contract_info, v_notes
      )
      RETURNING id INTO v_new_store_id;

      -- CREATE marker snapshot
      INSERT INTO import_rollback_snapshots (
        session_id, company_id, target_table, record_id, snapshot_data
      ) VALUES (
        p_session_id, p_company_id, 'stores', v_new_store_id,
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
REVOKE ALL ON FUNCTION public.commit_store_import_session(UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commit_store_import_session(UUID, UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.commit_store_import_session(UUID, UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.commit_store_import_session(UUID, UUID, UUID) TO service_role;

-- ============================================================
-- Rollback Note:
--   DROP FUNCTION IF EXISTS public.commit_store_import_session(UUID, UUID, UUID);
-- ============================================================
