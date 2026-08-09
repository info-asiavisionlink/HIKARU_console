# Phase 7: 電子契約・契約書管理 DB設計

**Migration**: `supabase/migrations/032_contracts.sql`  
**実装日**: 2026-08-09  

---

## テーブル構成

### `contracts` — 契約本体

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | UUID PK | |
| `company_id` | UUID FK→companies | テナント分離 |
| `counterparty_type` | TEXT | `client` / `partner` |
| `client_id` | UUID FK→clients | 顧客契約時 |
| `partner_id` | UUID FK→partners | 協力業者契約時 |
| `project_id` | UUID FK→projects | 関連案件（任意・将来多対多拡張可） |
| `title` | TEXT | 契約名 |
| `contract_number` | TEXT | 契約番号（任意） |
| `contract_type` | TEXT | service / subcontract / nda / other |
| `status` | TEXT | draft / sent / reviewing / signed / active / expired / terminated |
| `start_date` | DATE | 契約開始日 |
| `end_date` | DATE | 契約終了日 |
| `renewal_date` | DATE | 更新日 |
| `auto_renewal` | BOOLEAN | 自動更新フラグ（通知用、自動更新しない） |
| `published_to_portal` | BOOLEAN | 顧客ポータル公開フラグ |
| `published_at` | TIMESTAMPTZ | 公開日時 |
| `published_by` | UUID FK→profiles | 公開者 |
| `signed_at` | TIMESTAMPTZ | 締結日時 |
| `signed_by` | UUID FK→profiles | 締結者 |
| `sign_provider` | TEXT | manual / cloudsign / docusign / other |
| `sign_request_id` | TEXT | 外部電子署名サービスのリクエストID |
| `notes` | TEXT | 備考 |
| `internal_memo` | TEXT | 社内メモ（管理者のみ） |
| `created_by` | UUID FK→profiles | 作成者 |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | トリガー自動更新 |

### `contract_files` — ファイルバージョン管理

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | UUID PK | |
| `contract_id` | UUID FK→contracts | |
| `company_id` | UUID FK→companies | |
| `version` | INTEGER | バージョン番号（1始まり） |
| `file_name` | TEXT | ファイル名 |
| `storage_path` | TEXT | `{company_id}/{contract_id}/v{N}/{file_name}` |
| `mime_type` | TEXT | |
| `file_size` | INTEGER | バイト数 |
| `is_current` | BOOLEAN | 現在有効バージョン（1契約で1つのみtrue） |
| `uploaded_by` | UUID FK→profiles | |
| `created_at` | TIMESTAMPTZ | |

### `contract_events` — 監査ログ

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | UUID PK | |
| `contract_id` | UUID FK→contracts | |
| `company_id` | UUID FK→companies | |
| `actor_id` | UUID FK→profiles | 操作者 |
| `event_type` | TEXT | created / updated / status_changed / file_uploaded / file_replaced / published / signed / terminated など |
| `old_value` | JSONB | 変更前値 |
| `new_value` | JSONB | 変更後値 |
| `description` | TEXT | 可読説明 |
| `created_at` | TIMESTAMPTZ | |

### `contract_expiry_notifications` — 期限通知重複防止

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | UUID PK | |
| `contract_id` | UUID FK→contracts | |
| `company_id` | UUID FK→companies | |
| `notification_type` | TEXT | `60d` / `30d` / `7d` / `0d` |
| `notified_at` | TIMESTAMPTZ | 通知送信日時 |
| UNIQUE | contract_id + notification_type + 年 | 同一年内の重複通知防止 |

---

## Storage バケット

- バケット名: `contracts`
- アクセス: **private**（公開URL不可）
- パス構造: `{company_id}/{contract_id}/v{version}/{file_name}`
- ファイル取得: Signed URL経由（10分間有効）

---

## RLS方針

| テーブル | admin | worker(employee) | worker(partner) | client |
|---------|-------|---------|---------|--------|
| contracts | CRUD | ✗ | SELECT（自社関連・条件付き） | SELECT（公開+自社） |
| contract_files | CRUD | ✗ | ✗（将来拡張） | ✗ |
| contract_events | READ+INSERT | ✗ | ✗ | ✗ |
| contract_expiry_notifications | CRUD | ✗ | ✗ | ✗ |

---

## 契約ステータス遷移

```
draft（下書き）
  → sent（送付済み）
  → reviewing（確認中）
  → signed（締結済み）
  → active（有効）
  → expired（期限切れ）
  → terminated（解約）
```

---

## 契約期限アラート区分

| 日数 | 区分 | 色 |
|------|------|-----|
| 超過（-）| expired（期限切れ） | 赤 |
| 0〜6日 | critical（緊急） | 橙赤 |
| 7〜29日 | warning（警告） | 黄 |
| 30〜89日 | caution（注意） | ゴールド |
| 90日〜 | normal（正常） | 緑 |
| 期限なし | none | グレー |

---

## 金額管理の設計方針

- **契約金額は `project_prices` を参照**（二重管理禁止）
- 請求書は `invoices` → `project_prices` のデータフロー維持
- `contracts` テーブルに金額カラムなし

---

## 将来拡張

### 多対多契約-案件関係
```sql
CREATE TABLE contract_projects (
  contract_id UUID REFERENCES contracts(id),
  project_id  UUID REFERENCES projects(id),
  PRIMARY KEY (contract_id, project_id)
);
```

### 電子署名API連携（Phase 7+）
- `sign_provider` = `'cloudsign'` / `'docusign'`
- `sign_request_id` = 外部サービスのリクエストID
- ENV: `CLOUDSIGN_API_KEY`, `DOCUSIGN_INTEGRATION_KEY`（将来追加）
