-- ============================================================
-- 043: v_invoice_revenue — invoices ベースの売上集計 View
-- ============================================================
-- 目的:
--   Dashboard の売上集計 source of truth を
--   project_billing + project_prices (v_project_revenue) から
--   invoices + projects (v_invoice_revenue) へ切り替える。
--
-- 対象:
--   invoice_type = 'invoice' のみ（quote は除外）
--   status NOT IN ('draft','cancelled')（未確定・取消済みを除外）
--
-- 除外しないもの:
--   issued / sent / awaiting_payment / overdue / paid
--   → いずれも確定した請求であり売上として計上する
--
-- Security:
--   このViewは RLS を持たない（既存 v_project_revenue と同じ方針）。
--   service_role クライアントで使用し、
--   API 側で必ず company_id フィルターを適用すること。
--
-- 既存テーブル変更: なし
-- 既存 View 変更:   なし（v_project_revenue は削除しない）
-- ============================================================

CREATE OR REPLACE VIEW public.v_invoice_revenue AS
SELECT
  i.id                                          AS invoice_id,
  i.company_id,
  i.project_id,
  p.project_type,
  i.client_id,
  i.issue_date,
  i.due_date,
  i.billing_period_from,
  i.billing_period_to,
  i.period_month,
  i.status,
  i.subtotal,
  i.tax_amount,
  i.total_amount,
  i.paid_amount,
  (i.total_amount - i.paid_amount)              AS unpaid_amount
FROM public.invoices i
JOIN public.projects p ON p.id = i.project_id
WHERE
  i.invoice_type = 'invoice'
  AND i.status NOT IN ('draft', 'cancelled');
