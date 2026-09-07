-- ============================================================
-- Migration 035 — attendance_records + attendance_correction_requests
--
-- Recovery backfill for Production schema drift.
--
-- Historical context:
--   These two tables were created in Production out-of-band (Supabase Studio
--   direct SQL Editor or `supabase db push` from a local machine) some time
--   between 2026-08-11 and 2026-08-13. The migration file was never committed
--   to Git — the numeric gap at 035 in `supabase/migrations/` reflects this
--   drift (audit confirmed: no historical 035 file ever existed in any git
--   branch or reflog).
--
-- Why 035 (backfill), not 061+:
--   Migration 059 (import_attendance_commit RPC) references attendance_records
--   in its function body. A fresh database that runs migrations in order MUST
--   have attendance_records CREATED before 059 runs, otherwise 059 fails with
--   "relation does not exist". Placing recovery at 035 (before 049-060 import
--   layer) preserves fresh-env replayability.
--
-- Why idempotent (IF NOT EXISTS + DO blocks):
--   Production already contains these tables and everything else this file
--   defines. If any environment re-applies migrations (supabase db push /
--   supabase migration up), this file MUST be a safe no-op. All CREATE TABLE
--   / CREATE INDEX use IF NOT EXISTS; constraints/policies/triggers are
--   guarded by pg_constraint / DROP POLICY IF EXISTS / DROP TRIGGER IF EXISTS
--   patterns.
--
-- Exact Production reproduction:
--   Schema below matches Production Supabase read-only extraction 2026-11.
--   attendance_records.worker_id            → auth.users(id)  ON DELETE CASCADE
--   attendance_correction_requests.worker_id → profiles(id)    ON DELETE CASCADE
--   This asymmetry is REAL Production behavior and must NOT be "cleaned up"
--   in this backfill. Any normalization should be a separate, reviewed change.
--
-- Dependencies verified in earlier migrations:
--   001_create_profiles.sql
--     - public.companies                                                 (line 12)
--     - public.profiles                                                  (line 22)
--     - public.handle_updated_at() trigger function                      (line 138)
--   002_console_tables.sql
--     - public.is_admin_of(company_id UUID)                              (line 154)
--   auth.users is provided by Supabase auth schema (always available).
--
-- Migration 049〜060 remain FROZEN. This file does NOT modify them.
-- ============================================================

BEGIN;

-- ============================================================
-- attendance_records
-- ============================================================

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id             UUID         NOT NULL DEFAULT gen_random_uuid(),
  worker_id      UUID         NOT NULL,
  company_id     UUID         NOT NULL,
  work_date      DATE         NOT NULL DEFAULT CURRENT_DATE,
  clock_in       TIMESTAMPTZ,
  break_start    TIMESTAMPTZ,
  break_end      TIMESTAMPTZ,
  clock_out      TIMESTAMPTZ,
  break_minutes  INTEGER               DEFAULT 0,
  work_minutes   INTEGER               DEFAULT 0,
  hourly_rate    INTEGER               DEFAULT 0,
  daily_pay      INTEGER               DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMPTZ           DEFAULT NOW(),
  updated_at     TIMESTAMPTZ           DEFAULT NOW(),
  CONSTRAINT attendance_records_pkey PRIMARY KEY (id)
);

-- FK / UNIQUE constraints (idempotent via pg_constraint check;
-- vanilla PostgreSQL has no ALTER TABLE ADD CONSTRAINT IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'attendance_records_company_id_fkey'
      AND conrelid = 'public.attendance_records'::regclass
  ) THEN
    ALTER TABLE public.attendance_records
      ADD CONSTRAINT attendance_records_company_id_fkey
      FOREIGN KEY (company_id)
      REFERENCES public.companies(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'attendance_records_worker_id_fkey'
      AND conrelid = 'public.attendance_records'::regclass
  ) THEN
    ALTER TABLE public.attendance_records
      ADD CONSTRAINT attendance_records_worker_id_fkey
      FOREIGN KEY (worker_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'attendance_records_worker_id_work_date_key'
      AND conrelid = 'public.attendance_records'::regclass
  ) THEN
    ALTER TABLE public.attendance_records
      ADD CONSTRAINT attendance_records_worker_id_work_date_key
      UNIQUE (worker_id, work_date);
  END IF;
END $$;

-- Indexes (regular + composite)
CREATE INDEX IF NOT EXISTS attendance_company_date_idx
  ON public.attendance_records(company_id, work_date);
CREATE INDEX IF NOT EXISTS attendance_worker_date_idx
  ON public.attendance_records(worker_id, work_date);

-- RLS
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Production uses `TO public` role for attendance_records policies
-- (asymmetric vs correction_requests which uses `TO authenticated`).
-- Reproduce exactly.
DROP POLICY IF EXISTS "attendance: admin read" ON public.attendance_records;
CREATE POLICY "attendance: admin read"
  ON public.attendance_records FOR SELECT TO public
  USING (public.is_admin_of(company_id));

DROP POLICY IF EXISTS "attendance: admin update" ON public.attendance_records;
CREATE POLICY "attendance: admin update"
  ON public.attendance_records FOR UPDATE TO public
  USING (public.is_admin_of(company_id));

DROP POLICY IF EXISTS "attendance: worker own" ON public.attendance_records;
CREATE POLICY "attendance: worker own"
  ON public.attendance_records FOR ALL TO public
  USING (auth.uid() = worker_id)
  WITH CHECK (auth.uid() = worker_id);

-- ============================================================
-- attendance_correction_requests
-- ============================================================

CREATE TABLE IF NOT EXISTS public.attendance_correction_requests (
  id                     UUID         NOT NULL DEFAULT gen_random_uuid(),
  company_id             UUID         NOT NULL,
  attendance_record_id   UUID         NOT NULL,
  worker_id              UUID         NOT NULL,
  original_clock_in      TIMESTAMPTZ,
  original_clock_out     TIMESTAMPTZ,
  original_break_start   TIMESTAMPTZ,
  original_break_end     TIMESTAMPTZ,
  requested_clock_in     TIMESTAMPTZ,
  requested_clock_out    TIMESTAMPTZ,
  requested_break_start  TIMESTAMPTZ,
  requested_break_end    TIMESTAMPTZ,
  reason                 TEXT         NOT NULL,
  status                 TEXT         NOT NULL DEFAULT 'submitted',
  reviewed_by            UUID,
  reviewed_at            TIMESTAMPTZ,
  review_comment         TEXT,
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT attendance_correction_requests_pkey PRIMARY KEY (id)
);

-- CHECK + FK constraints (idempotent)
DO $$
BEGIN
  -- acr_has_correction: at least one requested_* field must be non-NULL
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'acr_has_correction'
      AND conrelid = 'public.attendance_correction_requests'::regclass
  ) THEN
    ALTER TABLE public.attendance_correction_requests
      ADD CONSTRAINT acr_has_correction CHECK (
        requested_clock_in IS NOT NULL
        OR requested_clock_out IS NOT NULL
        OR requested_break_start IS NOT NULL
        OR requested_break_end IS NOT NULL
      );
  END IF;

  -- reason length 1..500
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'attendance_correction_requests_reason_check'
      AND conrelid = 'public.attendance_correction_requests'::regclass
  ) THEN
    ALTER TABLE public.attendance_correction_requests
      ADD CONSTRAINT attendance_correction_requests_reason_check CHECK (
        char_length(reason) >= 1
        AND char_length(reason) <= 500
      );
  END IF;

  -- status ∈ {submitted, approved, rejected, withdrawn}
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'attendance_correction_requests_status_check'
      AND conrelid = 'public.attendance_correction_requests'::regclass
  ) THEN
    ALTER TABLE public.attendance_correction_requests
      ADD CONSTRAINT attendance_correction_requests_status_check CHECK (
        status = ANY (
          ARRAY[
            'submitted'::text,
            'approved'::text,
            'rejected'::text,
            'withdrawn'::text
          ]
        )
      );
  END IF;

  -- FK: company_id → companies(id) ON DELETE CASCADE
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'attendance_correction_requests_company_id_fkey'
      AND conrelid = 'public.attendance_correction_requests'::regclass
  ) THEN
    ALTER TABLE public.attendance_correction_requests
      ADD CONSTRAINT attendance_correction_requests_company_id_fkey
      FOREIGN KEY (company_id)
      REFERENCES public.companies(id)
      ON DELETE CASCADE;
  END IF;

  -- FK: attendance_record_id → attendance_records(id) ON DELETE CASCADE
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'attendance_correction_requests_attendance_record_id_fkey'
      AND conrelid = 'public.attendance_correction_requests'::regclass
  ) THEN
    ALTER TABLE public.attendance_correction_requests
      ADD CONSTRAINT attendance_correction_requests_attendance_record_id_fkey
      FOREIGN KEY (attendance_record_id)
      REFERENCES public.attendance_records(id)
      ON DELETE CASCADE;
  END IF;

  -- FK: worker_id → profiles(id) ON DELETE CASCADE
  -- NOTE: asymmetric with attendance_records.worker_id (→ auth.users).
  -- Production behavior — DO NOT normalize.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'attendance_correction_requests_worker_id_fkey'
      AND conrelid = 'public.attendance_correction_requests'::regclass
  ) THEN
    ALTER TABLE public.attendance_correction_requests
      ADD CONSTRAINT attendance_correction_requests_worker_id_fkey
      FOREIGN KEY (worker_id)
      REFERENCES public.profiles(id)
      ON DELETE CASCADE;
  END IF;

  -- FK: reviewed_by → profiles(id) ON DELETE SET NULL
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'attendance_correction_requests_reviewed_by_fkey'
      AND conrelid = 'public.attendance_correction_requests'::regclass
  ) THEN
    ALTER TABLE public.attendance_correction_requests
      ADD CONSTRAINT attendance_correction_requests_reviewed_by_fkey
      FOREIGN KEY (reviewed_by)
      REFERENCES public.profiles(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes (regular + composite + partial UNIQUE + DESC)
CREATE INDEX        IF NOT EXISTS acr_attendance_record_id_idx
  ON public.attendance_correction_requests(attendance_record_id);
CREATE INDEX        IF NOT EXISTS acr_company_id_idx
  ON public.attendance_correction_requests(company_id);
CREATE INDEX        IF NOT EXISTS acr_company_status_idx
  ON public.attendance_correction_requests(company_id, status);
CREATE INDEX        IF NOT EXISTS acr_created_at_idx
  ON public.attendance_correction_requests(created_at DESC);
CREATE INDEX        IF NOT EXISTS acr_status_idx
  ON public.attendance_correction_requests(status);
CREATE INDEX        IF NOT EXISTS acr_worker_id_idx
  ON public.attendance_correction_requests(worker_id);

-- Partial UNIQUE — at most one submitted correction per attendance record
CREATE UNIQUE INDEX IF NOT EXISTS acr_one_submitted_per_record
  ON public.attendance_correction_requests(attendance_record_id)
  WHERE status = 'submitted';

-- RLS
ALTER TABLE public.attendance_correction_requests ENABLE ROW LEVEL SECURITY;

-- Production uses `TO authenticated` role for correction_requests policies
-- (asymmetric vs attendance_records which uses `TO public`).
-- Reproduce exactly.
DROP POLICY IF EXISTS "acr: admin manage" ON public.attendance_correction_requests;
CREATE POLICY "acr: admin manage"
  ON public.attendance_correction_requests FOR ALL TO authenticated
  USING (public.is_admin_of(company_id))
  WITH CHECK (public.is_admin_of(company_id));

DROP POLICY IF EXISTS "acr: worker insert own" ON public.attendance_correction_requests;
CREATE POLICY "acr: worker insert own"
  ON public.attendance_correction_requests FOR INSERT TO authenticated
  WITH CHECK (worker_id = auth.uid());

DROP POLICY IF EXISTS "acr: worker select own" ON public.attendance_correction_requests;
CREATE POLICY "acr: worker select own"
  ON public.attendance_correction_requests FOR SELECT TO authenticated
  USING (worker_id = auth.uid());

DROP POLICY IF EXISTS "acr: worker withdraw own" ON public.attendance_correction_requests;
CREATE POLICY "acr: worker withdraw own"
  ON public.attendance_correction_requests FOR UPDATE TO authenticated
  USING (worker_id = auth.uid() AND status = 'submitted')
  WITH CHECK (worker_id = auth.uid() AND status = 'withdrawn');

-- Trigger: updated_at auto-refresh
DROP TRIGGER IF EXISTS acr_updated_at ON public.attendance_correction_requests;
CREATE TRIGGER acr_updated_at
  BEFORE UPDATE ON public.attendance_correction_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMIT;
