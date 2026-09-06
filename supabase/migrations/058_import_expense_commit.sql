-- ============================================================
-- 058: Secure Import — Expense Commit RPC (Phase B, Historical)
--
-- 目的:
--   Review 済み import_staging_rows を expenses テーブルへ atomic に反映する。
--   Historical Import として、既存の申請/承認/精算 workflow を発火させない
--   直接 INSERT/UPDATE のみを行う。
--
-- 呼び出し元:
--   POST /api/import/sessions/[id]/commit (service_role client, entity_type=expense)
--
-- Historical Import 契約 (最重要):
--   1) 通常の expense 申請 API は呼ばない (Next.js API 経由なし)
--   2) OCR API / OpenAI API は呼ばない (receipt_url / ocr_result は CSV 値のまま保持)
--   3) submitted_at / approved_by / approved_at / settled_by / settled_at /
--      withdrawn_at / reject_reason 等の workflow timestamp は CSV 明示値のみ採用、
--      Import が自動生成しない
--   4) DB Trigger 監査済: expenses に対する trigger は expenses_updated_at のみ
--      (updated_at handler、通知発火なし)
--   5) status は CSV 値をそのまま保存 (draft/submitted/approved/rejected/settled/withdrawn)
--      Historical で既に approved/settled 状態のデータを移行する想定
--
-- Expense 固有 field allowlist:
--   worker_id (required, FK auth.users, Map phase で employee → auth_user_id resolve 済)
--   expense_date (required, DATE, default CURRENT_DATE)
--   category (required, CHECK: transport/parking/supplies/consumables/other, default transport)
--   amount (required, INT >= 0, default 0)
--   description
--   receipt_url
--   status (CHECK: draft/submitted/approved/rejected/settled/withdrawn, default draft)
--   note
--   assignee_type (CHECK: employee/partner)
--   employee_id (FK employees, optional)
--   partner_id  (FK partners,  optional)
--   project_id  (FK projects,  optional, Map phase で resolve 済)
--   shift_id    (FK shifts,    optional)
--   job_id      (FK jobs,      optional)
--   claim_month (DATE, 給与月)
--   submitted_at / approved_by / approved_at / settled_by / settled_at /
--     settled_amount / withdrawn_at / reject_reason (historical timestamps only)
-- Not imported (server-side / auto-managed):
--   id, company_id (auth context), created_at/updated_at (default NOW),
--   ocr_result (Import で OCR しない、CSV 明示 JSON があれば通す)
--
-- FK company scope 契約:
--   - worker_id が同 company の profile である事を verify (auth.users 直接では company_id が無いため
--     profiles を経由して確認)
--   - employee_id が同 company であることを verify
--   - project_id 等の他 FK は Map route で company scope pre-load 済 (二重 verify は project のみ)
--
-- Rollback:
--   UPDATE: snapshot_data = to_jsonb(v_existing_expense) (全列 before-image)
--   CREATE: snapshot_data = {"operation": "INSERT"} marker
-- ============================================================

CREATE OR REPLACE FUNCTION public.commit_expense_import_session(
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
  v_row             RECORD;
  v_candidate       RECORD;
  v_existing        expenses%ROWTYPE;
  v_new_id          UUID;
  v_inserted        INT := 0;
  v_updated         INT := 0;
  v_skipped         INT := 0;
  v_commit_id       UUID;
  v_mapped          JSONB;
  v_worker_id       UUID;
  v_expense_date    DATE;
  v_category        TEXT;
  v_amount          INT;
  v_description     TEXT;
  v_receipt_url     TEXT;
  v_status          TEXT;
  v_note            TEXT;
  v_assignee_type   TEXT;
  v_employee_id     UUID;
  v_partner_id      UUID;
  v_project_id      UUID;
  v_shift_id        UUID;
  v_job_id          UUID;
  v_claim_month     DATE;
  v_submitted_at    TIMESTAMPTZ;
  v_approved_by     UUID;
  v_approved_at     TIMESTAMPTZ;
  v_settled_by      UUID;
  v_settled_at      TIMESTAMPTZ;
  v_settled_amount  INT;
  v_withdrawn_at    TIMESTAMPTZ;
  v_reject_reason   TEXT;
BEGIN
  -- (1) Session lock + eligibility (helper 055 修正済)
  PERFORM public._import_commit_pre_check(p_session_id, p_company_id, 'expense');

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

    -- Expense allowlist extraction
    v_worker_id     := NULLIF(v_mapped ->> 'worker_id',   '')::UUID;
    v_description   := NULLIF(v_mapped ->> 'description', '');
    v_receipt_url   := NULLIF(v_mapped ->> 'receipt_url', '');
    v_status        := NULLIF(v_mapped ->> 'status',      '');
    v_category      := NULLIF(v_mapped ->> 'category',    '');
    v_note          := NULLIF(v_mapped ->> 'note',        '');
    v_assignee_type := NULLIF(v_mapped ->> 'assignee_type', '');
    v_employee_id   := NULLIF(v_mapped ->> 'employee_id', '')::UUID;
    v_partner_id    := NULLIF(v_mapped ->> 'partner_id',  '')::UUID;
    v_project_id    := NULLIF(v_mapped ->> 'project_id',  '')::UUID;
    v_shift_id      := NULLIF(v_mapped ->> 'shift_id',    '')::UUID;
    v_job_id        := NULLIF(v_mapped ->> 'job_id',      '')::UUID;
    v_approved_by   := NULLIF(v_mapped ->> 'approved_by', '')::UUID;
    v_settled_by    := NULLIF(v_mapped ->> 'settled_by',  '')::UUID;
    v_reject_reason := NULLIF(v_mapped ->> 'reject_reason', '');

    BEGIN v_expense_date := NULLIF(v_mapped ->> 'expense_date', '')::DATE;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid_expense_date_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END;
    BEGIN v_claim_month := NULLIF(v_mapped ->> 'claim_month', '')::DATE;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid_claim_month_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END;
    BEGIN v_submitted_at := NULLIF(v_mapped ->> 'submitted_at', '')::TIMESTAMPTZ;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid_submitted_at_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END;
    BEGIN v_approved_at := NULLIF(v_mapped ->> 'approved_at', '')::TIMESTAMPTZ;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid_approved_at_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END;
    BEGIN v_settled_at := NULLIF(v_mapped ->> 'settled_at', '')::TIMESTAMPTZ;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid_settled_at_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END;
    BEGIN v_withdrawn_at := NULLIF(v_mapped ->> 'withdrawn_at', '')::TIMESTAMPTZ;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid_withdrawn_at_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END;

    BEGIN v_amount := NULLIF(v_mapped ->> 'amount', '')::INT;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid_amount_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END;
    IF v_amount IS NOT NULL AND v_amount < 0 THEN
      RAISE EXCEPTION 'negative_amount_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END IF;

    BEGIN v_settled_amount := NULLIF(v_mapped ->> 'settled_amount', '')::INT;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid_settled_amount_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END;

    -- Enum validation
    IF v_category IS NOT NULL AND v_category NOT IN ('transport', 'parking', 'supplies', 'consumables', 'other') THEN
      RAISE EXCEPTION 'invalid_category_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END IF;
    IF v_status IS NOT NULL AND v_status NOT IN ('draft', 'submitted', 'approved', 'rejected', 'settled', 'withdrawn') THEN
      RAISE EXCEPTION 'invalid_status_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END IF;
    IF v_assignee_type IS NOT NULL AND v_assignee_type NOT IN ('employee', 'partner') THEN
      RAISE EXCEPTION 'invalid_assignee_type_for_row: %', v_row.id USING ERRCODE = 'P0001';
    END IF;

    -- FK company scope verify
    -- worker_id (auth.users): profile 経由で company scope verify
    IF v_worker_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = v_worker_id AND company_id = p_company_id
      ) THEN
        RAISE EXCEPTION 'worker_not_found_in_company: %', v_worker_id USING ERRCODE = 'P0001';
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
    IF v_project_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM projects WHERE id = v_project_id AND company_id = p_company_id) THEN
        RAISE EXCEPTION 'project_not_found_in_company: %', v_project_id USING ERRCODE = 'P0001';
      END IF;
    END IF;

    -- Determine CREATE vs UPDATE
    SELECT * INTO v_candidate
    FROM public._import_commit_resolve_update_candidate(
      p_session_id, p_company_id, v_row.id, 'expenses'
    );

    IF v_candidate.candidate_id IS NOT NULL THEN
      -- UPDATE branch
      SELECT * INTO v_existing
      FROM expenses
      WHERE id = v_candidate.existing_record_id
        AND company_id = p_company_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'candidate_expense_not_found_in_company: %', v_candidate.existing_record_id USING ERRCODE = 'P0001';
      END IF;

      -- Snapshot BEFORE update
      INSERT INTO import_rollback_snapshots (
        session_id, company_id, target_table, record_id, snapshot_data
      ) VALUES (
        p_session_id, p_company_id, 'expenses', v_existing.id, to_jsonb(v_existing)
      );

      -- Partial merge; worker_id / company_id は絶対に上書きしない
      UPDATE expenses
      SET expense_date    = COALESCE(v_expense_date,    expense_date),
          category        = COALESCE(v_category,        category),
          amount          = COALESCE(v_amount,          amount),
          description     = COALESCE(v_description,     description),
          receipt_url     = COALESCE(v_receipt_url,     receipt_url),
          status          = COALESCE(v_status,          status),
          note            = COALESCE(v_note,            note),
          assignee_type   = COALESCE(v_assignee_type,   assignee_type),
          employee_id     = COALESCE(v_employee_id,     employee_id),
          partner_id      = COALESCE(v_partner_id,      partner_id),
          project_id      = COALESCE(v_project_id,      project_id),
          shift_id        = COALESCE(v_shift_id,        shift_id),
          job_id          = COALESCE(v_job_id,          job_id),
          claim_month     = COALESCE(v_claim_month,     claim_month),
          submitted_at    = COALESCE(v_submitted_at,    submitted_at),
          approved_by     = COALESCE(v_approved_by,     approved_by),
          approved_at     = COALESCE(v_approved_at,     approved_at),
          settled_by      = COALESCE(v_settled_by,      settled_by),
          settled_at      = COALESCE(v_settled_at,      settled_at),
          settled_amount  = COALESCE(v_settled_amount,  settled_amount),
          withdrawn_at    = COALESCE(v_withdrawn_at,    withdrawn_at),
          reject_reason   = COALESCE(v_reject_reason,   reject_reason),
          updated_at      = NOW()
      WHERE id = v_existing.id AND company_id = p_company_id;

      v_updated := v_updated + 1;
    ELSE
      -- CREATE branch: worker_id + expense_date + category + amount 必須
      IF v_worker_id IS NULL THEN
        RAISE EXCEPTION 'create_missing_worker_id_for_row: %', v_row.id USING ERRCODE = 'P0001';
      END IF;

      INSERT INTO expenses (
        company_id, worker_id,
        expense_date, category, amount,
        description, receipt_url, status, note,
        assignee_type, employee_id, partner_id,
        project_id, shift_id, job_id,
        claim_month,
        submitted_at, approved_by, approved_at,
        settled_by, settled_at, settled_amount,
        withdrawn_at, reject_reason
      ) VALUES (
        p_company_id, v_worker_id,
        COALESCE(v_expense_date, CURRENT_DATE),
        COALESCE(v_category, 'transport'),
        COALESCE(v_amount, 0),
        v_description, v_receipt_url,
        COALESCE(v_status, 'draft'),
        v_note,
        v_assignee_type, v_employee_id, v_partner_id,
        v_project_id, v_shift_id, v_job_id,
        v_claim_month,
        v_submitted_at, v_approved_by, v_approved_at,
        v_settled_by, v_settled_at, v_settled_amount,
        v_withdrawn_at, v_reject_reason
      )
      RETURNING id INTO v_new_id;

      -- CREATE marker snapshot
      INSERT INTO import_rollback_snapshots (
        session_id, company_id, target_table, record_id, snapshot_data
      ) VALUES (
        p_session_id, p_company_id, 'expenses', v_new_id,
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
REVOKE ALL ON FUNCTION public.commit_expense_import_session(UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commit_expense_import_session(UUID, UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.commit_expense_import_session(UUID, UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.commit_expense_import_session(UUID, UUID, UUID) TO service_role;

-- ============================================================
-- Rollback Note:
--   DROP FUNCTION IF EXISTS public.commit_expense_import_session(UUID, UUID, UUID);
-- ============================================================
