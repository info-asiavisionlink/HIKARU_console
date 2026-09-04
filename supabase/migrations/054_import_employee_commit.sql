-- ============================================================
-- 054: Secure Import — Employee Commit RPC
--
-- 目的:
--   Review 済み import_staging_rows を employees テーブルへ atomic に反映する。
--   Migration 052 helper を利用し、Employee 固有部分だけを実装。
--
-- 呼び出し元:
--   POST /api/import/sessions/[id]/commit (service_role client, entity_type=employee)
--
-- Employee 固有 field allowlist:
--   name (required)
--   employee_number (optional、指定なければ trigger auto-generate: EMP-XXXX)
--   name_kana, birth_date, gender ('male'|'female'|'other'), phone, email,
--   address, emergency_contact, hire_date, department, position, notes,
--   status ('active'|'on_leave'|'resigned'|'suspended'|'deleted')
--
-- Not imported (Import では絶対に触らない):
--   auth_user_id ← Auth invitation は Import 経由禁止、NULL 固定
--   qualifications[] ← 複雑構造、将来対応
--
-- No side effects:
--   Employee INSERT で LINE / email / notifications INSERT は発生しない (通常業務経路と同じ)。
--   auth.users への INSERT なし = 招待メールも発生しない。
-- ============================================================

CREATE OR REPLACE FUNCTION public.commit_employee_import_session(
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
  v_existing_employee employees%ROWTYPE;
  v_new_employee_id   UUID;
  v_inserted          INT := 0;
  v_updated           INT := 0;
  v_skipped           INT := 0;
  v_commit_id         UUID;
  v_mapped            JSONB;
  v_name              TEXT;
  v_name_kana         TEXT;
  v_employee_number   TEXT;
  v_email             TEXT;
  v_phone             TEXT;
  v_birth_date        DATE;
  v_gender            TEXT;
  v_address           TEXT;
  v_emergency_contact TEXT;
  v_hire_date         DATE;
  v_department        TEXT;
  v_position          TEXT;
  v_notes             TEXT;
  v_status            public.employee_status;
  v_status_text       TEXT;
  v_gender_text       TEXT;
BEGIN
  -- (1) Session lock + eligibility
  PERFORM public._import_commit_pre_check(p_session_id, p_company_id, 'employee');

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

    -- Employee allowlist extraction
    v_name              := NULLIF(v_mapped ->> 'name', '');
    v_name_kana         := NULLIF(v_mapped ->> 'name_kana', '');
    v_employee_number   := NULLIF(v_mapped ->> 'employee_number', '');
    v_email             := NULLIF(v_mapped ->> 'email', '');
    v_phone             := NULLIF(v_mapped ->> 'phone', '');
    v_address           := NULLIF(v_mapped ->> 'address', '');
    v_emergency_contact := NULLIF(v_mapped ->> 'emergency_contact', '');
    v_department        := NULLIF(v_mapped ->> 'department', '');
    v_position          := NULLIF(v_mapped ->> 'position', '');
    v_notes             := NULLIF(v_mapped ->> 'notes', '');

    -- Date fields (invalid date → NULL 扱い、user 修正想定)
    BEGIN
      v_birth_date := NULLIF(v_mapped ->> 'birth_date', '')::DATE;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'invalid_birth_date_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END;
    BEGIN
      v_hire_date := NULLIF(v_mapped ->> 'hire_date', '')::DATE;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'invalid_hire_date_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END;

    -- Gender enum check
    v_gender_text := NULLIF(v_mapped ->> 'gender', '');
    IF v_gender_text IS NOT NULL AND v_gender_text NOT IN ('male', 'female', 'other') THEN
      RAISE EXCEPTION 'invalid_gender_for_row: % (value=%)', v_row.id, v_gender_text
        USING ERRCODE = 'P0001';
    END IF;
    v_gender := v_gender_text;

    -- Status enum check
    v_status_text := NULLIF(v_mapped ->> 'status', '');
    IF v_status_text IS NULL THEN
      v_status := 'active';  -- default
    ELSIF v_status_text NOT IN ('active','on_leave','resigned','suspended','deleted') THEN
      RAISE EXCEPTION 'invalid_status_for_row: % (value=%)', v_row.id, v_status_text
        USING ERRCODE = 'P0001';
    ELSE
      v_status := v_status_text::public.employee_status;
    END IF;

    -- Determine CREATE vs UPDATE
    SELECT * INTO v_candidate
    FROM public._import_commit_resolve_update_candidate(
      p_session_id, p_company_id, v_row.id, 'employees'
    );

    IF v_candidate.candidate_id IS NOT NULL THEN
      -- UPDATE branch
      SELECT * INTO v_existing_employee
      FROM employees
      WHERE id = v_candidate.existing_record_id
        AND company_id = p_company_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'candidate_employee_not_found_in_company: %', v_candidate.existing_record_id
          USING ERRCODE = 'P0001';
      END IF;

      IF v_name IS NULL THEN
        RAISE EXCEPTION 'update_missing_name_for_row: %', v_row.id USING ERRCODE = 'P0001';
      END IF;

      -- Snapshot BEFORE update (auth_user_id は変更しない)
      INSERT INTO import_rollback_snapshots (
        session_id, company_id, target_table, record_id, snapshot_data
      ) VALUES (
        p_session_id, p_company_id, 'employees', v_existing_employee.id, to_jsonb(v_existing_employee)
      );

      -- Partial merge (NULL mapped → keep existing)
      -- auth_user_id は絶対に触らない。employee_number は既存維持推奨だが
      -- CSV で明示指定があれば更新可 (稀ケース)。
      UPDATE employees
      SET name              = COALESCE(v_name,              name),
          name_kana         = COALESCE(v_name_kana,         name_kana),
          employee_number   = COALESCE(v_employee_number,   employee_number),
          email             = COALESCE(v_email,             email),
          phone             = COALESCE(v_phone,             phone),
          birth_date        = COALESCE(v_birth_date,        birth_date),
          gender            = COALESCE(v_gender,            gender),
          address           = COALESCE(v_address,           address),
          emergency_contact = COALESCE(v_emergency_contact, emergency_contact),
          hire_date         = COALESCE(v_hire_date,         hire_date),
          department        = COALESCE(v_department,        department),
          position          = COALESCE(v_position,          position),
          notes             = COALESCE(v_notes,             notes),
          status            = COALESCE(v_status,            status),
          updated_at        = NOW()
      WHERE id = v_existing_employee.id AND company_id = p_company_id;

      v_updated := v_updated + 1;
    ELSE
      -- CREATE branch: name 必須。他は全て optional (employee_number は trigger auto)。
      IF v_name IS NULL THEN
        RAISE EXCEPTION 'create_missing_name_for_row: %', v_row.id USING ERRCODE = 'P0001';
      END IF;

      -- auth_user_id は NULL 固定 (Import で招待メールを絶対に発生させない)
      INSERT INTO employees (
        company_id, name, name_kana, employee_number, email, phone,
        birth_date, gender, address, emergency_contact,
        hire_date, department, position, notes, status, auth_user_id
      ) VALUES (
        p_company_id, v_name, v_name_kana, v_employee_number, v_email, v_phone,
        v_birth_date, v_gender, v_address, v_emergency_contact,
        v_hire_date, v_department, v_position, v_notes, v_status, NULL
      )
      RETURNING id INTO v_new_employee_id;

      -- CREATE marker snapshot
      INSERT INTO import_rollback_snapshots (
        session_id, company_id, target_table, record_id, snapshot_data
      ) VALUES (
        p_session_id, p_company_id, 'employees', v_new_employee_id,
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
REVOKE ALL ON FUNCTION public.commit_employee_import_session(UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commit_employee_import_session(UUID, UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.commit_employee_import_session(UUID, UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.commit_employee_import_session(UUID, UUID, UUID) TO service_role;

-- ============================================================
-- Rollback Note:
--   DROP FUNCTION IF EXISTS public.commit_employee_import_session(UUID, UUID, UUID);
-- ============================================================
