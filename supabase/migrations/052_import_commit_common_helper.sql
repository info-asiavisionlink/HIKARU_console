-- ============================================================
-- 052: Secure Import — Commit Common Helper Functions
--
-- 目的:
--   Migration 051 (client) の共通 pre-check 部分を helper 関数として抽出し、
--   053 (store) / 054 (employee) 以降の entity commit RPC で再利用する。
--
-- Helper 責務:
--   - session の行 lock + ownership + status + entity_type 検証
--   - idempotency (commit_records 既存 check)
--   - eligibility (pending rows / pending candidates / invalid approved)
--
-- Entity-specific 部分は各 entity RPC に残す (allowlist / INSERT / UPDATE / snapshot / count)。
--
-- Security:
--   SECURITY DEFINER + SET search_path = public, pg_temp
--   service_role のみ EXECUTE 権限
-- ============================================================

-- ---- 1. Pre-check helper (session lock + eligibility) ----

CREATE OR REPLACE FUNCTION public._import_commit_pre_check(
  p_session_id     UUID,
  p_company_id     UUID,
  p_entity_type    TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session          RECORD;
  v_pending_rows     INT;
  v_pending_cands    INT;
  v_invalid_approved INT;
BEGIN
  -- (1) Session lock + ownership
  SELECT * INTO v_session
  FROM import_sessions
  WHERE id = p_session_id AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- (2) Entity type match
  IF v_session.entity_type <> p_entity_type THEN
    RAISE EXCEPTION 'entity_type_mismatch: expected=%, actual=%', p_entity_type, v_session.entity_type
      USING ERRCODE = 'P0001';
  END IF;

  -- (3) Status gate
  IF v_session.status NOT IN ('review_required', 'ready_to_commit') THEN
    RAISE EXCEPTION 'invalid_session_status: %', v_session.status
      USING ERRCODE = 'P0001';
  END IF;

  -- (4) Idempotency: no existing commit record
  IF EXISTS (SELECT 1 FROM import_commit_records WHERE session_id = p_session_id) THEN
    RAISE EXCEPTION 'commit_already_exists' USING ERRCODE = 'P0001';
  END IF;

  -- (5a) No pending review rows
  SELECT COUNT(*) INTO v_pending_rows
  FROM import_staging_rows
  WHERE session_id = p_session_id
    AND company_id = p_company_id
    AND review_status = 'pending';
  IF v_pending_rows > 0 THEN
    RAISE EXCEPTION 'pending_rows_remain: %', v_pending_rows USING ERRCODE = 'P0001';
  END IF;

  -- (5b) No pending duplicate candidates
  SELECT COUNT(*) INTO v_pending_cands
  FROM import_duplicate_candidates
  WHERE session_id = p_session_id
    AND company_id = p_company_id
    AND review_status = 'pending';
  IF v_pending_cands > 0 THEN
    RAISE EXCEPTION 'pending_candidates_remain: %', v_pending_cands USING ERRCODE = 'P0001';
  END IF;

  -- (5c) No approved-invalid rows (defense in depth)
  SELECT COUNT(*) INTO v_invalid_approved
  FROM import_staging_rows
  WHERE session_id = p_session_id
    AND company_id = p_company_id
    AND review_status = 'approved'
    AND validation_status = 'invalid';
  IF v_invalid_approved > 0 THEN
    RAISE EXCEPTION 'invalid_row_approved: %', v_invalid_approved USING ERRCODE = 'P0001';
  END IF;

  -- (6) Transition to committing (defense in depth)
  UPDATE import_sessions
  SET status = 'committing', updated_at = NOW()
  WHERE id = p_session_id AND company_id = p_company_id;
END;
$$;

-- ---- 2. Update candidate resolver helper ----
-- 対象 staging_row の approved update candidate を厳密に 1 件返す。
-- 複数 approved → EXCEPTION (data integrity 保護)。
-- 0 件 → NULL (CREATE branch へ遷移)。

CREATE OR REPLACE FUNCTION public._import_commit_resolve_update_candidate(
  p_session_id  UUID,
  p_company_id  UUID,
  p_staging_id  UUID,
  p_expected_table TEXT
)
RETURNS TABLE (
  candidate_id       UUID,
  existing_record_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM import_duplicate_candidates
  WHERE staging_row_id = p_staging_id
    AND session_id     = p_session_id
    AND company_id     = p_company_id
    AND review_status  = 'approved'
    AND resolved_action = 'update';

  IF v_count > 1 THEN
    RAISE EXCEPTION 'multiple_update_candidates: row=%, count=%', p_staging_id, v_count
      USING ERRCODE = 'P0001';
  END IF;

  IF v_count = 1 THEN
    RETURN QUERY
    SELECT id, existing_record_id
    FROM import_duplicate_candidates
    WHERE staging_row_id = p_staging_id
      AND session_id     = p_session_id
      AND company_id     = p_company_id
      AND review_status  = 'approved'
      AND resolved_action = 'update'
      AND existing_record_table = p_expected_table;

    -- If the table check filtered it out → 0 rows returned + we validate downstream
  END IF;

  -- 0 件 → 空 RETURN (CREATE branch)
  RETURN;
END;
$$;

-- ---- 3. Finalize helper (commit_records + session status) ----

CREATE OR REPLACE FUNCTION public._import_commit_finalize(
  p_session_id     UUID,
  p_company_id     UUID,
  p_actor_id       UUID,
  p_inserted_count INT,
  p_updated_count  INT,
  p_skipped_count  INT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_commit_id UUID;
BEGIN
  -- commit_records に UNIQUE(session_id) → concurrent double commit を DB 側で拒否
  INSERT INTO import_commit_records (
    session_id, company_id, committed_by,
    total_inserted, total_updated, total_skipped,
    rollback_available
  ) VALUES (
    p_session_id, p_company_id, p_actor_id,
    p_inserted_count, p_updated_count, p_skipped_count,
    TRUE
  )
  RETURNING id INTO v_commit_id;

  -- Finalize session status
  UPDATE import_sessions
  SET status = 'completed', updated_at = NOW()
  WHERE id = p_session_id AND company_id = p_company_id;

  RETURN v_commit_id;
END;
$$;

-- ---- 4. Skipped count helper ----

CREATE OR REPLACE FUNCTION public._import_commit_count_skipped(
  p_session_id UUID,
  p_company_id UUID
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM import_staging_rows
  WHERE session_id = p_session_id
    AND company_id = p_company_id
    AND review_status = 'skipped';
  RETURN v_count;
END;
$$;

-- ---- 5. Grants ----

REVOKE ALL ON FUNCTION public._import_commit_pre_check(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._import_commit_pre_check(UUID, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public._import_commit_pre_check(UUID, UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._import_commit_pre_check(UUID, UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public._import_commit_resolve_update_candidate(UUID, UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._import_commit_resolve_update_candidate(UUID, UUID, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public._import_commit_resolve_update_candidate(UUID, UUID, UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._import_commit_resolve_update_candidate(UUID, UUID, UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public._import_commit_finalize(UUID, UUID, UUID, INT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._import_commit_finalize(UUID, UUID, UUID, INT, INT, INT) FROM anon;
REVOKE ALL ON FUNCTION public._import_commit_finalize(UUID, UUID, UUID, INT, INT, INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._import_commit_finalize(UUID, UUID, UUID, INT, INT, INT) TO service_role;

REVOKE ALL ON FUNCTION public._import_commit_count_skipped(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._import_commit_count_skipped(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public._import_commit_count_skipped(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._import_commit_count_skipped(UUID, UUID) TO service_role;

-- ============================================================
-- Rollback Note:
--   DROP FUNCTION IF EXISTS public._import_commit_pre_check(UUID, UUID, TEXT);
--   DROP FUNCTION IF EXISTS public._import_commit_resolve_update_candidate(UUID, UUID, UUID, TEXT);
--   DROP FUNCTION IF EXISTS public._import_commit_finalize(UUID, UUID, UUID, INT, INT, INT);
--   DROP FUNCTION IF EXISTS public._import_commit_count_skipped(UUID, UUID);
-- ============================================================
