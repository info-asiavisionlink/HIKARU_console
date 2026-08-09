# HIKARU 全体アーキテクチャ設計書
**作成日**: 2026-08-09  
**対象**: Phase 1〜10 新機能実装前の全体設計  
**方針**: 既存DBを破壊しない / 清掃会社の業務OS として一貫したデータ基盤

---

## 目次

1. [システム全体像](#1-システム全体像)
2. [既存DBスキーマサマリ](#2-既存dbスキーマサマリ)
3. [業務データフロー](#3-業務データフロー)
4. [新機能DBテーブル設計](#4-新機能dbテーブル設計)
5. [ER図（テキスト形式）](#5-er図テキスト形式)
6. [権限設計（RLS）](#6-権限設計rls)
7. [API設計](#7-api設計)
8. [通知フロー](#8-通知フロー)
9. [承認フロー](#9-承認フロー)
10. [PDF生成フロー](#10-pdf生成フロー)
11. [会計連携設計](#11-会計連携設計)
12. [環境変数設計](#12-環境変数設計)
13. [実装フェーズ計画](#13-実装フェーズ計画)
14. [各システムの責務](#14-各システムの責務)

---

## 1. システム全体像

```
┌─────────────────────────────────────────────────────────────┐
│                    HIKARU 業務OS                             │
├────────────┬────────────┬────────────┬───────────────────────┤
│ CONSOLE    │ System     │ Partner    │ Client Portal         │
│ (管理者)   │ (従業員)   │ (協力業者) │ (顧客)                │
│ Next.js    │ Next.js    │ Next.js    │ Next.js               │
├────────────┴────────────┴────────────┴───────────────────────┤
│              Supabase (PostgreSQL + Auth + Storage)          │
│              ← 唯一のデータ基盤、RLSで権限強制 →            │
├──────────────────────────────────────────────────────────────┤
│ External Services                                            │
│ OpenAI API │ LINE API │ PDF生成 │ freee/MF API(将来)         │
└──────────────────────────────────────────────────────────────┘
```

### テナント設計
- `companies` がテナント単位
- 全テーブルに `company_id` を持ち、RLS でテナント分離を強制
- マルチテナント対応（複数の清掃会社が同一インフラを共有可能）

---

## 2. 既存DBスキーマサマリ

### コアテーブル（変更禁止）

| テーブル | 説明 | 主キー |
|---------|------|--------|
| `companies` | テナント（清掃会社） | UUID |
| `profiles` | 全ユーザー (admin/worker/client) | UUID→auth.users |
| `employees` | 従業員マスタ | UUID |
| `partners` | 協力業者マスタ | UUID |
| `project_assignments` | 案件担当者（employee/partner） | UUID |
| `clients` | 顧客企業 | UUID |
| `stores` | 店舗 | UUID |
| `projects` | 案件 (spot/recurring/hotel) | UUID |
| `project_billing` | 案件請求情報 | project_id (1:1) |
| `project_prices` | 案件単価 | UUID |
| `jobs` | 作業セッション | UUID |
| `photos` | 作業写真 | UUID |
| `photo_spots` | 撮影箇所定義 | UUID |
| `ai_evaluations` | AI品質評価 | UUID |
| `reports` | 報告書 | UUID |
| `manuals` | マニュアル | UUID |
| `client_portal_accounts` | 顧客ポータルアカウント | UUID |
| `client_project_permissions` | 案件閲覧権限 | UUID |
| `client_notifications` | 顧客通知 | UUID |

### 既存Enum
- `user_role`: admin / worker / client
- `project_status`: active / paused / completed / cancelled
- `project_type`: spot / recurring / hotel
- `billing_status`: unbilled / billed / awaiting_payment / paid / on_hold / cancelled
- `employee_status`: active / on_leave / resigned / suspended / deleted
- `partner_status`: active / suspended / terminated / deleted
- `cycle_type`: daily / weekly / monthly / biweekly / nth_weekday / custom
- `manual_type`: pdf / image / video / text / faq / note

---

## 3. 業務データフロー

### A. 受注〜入金フロー（顧客起点）

```
顧客
 │
 ▼
clients（顧客登録）
 │
 ▼
projects（案件登録: spot/recurring/hotel）
 │  ├─ project_prices（契約金額）
 │  └─ project_billing（請求情報）
 │
 ▼
[NEW] shifts（シフト配置: 誰を/いつ/どこに）
 │
 ▼
jobs（作業セッション開始）
 │  ├─ photos（作業写真）
 │  └─ chat_messages（作業チャット）
 │
 ▼
ai_evaluations（AI品質評価）
 │
 ▼
reports（報告書生成）
 │
 ▼
[NEW] satisfaction_surveys（顧客満足度評価）※顧客ポータルから
 │
 ▼
[NEW] invoices（請求書/見積書PDF生成）
 │  └─ invoice_items（明細）
 │
 ▼
project_billing.actual_payment_date 更新（入金確認）
 │
 ▼
[NEW] accounting_exports（会計ソフト連携データ）
```

### B. 従業員側フロー（給与起点）

```
employees（従業員マスタ）
 │
 ▼
[NEW] shifts（シフト確定）← CONSOLEから管理者が作成
 │
 ▼
jobs（実際の作業記録）← Systemアプリから
 │
 ▼
[NEW] expense_claims（経費申請）← Systemアプリから
 │  └─ expense_items（経費明細 + 領収書写真）
 │
 ▼
expense_claims.status = 'approved'（管理者承認）
 │
 ▼
給与計算用データ（shifts + jobs + expense_claims を集計）
 ※ 将来的に会計ソフト連携
```

---

## 4. 新機能DBテーブル設計

### Phase 1: シフト管理

```sql
-- シフト本体
CREATE TABLE public.shifts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id      UUID        NOT NULL REFERENCES public.projects(id)  ON DELETE CASCADE,

  -- 担当者: employee または partner のどちらか
  assignee_type   TEXT        NOT NULL CHECK (assignee_type IN ('employee', 'partner')),
  employee_id     UUID        REFERENCES public.employees(id) ON DELETE SET NULL,
  partner_id      UUID        REFERENCES public.partners(id)  ON DELETE SET NULL,
  -- ログインユーザーとの紐付け（通知・System画面表示用）
  profile_id      UUID        REFERENCES public.profiles(id)  ON DELETE SET NULL,

  -- 日時
  shift_date      DATE        NOT NULL,
  start_time      TIME        NOT NULL,
  end_time        TIME        NOT NULL,

  -- ステータス
  status          TEXT        NOT NULL DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled','confirmed','in_progress','completed','cancelled')),
  notes           TEXT,
  created_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT shifts_assignee_check
    CHECK (
      (assignee_type = 'employee' AND employee_id IS NOT NULL) OR
      (assignee_type = 'partner'  AND partner_id  IS NOT NULL)
    )
);

CREATE INDEX shifts_company_id_idx   ON public.shifts(company_id);
CREATE INDEX shifts_project_id_idx   ON public.shifts(project_id);
CREATE INDEX shifts_shift_date_idx   ON public.shifts(shift_date);
CREATE INDEX shifts_employee_id_idx  ON public.shifts(employee_id);
CREATE INDEX shifts_partner_id_idx   ON public.shifts(partner_id);
CREATE INDEX shifts_profile_id_idx   ON public.shifts(profile_id);
CREATE INDEX shifts_status_idx       ON public.shifts(status);
-- 日別・案件別・人別検索用複合インデックス
CREATE INDEX shifts_date_project_idx ON public.shifts(shift_date, project_id);
CREATE INDEX shifts_date_profile_idx ON public.shifts(shift_date, profile_id);
```

**RLS設計:**
- 管理者: 同一company_idの全シフトをCRUD
- 従業員/協力業者: 自分(profile_id)のシフトをSELECT
- 顧客: アクセス不可

---

### Phase 2: 経費申請・精算

```sql
-- 経費申請ヘッダー
CREATE TABLE public.expense_claims (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id     UUID        REFERENCES public.employees(id) ON DELETE SET NULL,
  profile_id      UUID        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  -- 申請期間（給与計算月と紐付ける）
  claim_month     DATE        NOT NULL, -- その月の1日を格納 (2026-08-01)
  -- 関連案件（任意）
  project_id      UUID        REFERENCES public.projects(id) ON DELETE SET NULL,
  -- ワークフロー
  status          TEXT        NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','submitted','approved','rejected','settled')),
  total_amount    NUMERIC(12,0) NOT NULL DEFAULT 0, -- 合計金額（自動集計）
  approved_by     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  settled_at      TIMESTAMPTZ,
  reject_reason   TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX expense_claims_company_id_idx  ON public.expense_claims(company_id);
CREATE INDEX expense_claims_profile_id_idx  ON public.expense_claims(profile_id);
CREATE INDEX expense_claims_status_idx      ON public.expense_claims(status);
CREATE INDEX expense_claims_claim_month_idx ON public.expense_claims(claim_month);

-- 経費明細
CREATE TABLE public.expense_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id        UUID        NOT NULL REFERENCES public.expense_claims(id) ON DELETE CASCADE,
  category        TEXT        NOT NULL
                  CHECK (category IN ('transport','parking','supplies','consumables','other')),
  description     TEXT        NOT NULL, -- 内容説明
  amount          NUMERIC(12,0) NOT NULL,
  receipt_url     TEXT,        -- Supabase Storage URL
  receipt_path    TEXT,        -- Storage path
  expense_date    DATE        NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX expense_items_claim_id_idx ON public.expense_items(claim_id);
```

**ワークフロー:**
```
draft（下書き）
  → submitted（申請済）※ 従業員が送信
  → approved（承認）  ※ 管理者が承認 → LINE通知
  → rejected（却下）  ※ 管理者が却下 → LINE通知 + reject_reason
  → settled（精算済） ※ 管理者が精算完了マーク
```

**RLS設計:**
- 従業員: 自分のclaim CRUD（ただしsubmitted以降は更新不可）
- 管理者: 同一company_idの全claim READ + status更新

---

### Phase 3: 見積書・請求書

```sql
-- 見積書・請求書ヘッダー（invoice_type で区別）
CREATE TABLE public.invoices (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id        UUID        REFERENCES public.projects(id) ON DELETE SET NULL,
  client_id         UUID        NOT NULL REFERENCES public.clients(id)  ON DELETE RESTRICT,

  invoice_type      TEXT        NOT NULL CHECK (invoice_type IN ('quote','invoice')),
  invoice_number    TEXT        NOT NULL, -- QUO-2026-001 / INV-2026-001
  issue_date        DATE        NOT NULL DEFAULT CURRENT_DATE,
  due_date          DATE,       -- 支払期限

  -- 金額
  subtotal          NUMERIC(14,0) NOT NULL DEFAULT 0, -- 税抜合計
  tax_rate          NUMERIC(5,4)  NOT NULL DEFAULT 0.10,
  tax_amount        NUMERIC(14,0) NOT NULL DEFAULT 0,
  total_amount      NUMERIC(14,0) NOT NULL DEFAULT 0, -- 税込合計

  -- ステータス
  status            TEXT        NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','sent','accepted','rejected','paid','cancelled')),

  -- PDF
  pdf_url           TEXT,       -- 生成済みPDF URL
  pdf_generated_at  TIMESTAMPTZ,

  -- 顧客ポータル公開
  published_to_portal BOOLEAN   NOT NULL DEFAULT false,
  published_at      TIMESTAMPTZ,

  notes             TEXT,
  created_by        UUID        REFERENCES public.profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (company_id, invoice_number)
);

CREATE INDEX invoices_company_id_idx  ON public.invoices(company_id);
CREATE INDEX invoices_project_id_idx  ON public.invoices(project_id);
CREATE INDEX invoices_client_id_idx   ON public.invoices(client_id);
CREATE INDEX invoices_status_idx      ON public.invoices(status);
CREATE INDEX invoices_issue_date_idx  ON public.invoices(issue_date DESC);

-- 明細行
CREATE TABLE public.invoice_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID        NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  order_num       INTEGER     NOT NULL DEFAULT 0,
  description     TEXT        NOT NULL,
  quantity        NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit            TEXT,        -- 式/回/時間/㎡ etc.
  unit_price      NUMERIC(14,0) NOT NULL DEFAULT 0,
  amount          NUMERIC(14,0) NOT NULL DEFAULT 0, -- quantity × unit_price
  tax_rate        NUMERIC(5,4)  NOT NULL DEFAULT 0.10,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX invoice_items_invoice_id_idx ON public.invoice_items(invoice_id);
```

**既存テーブルとの連携:**
- `project_prices` → invoice_items に自動展開
- `project_billing.quote_number` → invoices.invoice_number と連動
- `clients` → 顧客情報を請求書に埋め込み

**RLS設計:**
- 管理者: 同一company_idの全invoice CRUD
- 顧客: published_to_portal=trueかつ自分の案件のinvoice READ

---

### Phase 4: LINE通知連携

```sql
-- LINE通知送信ログ
CREATE TABLE public.line_notification_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type      TEXT        NOT NULL,
  -- 例: shift_confirmed / job_assigned / expense_approved /
  --     expense_rejected / report_ready / invoice_issued / salary_confirmed
  message         TEXT        NOT NULL,
  line_user_id    TEXT,       -- LINE User ID（ENVまたはprofilesに保存）
  status          TEXT        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','sent','failed')),
  error_message   TEXT,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX line_logs_company_id_idx ON public.line_notification_logs(company_id);
CREATE INDEX line_logs_status_idx     ON public.line_notification_logs(status);
CREATE INDEX line_logs_created_at_idx ON public.line_notification_logs(created_at DESC);

-- profiles テーブルに LINE User ID を追加するマイグレーション（separate migration）
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS line_user_id TEXT;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS line_notify_enabled BOOLEAN DEFAULT true;
```

**ENV管理:**
```
LINE_CHANNEL_ACCESS_TOKEN=xxx  # サーバーサイドのみ
LINE_CHANNEL_SECRET=xxx        # サーバーサイドのみ
```

---

### Phase 5: 顧客満足度

```sql
-- 顧客満足度アンケート
CREATE TABLE public.satisfaction_surveys (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  job_id            UUID        NOT NULL REFERENCES public.jobs(id)    ON DELETE CASCADE,
  project_id        UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  portal_account_id UUID        NOT NULL REFERENCES public.client_portal_accounts(id),

  -- 評価
  rating            SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment           TEXT,

  -- 詳細評価（オプション）
  rating_quality    SMALLINT    CHECK (rating_quality    BETWEEN 1 AND 5),
  rating_speed      SMALLINT    CHECK (rating_speed      BETWEEN 1 AND 5),
  rating_attitude   SMALLINT    CHECK (rating_attitude   BETWEEN 1 AND 5),

  -- AI品質との統合集計用
  ai_score          SMALLINT,   -- ai_evaluations.score から複製（集計効率化）

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 1ジョブにつき1回のみ
  UNIQUE (job_id, portal_account_id)
);

CREATE INDEX surveys_company_id_idx  ON public.satisfaction_surveys(company_id);
CREATE INDEX surveys_project_id_idx  ON public.satisfaction_surveys(project_id);
CREATE INDEX surveys_rating_idx      ON public.satisfaction_surveys(rating);

-- 統合スコアView
CREATE OR REPLACE VIEW public.v_quality_scores AS
SELECT
  j.id          AS job_id,
  j.project_id,
  j.company_id,
  AVG(ae.score) AS ai_score_avg,
  ss.rating     AS customer_rating,
  ss.comment    AS customer_comment,
  (AVG(ae.score) * 0.6 + ss.rating * 20 * 0.4)::SMALLINT AS combined_score
  -- AIスコア(0-100)の60% + 顧客評価(1-5→0-100換算)の40%
FROM public.jobs j
LEFT JOIN public.ai_evaluations ae ON ae.job_id = j.id
LEFT JOIN public.satisfaction_surveys ss ON ss.job_id = j.id
GROUP BY j.id, j.project_id, j.company_id, ss.rating, ss.comment;
```

---

### Phase 6: 備品・消耗品管理

```sql
-- 在庫マスタ
CREATE TABLE public.inventory_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  category        TEXT        NOT NULL DEFAULT 'supplies'
                  CHECK (category IN ('equipment','supplies','consumables','other')),
  unit            TEXT        NOT NULL DEFAULT '個', -- 個/本/袋/L etc.
  unit_price      NUMERIC(12,0),
  stock_quantity  NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_stock       NUMERIC(10,2) NOT NULL DEFAULT 0,  -- 最低在庫数
  storage_location TEXT,     -- 保管場所
  supplier_name   TEXT,      -- 仕入先
  supplier_contact TEXT,
  barcode         TEXT,
  notes           TEXT,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX inventory_company_id_idx ON public.inventory_items(company_id);
CREATE INDEX inventory_category_idx   ON public.inventory_items(category);
CREATE INDEX inventory_low_stock_idx  ON public.inventory_items(company_id)
  WHERE stock_quantity <= min_stock AND is_active = true; -- 在庫不足フィルタ

-- 入出庫記録
CREATE TABLE public.inventory_transactions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         UUID        NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  company_id      UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  transaction_type TEXT       NOT NULL CHECK (transaction_type IN ('in','out','adjustment')),
  quantity        NUMERIC(10,2) NOT NULL,
  -- 出庫先（案件・シフトと紐付け可能）
  project_id      UUID        REFERENCES public.projects(id) ON DELETE SET NULL,
  shift_id        UUID        REFERENCES public.shifts(id)   ON DELETE SET NULL,
  reason          TEXT,
  performed_by    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  performed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX inv_tx_item_id_idx    ON public.inventory_transactions(item_id);
CREATE INDEX inv_tx_company_id_idx ON public.inventory_transactions(company_id);
CREATE INDEX inv_tx_performed_at_idx ON public.inventory_transactions(performed_at DESC);
```

**在庫不足通知:** DBトリガーまたはAPI側でチェックし、LINE通知を発火

---

### Phase 7: 電子契約

```sql
-- 契約書管理
CREATE TABLE public.contracts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  -- 契約相手（client または partner のどちらか）
  counterparty_type TEXT      NOT NULL CHECK (counterparty_type IN ('client','partner')),
  client_id       UUID        REFERENCES public.clients(id)  ON DELETE SET NULL,
  partner_id      UUID        REFERENCES public.partners(id) ON DELETE SET NULL,
  -- 関連案件（任意）
  project_id      UUID        REFERENCES public.projects(id) ON DELETE SET NULL,

  contract_type   TEXT        NOT NULL DEFAULT 'service'
                  CHECK (contract_type IN ('service','nda','subcontract','other')),
  title           TEXT        NOT NULL,
  contract_number TEXT,
  start_date      DATE,
  end_date        DATE,
  renewal_date    DATE,       -- 更新日
  auto_renewal    BOOLEAN     NOT NULL DEFAULT false,

  -- ステータス
  status          TEXT        NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','sent','reviewing','signed','active','expired','terminated')),

  -- ファイル
  file_url        TEXT,       -- 契約書PDF
  file_path       TEXT,

  -- 電子署名（将来: CloudSign/DocuSign等との連携）
  sign_provider   TEXT,       -- 'cloudsign'/'docusign'/'manual' etc.
  sign_request_id TEXT,       -- 外部サービスのリクエストID
  signed_at       TIMESTAMPTZ,

  notes           TEXT,
  created_by      UUID        REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX contracts_company_id_idx  ON public.contracts(company_id);
CREATE INDEX contracts_client_id_idx   ON public.contracts(client_id);
CREATE INDEX contracts_partner_id_idx  ON public.contracts(partner_id);
CREATE INDEX contracts_status_idx      ON public.contracts(status);
CREATE INDEX contracts_end_date_idx    ON public.contracts(end_date); -- 期限管理用
```

---

### Phase 8: 会計ソフト連携

```sql
-- 会計エクスポート履歴
CREATE TABLE public.accounting_exports (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  export_type     TEXT        NOT NULL
                  CHECK (export_type IN ('revenue','invoice','payment','expense','all')),
  format          TEXT        NOT NULL CHECK (format IN ('csv','excel','freee','moneyforward')),
  period_from     DATE        NOT NULL,
  period_to       DATE        NOT NULL,
  file_url        TEXT,       -- 生成ファイルURL
  record_count    INTEGER,
  total_amount    NUMERIC(14,0),
  status          TEXT        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','processing','completed','failed')),
  error_message   TEXT,
  created_by      UUID        REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX accounting_exports_company_id_idx ON public.accounting_exports(company_id);
```

**エクスポート用View（既存データ活用）:**
```sql
-- 売上・請求データ（invoices + projects + clients）
CREATE VIEW public.v_accounting_sales AS ...;

-- 経費データ（expense_claims + expense_items）
CREATE VIEW public.v_accounting_expenses AS ...;

-- 入金データ（project_billing.actual_payment_date）
CREATE VIEW public.v_accounting_payments AS ...;
```

---

### Phase 9: 車両・機材管理（将来）

```sql
-- 車両マスタ
CREATE TABLE public.vehicles (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,   -- 車両名/ニックネーム
  plate_number    TEXT,                   -- ナンバープレート
  vehicle_type    TEXT,                   -- 軽バン/ワゴン etc.
  owner_type      TEXT        CHECK (owner_type IN ('company','employee','lease')),
  employee_id     UUID        REFERENCES public.employees(id) ON DELETE SET NULL,
  inspection_date DATE,       -- 車検
  insurance_date  DATE,       -- 保険
  notes           TEXT,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 機材マスタ（inventory_items と統合も可能）
CREATE TABLE public.equipment (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  serial_number   TEXT,
  purchase_date   DATE,
  warranty_date   DATE,
  last_inspection_date DATE,
  next_inspection_date DATE,
  assigned_employee_id UUID   REFERENCES public.employees(id) ON DELETE SET NULL,
  notes           TEXT,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### Phase 10: 資格・保険期限管理

```sql
-- 資格・保険記録（employees / partners 両対応）
CREATE TABLE public.qualifications (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  -- 対象者（employee または partner）
  target_type     TEXT        NOT NULL CHECK (target_type IN ('employee','partner')),
  employee_id     UUID        REFERENCES public.employees(id) ON DELETE CASCADE,
  partner_id      UUID        REFERENCES public.partners(id)  ON DELETE CASCADE,

  record_type     TEXT        NOT NULL CHECK (record_type IN ('qualification','insurance','license','other')),
  name            TEXT        NOT NULL,   -- 資格名・保険名
  issued_by       TEXT,                   -- 発行機関
  issue_date      DATE,
  expiry_date     DATE,       -- 有効期限 ← 期限通知の起点
  -- 通知設定
  notify_days_before INTEGER NOT NULL DEFAULT 30, -- 期限N日前に通知
  last_notified_at TIMESTAMPTZ,

  -- ファイル
  file_url        TEXT,       -- 証明書PDF/画像
  file_path       TEXT,

  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT qualifications_target_check
    CHECK (
      (target_type = 'employee' AND employee_id IS NOT NULL) OR
      (target_type = 'partner'  AND partner_id  IS NOT NULL)
    )
);

CREATE INDEX qualifications_company_id_idx ON public.qualifications(company_id);
CREATE INDEX qualifications_expiry_idx     ON public.qualifications(expiry_date);
CREATE INDEX qualifications_employee_id_idx ON public.qualifications(employee_id);
CREATE INDEX qualifications_partner_id_idx  ON public.qualifications(partner_id);
```

---

## 5. ER図（テキスト形式）

```
companies ──┬── profiles ─────────────── client_portal_accounts
            │      │                           │
            │      ├── employees               ├── client_project_permissions
            │      └── partners                └── client_notifications
            │
            ├── clients ──── stores
            │      │
            │      └── invoices ──── invoice_items
            │
            ├── projects ───────────────────────────────────┐
            │      │                                         │
            │      ├── project_billing                       │
            │      ├── project_prices                        │
            │      ├── spot_project_details                  │
            │      ├── recurring_project_details             │
            │      ├── hotel_project_details                 │
            │      ├── photo_spots                           │
            │      ├── manuals                               │
            │      ├── project_assignments                   │
            │      ├── [NEW] shifts ─── employees/partners   │
            │      └── jobs ──────────────────────────────── ┘
            │             │
            │             ├── photos
            │             ├── ai_evaluations
            │             ├── reports
            │             ├── chat_messages
            │             └── [NEW] satisfaction_surveys
            │
            ├── [NEW] expense_claims ── expense_items
            ├── [NEW] invoices ──────── invoice_items
            ├── [NEW] inventory_items ─ inventory_transactions
            ├── [NEW] contracts
            ├── [NEW] qualifications
            ├── [NEW] vehicles
            ├── [NEW] equipment
            ├── [NEW] line_notification_logs
            └── [NEW] accounting_exports
```

---

## 6. 権限設計（RLS）

### ロール定義

| ロール | profiles.role | 操作端末 | 説明 |
|--------|-------------|---------|------|
| 管理者 | `admin` | HIKARU-CONSOLE | 全データへの読み書き |
| 従業員 | `worker` | HIKARU-System | 自分担当のデータのみ |
| 協力業者 | `worker`※ | HIKARU-Partner | 自分担当のデータのみ |
| 顧客 | `client` | HIKARU-Client | 公開されたデータのみ |

※ 協力業者は `profiles.role='worker'` + `profiles.entity_type='partner'` で区別

### 新機能テーブルRLS方針

| テーブル | admin | worker(employee) | worker(partner) | client |
|---------|-------|---------|---------|--------|
| shifts | CRUD | SELECT (自分) | SELECT (自分) | ✗ |
| expense_claims | READ+UPDATE(status) | CRUD (自分) | CRUD (自分) | ✗ |
| expense_items | READ | CRUD (自クレーム) | CRUD (自クレーム) | ✗ |
| invoices | CRUD | ✗ | ✗ | SELECT (公開+自案件) |
| invoice_items | CRUD | ✗ | ✗ | SELECT (公開invoice) |
| satisfaction_surveys | READ | ✗ | ✗ | CRUD (自分) |
| inventory_items | CRUD | READ | READ | ✗ |
| inventory_transactions | CRUD | INSERT(出庫) | ✗ | ✗ |
| contracts | CRUD | ✗ | READ(自分) | ✗ |
| qualifications | CRUD | READ(自分) | READ(自分) | ✗ |
| line_notification_logs | READ | ✗ | ✗ | ✗ |
| accounting_exports | CRUD | ✗ | ✗ | ✗ |
| vehicles | CRUD | READ | ✗ | ✗ |
| equipment | CRUD | READ | ✗ | ✗ |

**基本原則:**
- RLS は必ず有効化。UIで隠すだけの権限制御は禁止
- 全テーブルに `company_id` を持ちテナント分離
- 管理者は `is_admin_of(company_id)` 関数で判定
- 従業員は自分の `profile_id` または `employee_id` で判定

---

## 7. API設計

### 新規APIルート（Next.js App Router）

```
HIKARU-CONSOLE (管理者)
├── /api/shifts           GET/POST/PUT/DELETE
├── /api/shifts/[id]      GET/PUT/DELETE
├── /api/expenses         GET (一覧+承認操作)
├── /api/expenses/[id]/approve    POST
├── /api/expenses/[id]/reject     POST
├── /api/expenses/[id]/settle     POST
├── /api/invoices         GET/POST
├── /api/invoices/[id]    GET/PUT/DELETE
├── /api/invoices/[id]/pdf        POST (PDF生成)
├── /api/invoices/[id]/publish    POST (ポータル公開)
├── /api/inventory        GET/POST
├── /api/inventory/[id]   GET/PUT/DELETE
├── /api/inventory/[id]/transactions  GET/POST
├── /api/contracts        GET/POST
├── /api/contracts/[id]   GET/PUT
├── /api/qualifications   GET/POST
├── /api/accounting/export POST (CSV/Excel生成)
└── /api/line/send        POST (LINE送信)

HIKARU-System (従業員)
├── /api/shifts/my        GET (自分のシフト)
├── /api/expenses         GET/POST (自分の経費)
├── /api/expenses/[id]    GET/PUT/DELETE (draftのみ)
├── /api/expenses/[id]/submit POST
└── /api/upload           POST (既存: 領収書アップロード)

HIKARU-Client (顧客ポータル)
├── /api/invoices/my      GET (自分の請求書)
└── /api/surveys          POST (満足度投稿)
```

---

## 8. 通知フロー

### LINE通知トリガー一覧

```
イベント                  → 通知先          → メッセージ例
──────────────────────────────────────────────────────────────
shifts.status='confirmed' → 従業員/協力業者  「シフト確定: 8/15 ○○ビル 9:00-17:00」
shifts 新規作成           → 従業員/協力業者  「案件割り当て: ○○清掃 明日9時〜」
jobs 開始1時間前          → 従業員          「作業リマインダー: 1時間後 ○○ビル」
jobs.status='completed'   → 管理者          「作業完了: ○○ 報告書確認してください」
expense_claims='approved' → 従業員          「経費申請 承認されました（¥○○）」
expense_claims='rejected' → 従業員          「経費申請 却下: ○○理由」
reports 生成完了          → 顧客ポータル    「報告書が届きました（メール or LINE）」
invoices.status='sent'    → 顧客            「請求書 #INV-xxx が届きました」
inventory low_stock       → 管理者          「在庫不足: ○○ 残り○個（最低○個）」
qualifications 期限30日前 → 管理者          「資格期限: 田中さんの○○ 30日後に期限」
contracts 期限60日前      → 管理者          「契約更新: ○○社との契約 60日後に終了」
```

### 通知実装方式

```
イベント発生（DB更新 or APIコール）
  ↓
Next.js API Route（/api/line/send）
  ↓  LINE_CHANNEL_ACCESS_TOKEN（ENV）
LINE Messaging API
  ↓
ユーザーのLINEアプリ

+ line_notification_logs にログ記録
```

**Phase 4実装前の準備:**
- `profiles` テーブルに `line_user_id` カラム追加（Migration 026）
- LINE Developersでチャンネル作成
- ENVに `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_CHANNEL_SECRET` 追加

---

## 9. 承認フロー

### 経費申請承認フロー

```
[従業員 - HIKARU-System]
  expense_claims.status = 'draft'（下書き保存）
    ↓ 「申請する」ボタン
  expense_claims.status = 'submitted'
    ↓ LINE通知 → 管理者
    
[管理者 - HIKARU-CONSOLE]
  一覧で「submitted」を確認
    ↓ 明細・領収書確認
  「承認」→ status = 'approved'  → LINE通知 → 従業員
  「却下」→ status = 'rejected'  → LINE通知 → 従業員（reject_reason付き）
    ↓
  「精算済み」→ status = 'settled'（給与計算後にマーク）
```

### 見積書→請求書フロー

```
[管理者 - HIKARU-CONSOLE]
  案件から「見積書作成」
    → invoice_type = 'quote'
    → project_prices から自動展開
    ↓
  「PDF生成」→ pdf_url 生成
  「顧客へ送付」→ status = 'sent' + LINE/メール通知
    ↓
  顧客確認後「請求書に変換」
    → invoice_type = 'invoice'
    → invoice_number = 'INV-2026-001'
    ↓
  「入金確認」→ project_billing.actual_payment_date 更新
               + billing_status = 'paid'
```

---

## 10. PDF生成フロー

### 技術選定

**推奨: `@react-pdf/renderer`（サーバーサイド）**

```
管理者が「PDF生成」ボタンクリック
  ↓
POST /api/invoices/[id]/pdf
  ↓
サーバーサイドでデータ取得
  clients / projects / invoice_items / companies
  ↓
@react-pdf/renderer でPDF生成（メモリ上）
  ↓
Supabase Storage に保存
  documents/invoices/INV-2026-001.pdf
  ↓
invoices.pdf_url を更新
  ↓
レスポンスでURLを返す → ダウンロード or プレビュー
```

### PDF含有情報

```
┌─────────────────────────────────────┐
│  [会社ロゴ]        見積書/請求書     │
│                   No. INV-2026-001   │
│                   発行日: 2026-08-09 │
├─────────────────┬───────────────────┤
│ 請求先:          │ 請求元:           │
│ ○○株式会社      │ HIKARU清掃㈱      │
│ 担当: 田中様     │ TEL: 03-xxxx     │
├─────────────────┴───────────────────┤
│ 案件名: ○○ビル定期清掃              │
│ 作業期間: 2026-08-01〜2026-08-31    │
├────────────┬──────┬─────┬──────────┤
│ 内容        │ 数量  │単価  │ 金額     │
├────────────┼──────┼─────┼──────────┤
│ 定期清掃    │  1式  │100,000│ 100,000 │
│ 消耗品費    │  1式  │  5,000│   5,000 │
├────────────┴──────┴─────┼──────────┤
│                  税抜合計 │ 105,000  │
│                  消費税10%│  10,500  │
│                  税込合計 │ 115,500  │
├──────────────────────────┴──────────┤
│ お支払期限: 2026-09-30               │
│ 振込先: ○○銀行 ○○支店 普通 1234567 │
└─────────────────────────────────────┘
```

---

## 11. 会計連携設計

### CSV出力フォーマット（freee/マネーフォワード対応）

**売上CSVカラム:**
```
取引日, 取引先, 勘定科目, 税区分, 金額(税抜), 消費税, 金額(税込), 摘要, 請求書番号
```

**経費CSVカラム:**
```
取引日, 支払者, 勘定科目, 税区分, 金額(税抜), 消費税, 摘要, 領収書有無
```

**勘定科目マッピング:**
```
expense_items.category → 勘定科目
'transport'   → 旅費交通費
'parking'     → 旅費交通費
'supplies'    → 消耗品費
'consumables' → 消耗品費
'other'       → 雑費
```

### 将来のAPI連携設計

```
Phase 8: CSV/Excel出力（実装）
  ↓
Phase ??: freee API連携
  freee_company_id: ENV管理
  POST /api/accounting/sync/freee → freee API

Phase ??: マネーフォワード連携
  MONEYFORWARD_CLIENT_ID: ENV管理
  POST /api/accounting/sync/moneyforward
```

---

## 12. 環境変数設計

### 新規追加が必要なENV

```bash
# .env.local（ローカル開発用）

# === 既存 ===
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=

# === Phase 4: LINE通知 ===
LINE_CHANNEL_ACCESS_TOKEN=       # LINEチャンネルのアクセストークン
LINE_CHANNEL_SECRET=             # LINEチャンネルのシークレット

# === Phase 3: PDF生成 ===
# （追加ENVなし: @react-pdf/rendererはサーバーサイドで動作）

# === Phase 7: 電子契約 (将来) ===
# CLOUDSIGN_API_KEY=
# DOCUSIGN_INTEGRATION_KEY=

# === Phase 8: 会計連携 (将来) ===
# FREEE_CLIENT_ID=
# FREEE_CLIENT_SECRET=
# MONEYFORWARD_CLIENT_ID=
# MONEYFORWARD_CLIENT_SECRET=
```

### .env.example 更新内容

```bash
# LINE Messaging API
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
LINE_CHANNEL_SECRET=your_line_channel_secret

# 電子契約 (将来実装)
# CLOUDSIGN_API_KEY=
# DOCUSIGN_INTEGRATION_KEY=

# 会計ソフト連携 (将来実装)
# FREEE_CLIENT_ID=
# FREEE_CLIENT_SECRET=
# MONEYFORWARD_CLIENT_ID=
# MONEYFORWARD_CLIENT_SECRET=
```

**重要:**
- 上記ENVキーは絶対に `.env.local` にのみ記述し Git にコミットしない
- `.gitignore` で `.env.local` が除外されていることを確認済み
- Vercel ダッシュボードの Environment Variables で管理

---

## 13. 実装フェーズ計画

### 依存関係から見た最適順序

指定順序から一部変更あり。理由は依存関係と実用性。

```
Phase 1: シフト管理（最優先）
  理由: jobs・project_assignments と直結。他の全機能の前提となる
  Migration: 026_shifts.sql
  
Phase 2: 経費申請・精算
  理由: shiftsと連動。給与計算の基盤データ
  Migration: 027_expense_claims.sql
  
Phase 3: 見積書・請求書PDF
  理由: project_billing・project_prices が既存で完備。即実用化可能
  Migration: 028_invoices.sql
  依存: @react-pdf/renderer パッケージ追加
  
Phase 4: LINE通知
  理由: Phase 1〜3 の承認通知を全部まとめて実装
  Migration: 029_profiles_line.sql (line_user_id追加)
  依存: LINE_CHANNEL_ACCESS_TOKEN ENV設定
  
Phase 5: 顧客満足度
  理由: 顧客ポータルは既存。報告書完成後に自然な流れ
  Migration: 030_satisfaction_surveys.sql
  
Phase 6: 備品・消耗品
  理由: 独立機能。在庫不足LINE通知はPhase 4後に追加
  Migration: 031_inventory.sql
  
Phase 7: 電子契約
  理由: clients・partnersが既存。ファイル管理のみで実装可能
  Migration: 032_contracts.sql
  
Phase 8: 会計連携
  理由: invoices + expense_claims のデータが揃ってから
  Migration: 033_accounting_exports.sql
  
Phase 9: 車両・機材
  理由: 業務運営安定後に追加
  Migration: 034_vehicles_equipment.sql
  
Phase 10: 資格・保険期限
  理由: employeesとpartnersのデータ充実後に追加
  Migration: 035_qualifications.sql
```

---

## 14. 各システムの責務

### HIKARU-CONSOLE（管理者）
- シフト作成・編集・削除・確定
- 経費申請の承認・却下・精算
- 見積書・請求書の作成・PDF生成・送付
- 在庫管理（入出庫・在庫調整）
- 電子契約管理
- 会計データエクスポート
- 従業員・協力業者の資格期限管理
- LINE通知設定
- AI品質スコア + 顧客満足度の統合分析

### HIKARU-System（従業員）
- 自分のシフト確認
- 経費申請・領収書アップロード
- 作業記録・写真撮影・報告書
- 通知受信（シフト確定・経費承認結果）

### HIKARU-Partner（協力業者）
- 自分のシフト確認
- 作業記録（Systemと同じ操作性）
- 通知受信

### HIKARU-Client（顧客ポータル）
- 自社案件の報告書・写真閲覧
- AI品質評価結果確認
- 満足度アンケート入力
- 見積書・請求書の確認・ダウンロード
- 通知受信（報告書完成・請求書発行）

---

## 次のアクション

1. この設計書の内容を確認・合意
2. Phase 1「シフト管理」のMigration（026_shifts.sql）を実装
3. CONSOLE・System の UI 実装
4. 順次 Phase 2 以降へ

**実装前に必ず確認:**
- 既存DBとの整合性（特にcompany_id・profile_id参照）
- 既存RLSポリシーとの競合がないこと
- 新テーブルはすべて `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` を設定
