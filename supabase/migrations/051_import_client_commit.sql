-- ============================================================
-- 051: Secure Import — Client Commit RPC
--
-- 目的:
--   Review 済み import_staging_rows を clients テーブルへ atomic に反映する
--   Postgres 関数を追加。PHASE 2 STEP A の commit endpoint 用。
--
-- 呼び出し元:
--   POST /api/import/sessions/[id]/commit (service_role client)
--
-- 契約:
--   - entity_type = 'client' のセッションのみ受け付ける
--   - p_company_id / p_actor_id は Server side auth context から渡されたものを信頼する
--     (Browser 供給禁止 = route.ts の責任)
--   - session lock (FOR UPDATE) 取得 → 途中で他 API が状態を書き換えないよう保護
--   - eligibility 逸脱時は EXCEPTION → transaction 全体 rollback
--   - CREATE : mapped_data から allowlist 列のみ抽出、company_id を server 側で強制付与
--   - UPDATE : 対象 client が同一 company であることを検証、直前値を snapshot 保存、
--             partial merge (mapped_data が NULL の列は既存値を保持)
--   - SKIP  : 何もしない
--   - import_commit_records UNIQUE(session_id) で double-commit を DB 側で拒否
--
-- Rollback (STEP B 用) の下地:
--   - UPDATE: snapshot_data = 既存 client の全列 (JSONB)
--   - CREATE: snapshot_data = { operation: 'INSERT' } マーカーのみ (record_id で対象特定)
--
-- Security:
--   SECURITY DEFINER で postgres 権限で実行 (service_role 経由呼び出し、RLS bypass)。
--   引数 p_company_id / p_actor_id を全 INSERT/UPDATE に強制付与することで
--   cross-tenant leak を防ぐ。EXECUTE 権限は service_role のみに付与。
-- ============================================================

-- ---- 1. Function: commit_client_import_session ----

CREATE OR REPLACE FUNCTION public.commit_client_import_session(
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
  v_session         RECORD;
  v_row             RECORD;
  v_candidate       RECORD;
  v_existing_client clients%ROWTYPE;
  v_new_client_id   UUID;
  v_inserted        INT := 0;
  v_updated         INT := 0;
  v_skipped         INT := 0;
  v_commit_id       UUID;
  v_pending_rows    INT;
  v_pending_cands   INT;
  v_invalid_approved INT;
  v_update_cand_cnt INT;
  v_mapped          JSONB;
  v_name            TEXT;
  v_code            TEXT;
  v_email           TEXT;
  v_phone           TEXT;
  v_address         TEXT;
  v_contact_name    TEXT;
  v_notes           TEXT;
BEGIN
  -- (1) Session lock + ownership + status check
  SELECT * INTO v_session
  FROM import_sessions
  WHERE id = p_session_id
    AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_not_found'
      USING ERRCODE = 'P0002';  -- no_data_found equivalent
  END IF;

  IF v_session.entity_type <> 'client' THEN
    RAISE EXCEPTION 'entity_type_not_supported: %', v_session.entity_type
      USING ERRCODE = 'P0001';
  END IF;

  IF v_session.status NOT IN ('review_required', 'ready_to_commit') THEN
    RAISE EXCEPTION 'invalid_session_status: %', v_session.status
      USING ERRCODE = 'P0001';
  END IF;

  -- (2) Idempotency guard (UNIQUE(session_id) にも保険を張るが、明示チェック)
  IF EXISTS (SELECT 1 FROM import_commit_records WHERE session_id = p_session_id) THEN
    RAISE EXCEPTION 'commit_already_exists'
      USING ERRCODE = 'P0001';
  END IF;

  -- (3) Eligibility: no pending review rows / no pending candidates / no invalid+approved
  SELECT COUNT(*) INTO v_pending_rows
  FROM import_staging_rows
  WHERE session_id = p_session_id
    AND company_id = p_company_id
    AND review_status = 'pending';

  IF v_pending_rows > 0 THEN
    RAISE EXCEPTION 'pending_rows_remain: %', v_pending_rows
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO v_pending_cands
  FROM import_duplicate_candidates
  WHERE session_id = p_session_id
    AND company_id = p_company_id
    AND review_status = 'pending';

  IF v_pending_cands > 0 THEN
    RAISE EXCEPTION 'pending_candidates_remain: %', v_pending_cands
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO v_invalid_approved
  FROM import_staging_rows
  WHERE session_id = p_session_id
    AND company_id = p_company_id
    AND review_status = 'approved'
    AND validation_status = 'invalid';

  IF v_invalid_approved > 0 THEN
    RAISE EXCEPTION 'invalid_row_approved: %', v_invalid_approved
      USING ERRCODE = 'P0001';
  END IF;

  -- (4) Transition to committing (defense in depth)
  UPDATE import_sessions
  SET status = 'committing',
      updated_at = NOW()
  WHERE id = p_session_id
    AND company_id = p_company_id;

  -- (5) Process approved staging rows (CREATE or UPDATE)
  FOR v_row IN
    SELECT id, mapped_data
    FROM import_staging_rows
    WHERE session_id = p_session_id
      AND company_id = p_company_id
      AND review_status = 'approved'
    ORDER BY row_index
  LOOP
    v_mapped := COALESCE(v_row.mapped_data, '{}'::jsonb);

    -- Allowlist extraction (clients table safe columns only)
    v_name         := NULLIF(v_mapped ->> 'name', '');
    v_code         := NULLIF(v_mapped ->> 'code', '');
    v_email        := NULLIF(v_mapped ->> 'email', '');
    v_phone        := NULLIF(v_mapped ->> 'phone', '');
    v_address      := NULLIF(v_mapped ->> 'address', '');
    v_contact_name := NULLIF(v_mapped ->> 'contact_name', '');
    v_notes        := NULLIF(v_mapped ->> 'notes', '');

    -- Determine CREATE vs UPDATE by *counting* approved update candidates.
    -- Ambiguous (>1) は勝手に 1 件選ばず reject する (data integrity 保護)。
    --   count = 0 → user は CREATE を選択 (現行と同じ挙動)
    --   count = 1 → UPDATE (safe, exactly one)
    --   count > 1 → RAISE multiple_update_candidates
    SELECT COUNT(*) INTO v_update_cand_cnt
    FROM import_duplicate_candidates
    WHERE staging_row_id = v_row.id
      AND session_id     = p_session_id
      AND company_id     = p_company_id
      AND review_status  = 'approved'
      AND resolved_action = 'update';

    IF v_update_cand_cnt > 1 THEN
      RAISE EXCEPTION 'multiple_update_candidates: row=%, count=%', v_row.id, v_update_cand_cnt
        USING ERRCODE = 'P0001';
    END IF;

    IF v_update_cand_cnt = 1 THEN
      -- Fetch the single approved update candidate (LIMIT 1 は不要、UNIQUE 保証済)
      SELECT id, existing_record_id, existing_record_table
        INTO v_candidate
      FROM import_duplicate_candidates
      WHERE staging_row_id = v_row.id
        AND session_id     = p_session_id
        AND company_id     = p_company_id
        AND review_status  = 'approved'
        AND resolved_action = 'update';

      -- UPDATE branch
      IF v_candidate.existing_record_table <> 'clients' THEN
        RAISE EXCEPTION 'candidate_wrong_table: %', v_candidate.existing_record_table
          USING ERRCODE = 'P0001';
      END IF;

      -- Load existing row (must belong to same company)
      SELECT * INTO v_existing_client
      FROM clients
      WHERE id = v_candidate.existing_record_id
        AND company_id = p_company_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'candidate_client_not_found_in_company: %', v_candidate.existing_record_id
          USING ERRCODE = 'P0001';
      END IF;

      IF v_name IS NULL THEN
        RAISE EXCEPTION 'update_missing_name_for_row: %', v_row.id
          USING ERRCODE = 'P0001';
      END IF;

      -- Snapshot BEFORE update (row_to_json → JSONB)
      INSERT INTO import_rollback_snapshots (
        session_id, company_id, target_table, record_id, snapshot_data
      ) VALUES (
        p_session_id,
        p_company_id,
        'clients',
        v_existing_client.id,
        to_jsonb(v_existing_client)
      );

      -- Partial merge: NULL mapped value → keep existing
      UPDATE clients
      SET name         = COALESCE(v_name,         name),
          code         = COALESCE(v_code,         code),
          email        = COALESCE(v_email,        email),
          phone        = COALESCE(v_phone,        phone),
          address      = COALESCE(v_address,      address),
          contact_name = COALESCE(v_contact_name, contact_name),
          notes        = COALESCE(v_notes,        notes),
          updated_at   = NOW()
      WHERE id = v_existing_client.id
        AND company_id = p_company_id;

      v_updated := v_updated + 1;
    ELSE
      -- CREATE branch: name is required
      IF v_name IS NULL THEN
        RAISE EXCEPTION 'create_missing_name_for_row: %', v_row.id
          USING ERRCODE = 'P0001';
      END IF;

      INSERT INTO clients (
        company_id, name, code, email, phone, address, contact_name, notes
      ) VALUES (
        p_company_id, v_name, v_code, v_email, v_phone, v_address, v_contact_name, v_notes
      )
      RETURNING id INTO v_new_client_id;

      -- CREATE marker snapshot (STEP B rollback で使用)
      INSERT INTO import_rollback_snapshots (
        session_id, company_id, target_table, record_id, snapshot_data
      ) VALUES (
        p_session_id,
        p_company_id,
        'clients',
        v_new_client_id,
        jsonb_build_object('operation', 'INSERT')
      );

      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  -- (6) Count skipped rows
  SELECT COUNT(*) INTO v_skipped
  FROM import_staging_rows
  WHERE session_id = p_session_id
    AND company_id = p_company_id
    AND review_status = 'skipped';

  -- (7) Insert commit record (UNIQUE(session_id) → double commit rejected here for concurrent case)
  INSERT INTO import_commit_records (
    session_id, company_id, committed_by,
    total_inserted, total_updated, total_skipped,
    rollback_available
  ) VALUES (
    p_session_id, p_company_id, p_actor_id,
    v_inserted, v_updated, v_skipped,
    TRUE
  )
  RETURNING id INTO v_commit_id;

  -- (8) Finalize session
  UPDATE import_sessions
  SET status = 'completed',
      updated_at = NOW()
  WHERE id = p_session_id
    AND company_id = p_company_id;

  RETURN QUERY SELECT v_inserted, v_updated, v_skipped, v_commit_id;
END;
$$;

-- ---- 2. Grants ----
-- Anon / authenticated からの直接呼び出しを禁止し、service_role のみに絞る。
REVOKE ALL ON FUNCTION public.commit_client_import_session(UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commit_client_import_session(UUID, UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.commit_client_import_session(UUID, UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.commit_client_import_session(UUID, UUID, UUID) TO service_role;

-- ============================================================
-- Rollback Note:
--   DROP FUNCTION IF EXISTS public.commit_client_import_session(UUID, UUID, UUID);
-- ============================================================
