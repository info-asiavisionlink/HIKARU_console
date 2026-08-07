-- ============================================================
-- HIKARU: 単発・定期案件向け新ステータス追加
-- ============================================================

ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'scheduled_confirmed';
ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'scheduled_unconfirmed';
ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'reclean_requested';
ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'billing_pending';
ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'reclean_scheduled_confirmed';
ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'reclean_scheduled_unconfirmed';
