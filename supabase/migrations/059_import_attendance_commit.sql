-- ============================================================
-- 059: Secure Import — Attendance Commit RPC (Phase B, Historical)
--
-- 目的:
--   Review 済み import_staging_rows を attendance_records テーブルへ
--   atomic に反映する。Historical Import として、通常の打刻/勤怠修正
--   workflow を発火させない直接 INSERT/UPDATE のみを行う。
--
-- 呼び出し元:
--   POST /api/import/sessions/[id]/commit (service_role client, entity_type=attendance)
--
-- 前提: Migration 056 で import_entity_type ENUM に 'attendance' が追加済み。
--
-- Historical Import 契約 (最重要):
--   1) 通常の打刻/修正申請 API は呼ばない
--   2) auth.users / profiles を Import 内で絶対に自動生成しない
--   3) worker_id (auth.users.id) 解決は「既に auth_user_id を持つ Employee のみ」に限る:
--      employees.id → employees.auth_user_id → attendance.worker_id
--      auth_user_id NULL の Employee は Import で resolve 不可 (missing_auth_user)
--   4) DB Trigger 監査: attendance_records に対する trigger は無し (Migration 049〜055 で追加なし
--      + Production 監査済)
--   5) UNIQUE(worker_id, work_date) が DB 契約 → 二重登録は DB 側で自然に防止 (23505 発火)
--
-- Attendance 固有 field allowlist:
--   worker_id (required, FK auth.users, Map phase で employee → auth_user_id resolve 済)
--   work_date (required, DATE, default CURRENT_DATE)
--   clock_in / break_start / break_end / clock_out (TIMESTAMPTZ)
--   break_minutes (INT, default 0)
--   work_minutes (INT, default 0)
--   hourly_rate  (INT, default 0)
--   daily_pay    (INT, default 0)
--   notes
-- Not imported (server-side / auto-managed):
--   id, company_id (auth context), created_at/updated_at (default NOW)
--
-- FK company scope 契約:
--   - worker_id が profiles を経由して同 company であることを RPC 内で verify
--     (auth.users には company_id が無い、profiles.company_id で代替 verify)
--
-- Duplicate 制約:
--   UNIQUE(worker_id, work_date) を DB 側で持つ。RPC 内 INSERT が二重で走ると
--   23505 (unique_violation) が発火し EXCEPTION で全 tx rollback する契約。
--   Review UI で UPDATE 選択された場合は既存 record を UPDATE する。
--
-- Rollback:
--   UPDATE: snapshot_data = to_jsonb(v_existing) (全列 before-image)
--   CREATE: snapshot_data = {"operation": "INSERT"} marker
-- ============================================================

CREATE OR REPLACE FUNCTION public.commit_attendance_import_session(
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
  v_row            RECORD;
  v_candidate      RECORD;
  v_existing       attendance_records%ROWTYPE;
  v_new_id         UUID;
  v_inserted       INT := 0;
  v_updated        INT := 0;
  v_skipped        INT := 0;
  v_commit_id      UUID;
  v_mapped         JSONB;
  v_worker_id      UUID;
  v_work_date      DATE;
  v_clock_in       TIMESTAMPTZ;
  v_break_start    TIMESTAMPTZ;
  v_break_end      TIMESTAMPTZ;
  v_clock_out      TIMESTAMPTZ;
  v_break_minutes  INT;
  v_work_minutes   INT;
  v_hourly_rate    INT;
  v_daily_pay      INT;
  v_notes          TEXT;
BEGIN
  -- (1) Session lock + eligibility (helper 055 修正済)
  PERFORM public._import_commit_pre_check(p_session_id, p_company_id, 'attendance');

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

    v_worker_id := NULLIF(v_mapped ->> 'worker_id', '')::UUID;
    v_notes     := NULLIF(v_mapped ->> 'notes',     '');

    BEGIN v_work_date := NULLIF(v_mapped ->> 'work_date', '')::DATE;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid_work_date_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END;
    BEGIN v_clock_in := NULLIF(v_mapped ->> 'clock_in', '')::TIMESTAMPTZ;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid_clock_in_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END;
    BEGIN v_break_start := NULLIF(v_mapped ->> 'break_start', '')::TIMESTAMPTZ;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid_break_start_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END;
    BEGIN v_break_end := NULLIF(v_mapped ->> 'break_end', '')::TIMESTAMPTZ;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid_break_end_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END;
    BEGIN v_clock_out := NULLIF(v_mapped ->> 'clock_out', '')::TIMESTAMPTZ;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid_clock_out_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END;

    BEGIN v_break_minutes := NULLIF(v_mapped ->> 'break_minutes', '')::INT;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid_break_minutes_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END;
    BEGIN v_work_minutes := NULLIF(v_mapped ->> 'work_minutes', '')::INT;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid_work_minutes_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END;
    BEGIN v_hourly_rate := NULLIF(v_mapped ->> 'hourly_rate', '')::INT;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid_hourly_rate_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END;
    BEGIN v_daily_pay := NULLIF(v_mapped ->> 'daily_pay', '')::INT;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid_daily_pay_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END;

    -- Non-negative integer check
    IF (v_break_minutes IS NOT NULL AND v_break_minutes < 0) OR
       (v_work_minutes  IS NOT NULL AND v_work_minutes  < 0) OR
       (v_hourly_rate   IS NOT NULL AND v_hourly_rate   < 0) OR
       (v_daily_pay     IS NOT NULL AND v_daily_pay     < 0) THEN
      RAISE EXCEPTION 'negative_int_field_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END IF;

    -- worker_id (auth.users): profile 経由で company scope verify
    IF v_worker_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = v_worker_id AND company_id = p_company_id
      ) THEN
        RAISE EXCEPTION 'worker_not_found_in_company: %', v_worker_id USING ERRCODE = 'P0001';
      END IF;
    END IF;

    -- Determine CREATE vs UPDATE
    SELECT * INTO v_candidate
    FROM public._import_commit_resolve_update_candidate(
      p_session_id, p_company_id, v_row.id, 'attendance_records'
    );

    IF v_candidate.candidate_id IS NOT NULL THEN
      -- UPDATE branch
      SELECT * INTO v_existing
      FROM attendance_records
      WHERE id = v_candidate.existing_record_id
        AND company_id = p_company_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'candidate_attendance_not_found_in_company: %', v_candidate.existing_record_id USING ERRCODE = 'P0001';
      END IF;

      -- Snapshot BEFORE update
      INSERT INTO import_rollback_snapshots (
        session_id, company_id, target_table, record_id, snapshot_data
      ) VALUES (
        p_session_id, p_company_id, 'attendance_records', v_existing.id, to_jsonb(v_existing)
      );

      -- worker_id / company_id / work_date は UNIQUE(worker_id, work_date) に関わる
      -- ため UPDATE で変更させない (別 record 混入防止)
      UPDATE attendance_records
      SET clock_in      = COALESCE(v_clock_in,      clock_in),
          break_start   = COALESCE(v_break_start,   break_start),
          break_end     = COALESCE(v_break_end,     break_end),
          clock_out     = COALESCE(v_clock_out,     clock_out),
          break_minutes = COALESCE(v_break_minutes, break_minutes),
          work_minutes  = COALESCE(v_work_minutes,  work_minutes),
          hourly_rate   = COALESCE(v_hourly_rate,   hourly_rate),
          daily_pay     = COALESCE(v_daily_pay,     daily_pay),
          notes         = COALESCE(v_notes,         notes),
          updated_at    = NOW()
      WHERE id = v_existing.id AND company_id = p_company_id;

      v_updated := v_updated + 1;
    ELSE
      -- CREATE branch
      IF v_worker_id IS NULL THEN
        RAISE EXCEPTION 'create_missing_worker_id_for_row: %', v_row.id USING ERRCODE = 'P0001';
      END IF;

      -- UNIQUE(worker_id, work_date) 違反は DB 側 23505 で発火 → 全 tx rollback
      INSERT INTO attendance_records (
        company_id, worker_id,
        work_date,
        clock_in, break_start, break_end, clock_out,
        break_minutes, work_minutes,
        hourly_rate, daily_pay,
        notes
      ) VALUES (
        p_company_id, v_worker_id,
        COALESCE(v_work_date, CURRENT_DATE),
        v_clock_in, v_break_start, v_break_end, v_clock_out,
        COALESCE(v_break_minutes, 0),
        COALESCE(v_work_minutes,  0),
        COALESCE(v_hourly_rate,   0),
        COALESCE(v_daily_pay,     0),
        v_notes
      )
      RETURNING id INTO v_new_id;

      -- CREATE marker snapshot
      INSERT INTO import_rollback_snapshots (
        session_id, company_id, target_table, record_id, snapshot_data
      ) VALUES (
        p_session_id, p_company_id, 'attendance_records', v_new_id,
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
REVOKE ALL ON FUNCTION public.commit_attendance_import_session(UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commit_attendance_import_session(UUID, UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.commit_attendance_import_session(UUID, UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.commit_attendance_import_session(UUID, UUID, UUID) TO service_role;

-- ============================================================
-- Rollback Note:
--   DROP FUNCTION IF EXISTS public.commit_attendance_import_session(UUID, UUID, UUID);
-- ============================================================
