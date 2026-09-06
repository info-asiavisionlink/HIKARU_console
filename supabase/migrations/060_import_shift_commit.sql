-- ============================================================
-- 060: Secure Import — Shift Commit RPC (Phase B, Historical)
--
-- 目的:
--   Review 済み import_staging_rows を shifts テーブルへ atomic に反映する。
--   Historical Import として、通常のシフト作成/変更通知 workflow を発火させない
--   直接 INSERT/UPDATE のみを行う。
--
-- 呼び出し元:
--   POST /api/import/sessions/[id]/commit (service_role client, entity_type=shift)
--
-- 前提: Migration 056 で import_entity_type ENUM に 'shift' が追加済み。
--
-- Historical Import 契約 (最重要):
--   1) 通常のシフト作成 API は呼ばない
--   2) LINE/email/Realtime 通知を発火しない
--   3) DB Trigger 監査: shifts に対する trigger は shifts_updated_at のみ (updated_at handler)
--
-- Shift 固有 field allowlist:
--   project_id (required, FK projects, Map phase で resolve 済)
--   assignee_type (required, CHECK: employee/partner)
--   employee_id / partner_id (排他的、assignee_type に応じて一方 NOT NULL、他方 NULL)
--   shift_date (required, DATE)
--   start_time (required, TIME)
--   end_time (required, TIME)
--   status (CHECK: scheduled/confirmed/in_progress/completed/cancelled, default scheduled)
--   notes
-- Not imported (server-side / auto-managed):
--   id, company_id (auth context), created_by (Import は actor 経由でセット),
--   created_at/updated_at (default NOW)
--
-- Time semantics (JST):
--   start_time / end_time は TIME without time zone。CSV "09:00" はそのまま 09:00 として
--   保存 (UTC 変換禁止)。shift_date も DATE として保持、timezone shift 禁止。
--
-- CHECK 制約:
--   shifts_assignee_check: assignee_type='employee' → employee_id NOT NULL, partner_id NULL
--                          assignee_type='partner'  → partner_id  NOT NULL, employee_id NULL
--   shifts_time_check: start_time < end_time
--   status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled')
--
-- Rollback:
--   UPDATE: snapshot_data = to_jsonb(v_existing) (全列 before-image)
--   CREATE: snapshot_data = {"operation": "INSERT"} marker
-- ============================================================

CREATE OR REPLACE FUNCTION public.commit_shift_import_session(
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
  v_row           RECORD;
  v_candidate     RECORD;
  v_existing      shifts%ROWTYPE;
  v_new_id        UUID;
  v_inserted      INT := 0;
  v_updated       INT := 0;
  v_skipped       INT := 0;
  v_commit_id     UUID;
  v_mapped        JSONB;
  v_project_id    UUID;
  v_assignee_type TEXT;
  v_employee_id   UUID;
  v_partner_id    UUID;
  v_shift_date    DATE;
  v_start_time    TIME;
  v_end_time      TIME;
  v_status        TEXT;
  v_notes         TEXT;
BEGIN
  -- (1) Session lock + eligibility (helper 055 修正済)
  PERFORM public._import_commit_pre_check(p_session_id, p_company_id, 'shift');

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

    v_project_id    := NULLIF(v_mapped ->> 'project_id',    '')::UUID;
    v_assignee_type := NULLIF(v_mapped ->> 'assignee_type', '');
    v_employee_id   := NULLIF(v_mapped ->> 'employee_id',   '')::UUID;
    v_partner_id    := NULLIF(v_mapped ->> 'partner_id',    '')::UUID;
    v_status        := NULLIF(v_mapped ->> 'status',        '');
    v_notes         := NULLIF(v_mapped ->> 'notes',         '');

    BEGIN v_shift_date := NULLIF(v_mapped ->> 'shift_date', '')::DATE;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid_shift_date_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END;
    BEGIN v_start_time := NULLIF(v_mapped ->> 'start_time', '')::TIME;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid_start_time_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END;
    BEGIN v_end_time := NULLIF(v_mapped ->> 'end_time', '')::TIME;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid_end_time_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END;

    -- Enum / CHECK validation (DB check とダブル、早期発火)
    IF v_assignee_type IS NOT NULL AND v_assignee_type NOT IN ('employee', 'partner') THEN
      RAISE EXCEPTION 'invalid_assignee_type_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END IF;
    IF v_status IS NOT NULL AND v_status NOT IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled') THEN
      RAISE EXCEPTION 'invalid_shift_status_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END IF;
    IF v_start_time IS NOT NULL AND v_end_time IS NOT NULL AND v_start_time >= v_end_time THEN
      RAISE EXCEPTION 'invalid_time_range_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END IF;

    -- Assignee exclusivity check (DB CHECK と一致)
    IF v_assignee_type = 'employee' THEN
      IF v_employee_id IS NULL THEN
        RAISE EXCEPTION 'missing_employee_id_for_row: %', v_row.id USING ERRCODE = 'P0001';
      END IF;
      IF v_partner_id IS NOT NULL THEN
        RAISE EXCEPTION 'unexpected_partner_id_for_employee_row: %', v_row.id USING ERRCODE = 'P0001';
      END IF;
    ELSIF v_assignee_type = 'partner' THEN
      IF v_partner_id IS NULL THEN
        RAISE EXCEPTION 'missing_partner_id_for_row: %', v_row.id USING ERRCODE = 'P0001';
      END IF;
      IF v_employee_id IS NOT NULL THEN
        RAISE EXCEPTION 'unexpected_employee_id_for_partner_row: %', v_row.id USING ERRCODE = 'P0001';
      END IF;
    END IF;

    -- FK company scope verify
    IF v_project_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM projects WHERE id = v_project_id AND company_id = p_company_id) THEN
        RAISE EXCEPTION 'project_not_found_in_company: %', v_project_id USING ERRCODE = 'P0001';
      END IF;
    END IF;
    IF v_employee_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM employees WHERE id = v_employee_id AND company_id = p_company_id) THEN
        RAISE EXCEPTION 'employee_not_found_in_company: %', v_employee_id USING ERRCODE = 'P0001';
      END IF;
    END IF;
    IF v_partner_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM partners WHERE id = v_partner_id AND company_id = p_company_id) THEN
        RAISE EXCEPTION 'partner_not_found_in_company: %', v_partner_id USING ERRCODE = 'P0001';
      END IF;
    END IF;

    -- Determine CREATE vs UPDATE
    SELECT * INTO v_candidate
    FROM public._import_commit_resolve_update_candidate(
      p_session_id, p_company_id, v_row.id, 'shifts'
    );

    IF v_candidate.candidate_id IS NOT NULL THEN
      -- UPDATE branch
      SELECT * INTO v_existing
      FROM shifts
      WHERE id = v_candidate.existing_record_id
        AND company_id = p_company_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'candidate_shift_not_found_in_company: %', v_candidate.existing_record_id USING ERRCODE = 'P0001';
      END IF;

      -- Snapshot BEFORE update
      INSERT INTO import_rollback_snapshots (
        session_id, company_id, target_table, record_id, snapshot_data
      ) VALUES (
        p_session_id, p_company_id, 'shifts', v_existing.id, to_jsonb(v_existing)
      );

      -- Partial merge; company_id / created_by は UPDATE で触らない
      -- assignee_type / employee_id / partner_id は排他 CHECK に関わるので全て指定された場合のみ更新
      UPDATE shifts
      SET project_id    = COALESCE(v_project_id,    project_id),
          assignee_type = COALESCE(v_assignee_type, assignee_type),
          employee_id   = CASE
                            WHEN v_assignee_type = 'employee' THEN v_employee_id
                            WHEN v_assignee_type = 'partner'  THEN NULL
                            ELSE COALESCE(v_employee_id, employee_id)
                          END,
          partner_id    = CASE
                            WHEN v_assignee_type = 'partner'  THEN v_partner_id
                            WHEN v_assignee_type = 'employee' THEN NULL
                            ELSE COALESCE(v_partner_id, partner_id)
                          END,
          shift_date    = COALESCE(v_shift_date,    shift_date),
          start_time    = COALESCE(v_start_time,    start_time),
          end_time      = COALESCE(v_end_time,      end_time),
          status        = COALESCE(v_status,        status),
          notes         = COALESCE(v_notes,         notes),
          updated_at    = NOW()
      WHERE id = v_existing.id AND company_id = p_company_id;

      v_updated := v_updated + 1;
    ELSE
      -- CREATE branch: project + assignee + date + start + end 必須
      IF v_project_id IS NULL THEN
        RAISE EXCEPTION 'create_missing_project_id_for_row: %', v_row.id USING ERRCODE = 'P0001';
      END IF;
      IF v_assignee_type IS NULL THEN
        RAISE EXCEPTION 'create_missing_assignee_type_for_row: %', v_row.id USING ERRCODE = 'P0001';
      END IF;
      IF v_shift_date IS NULL THEN
        RAISE EXCEPTION 'create_missing_shift_date_for_row: %', v_row.id USING ERRCODE = 'P0001';
      END IF;
      IF v_start_time IS NULL OR v_end_time IS NULL THEN
        RAISE EXCEPTION 'create_missing_time_for_row: %', v_row.id USING ERRCODE = 'P0001';
      END IF;

      INSERT INTO shifts (
        company_id, project_id,
        assignee_type, employee_id, partner_id,
        shift_date, start_time, end_time,
        status, notes,
        created_by
      ) VALUES (
        p_company_id, v_project_id,
        v_assignee_type, v_employee_id, v_partner_id,
        v_shift_date, v_start_time, v_end_time,
        COALESCE(v_status, 'scheduled'),
        v_notes,
        p_actor_id
      )
      RETURNING id INTO v_new_id;

      -- CREATE marker snapshot
      INSERT INTO import_rollback_snapshots (
        session_id, company_id, target_table, record_id, snapshot_data
      ) VALUES (
        p_session_id, p_company_id, 'shifts', v_new_id,
        jsonb_build_object('operation', 'INSERT')
      );

      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  -- (3) Count skipped
  v_skipped := public._import_commit_count_skipped(p_session_id, p_company_id);

  -- (4) Finalize
  v_commit_id := public._import_commit_finalize(
    p_session_id, p_company_id, p_actor_id,
    v_inserted, v_updated, v_skipped
  );

  RETURN QUERY SELECT v_inserted, v_updated, v_skipped, v_commit_id;
END;
$$;

-- ---- Grants ----
REVOKE ALL ON FUNCTION public.commit_shift_import_session(UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commit_shift_import_session(UUID, UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.commit_shift_import_session(UUID, UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.commit_shift_import_session(UUID, UUID, UUID) TO service_role;

-- ============================================================
-- Rollback Note:
--   DROP FUNCTION IF EXISTS public.commit_shift_import_session(UUID, UUID, UUID);
-- ============================================================
