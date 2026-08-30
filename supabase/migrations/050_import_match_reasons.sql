-- ============================================================
-- 050: Add match_reasons to import_duplicate_candidates
--
-- 方針: ADDITIVE ONLY
--
-- Phase 5 Duplicate Engine はmatch_reasonsをメモリで計算・
-- APIレスポンスで返すが、DBには保存していなかった。
-- このMigrationでDB保存を可能にする。
--
-- match_reasons: Duplicate Engineが判定した一致理由コード。
--   例: ["email_exact", "phone_normalized", "name_normalized"]
--
-- NULL許容: Phase 5以前に作成されたcandidatesとの後方互換性。
-- ============================================================

ALTER TABLE public.import_duplicate_candidates
  ADD COLUMN IF NOT EXISTS match_reasons JSONB;

COMMENT ON COLUMN public.import_duplicate_candidates.match_reasons
  IS 'Array of match reason codes from the deterministic duplicate engine. e.g. ["email_exact","phone_normalized"]';
