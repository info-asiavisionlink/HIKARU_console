-- ============================================================
-- 055: Fix — Import commit pre_check ENUM<>TEXT operator error
--
-- Root cause (Production 実 log 実測):
--   Migration 052 の _import_commit_pre_check() 内、
--     IF v_session.entity_type <> p_entity_type THEN
--   で LHS = ENUM (public.import_entity_type)、RHS = TEXT の比較を行うが、
--   PostgreSQL には ENUM <> TEXT の直接 operator が存在しない。
--   ⇒ Store / Employee commit RPC 呼び出し時に:
--     ERROR 42883: operator does not exist: import_entity_type <> text
--   となり、必ず 500 で失敗していた。
--
--   Client (Migration 051) は helper 未使用で literal `'client'` と直接比較する
--   ため cast context で解決され、動作していた。
--
-- Fix (最小差分、最大後方互換):
--   Migration 052 の _import_commit_pre_check() を CREATE OR REPLACE で
--   body だけ更新し、比較箇所を LHS::TEXT に明示 cast する。
--
--   - 関数 signature (UUID, UUID, TEXT) は変更しない
--     → 別 function が生成されず、overload ambiguity なし
--     → Migration 053 / 054 の PERFORM 呼び出し site は無変更で互換
--     → 既存 GRANT / REVOKE も CREATE OR REPLACE で保持されるが、
--       防御的に再発行 (idempotent)
--
--   - SECURITY DEFINER / SET search_path = public, pg_temp 維持
--   - session lock / ownership / status / idempotency / eligibility 全ロジック維持
--   - error message / ERRCODE 維持 (RAISE EXCEPTION 'entity_type_mismatch: ...' はそのまま)
--   - transition to 'committing' の update 挙動維持
--
-- 影響範囲:
--   - Client commit flow (Migration 051): 影響なし (helper 未使用)
--   - Store commit flow (Migration 053): 42883 エラー解消、正常動作可能に
--   - Employee commit flow (Migration 054): 同上
--
-- Migration 049〜054 は変更しない。本ファイルは新規 migration。
--
-- 適用手順:
--   Supabase SQL Editor でユーザーが手動実行 (Claude 側から Production 適用しない)。
--   実行は idempotent (CREATE OR REPLACE FUNCTION)、複数回実行しても副作用なし。
--
-- Rollback:
--   Migration 052 の元の body で再度 CREATE OR REPLACE すれば元に戻る。
--   ただしその状態では Store / Employee commit が 42883 で失敗するため
--   Production では意味のある rollback path ではない。
--   実 rollback は業務データを Import する前に本 fix を検証する運用で吸収する。
-- ============================================================

-- ---- Replace _import_commit_pre_check (signature 変更なし) ----

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
  -- FIX 055: LHS は ENUM (public.import_entity_type)、RHS は TEXT 引数。
  -- ENUM <> TEXT operator は PostgreSQL に存在しないため、LHS を TEXT へ明示 cast。
  IF v_session.entity_type::TEXT <> p_entity_type THEN
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

-- ---- Grants (defensive re-issue; CREATE OR REPLACE preserves existing grants) ----

REVOKE ALL ON FUNCTION public._import_commit_pre_check(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._import_commit_pre_check(UUID, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public._import_commit_pre_check(UUID, UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._import_commit_pre_check(UUID, UUID, TEXT) TO service_role;

-- ============================================================
-- Post-check (Supabase SQL Editor で適用後に user が実行):
--
--   -- 1. Function 定義が更新されたことを確認 (::TEXT cast を含む)
--   SELECT pg_get_functiondef(p.oid) AS definition
--   FROM pg_proc p
--   JOIN pg_namespace n ON p.pronamespace = n.oid
--   WHERE n.nspname = 'public'
--     AND p.proname = '_import_commit_pre_check';
--   -- 期待: WHERE 句に 'entity_type::TEXT <> p_entity_type' が含まれる
--
--   -- 2. Function は 1 個だけ存在 (overload 発生なし)
--   SELECT COUNT(*) AS overload_count
--   FROM pg_proc p
--   JOIN pg_namespace n ON p.pronamespace = n.oid
--   WHERE n.nspname = 'public'
--     AND p.proname = '_import_commit_pre_check';
--   -- 期待: overload_count = 1
--
--   -- 3. service_role に EXECUTE grant があること
--   SELECT grantee, privilege_type
--   FROM information_schema.role_routine_grants
--   WHERE specific_schema = 'public'
--     AND routine_name = '_import_commit_pre_check';
--   -- 期待: service_role / EXECUTE の行が存在
--
--   -- 4. security type が DEFINER であること
--   SELECT p.prosecdef AS is_security_definer
--   FROM pg_proc p
--   JOIN pg_namespace n ON p.pronamespace = n.oid
--   WHERE n.nspname = 'public'
--     AND p.proname = '_import_commit_pre_check';
--   -- 期待: is_security_definer = t (true)
-- ============================================================
