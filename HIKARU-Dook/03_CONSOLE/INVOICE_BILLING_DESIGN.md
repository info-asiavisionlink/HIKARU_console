# HIKARU Phase 3 見積書・請求書PDF 設計書

**作成日**: 2026-08-09  
**対象**: HIKARU-CONSOLE + HIKARU-customer portal

---

## 1. 業務フロー

```
clients（顧客）
  ↓
projects（案件: spot/recurring/hotel）
  ↓
project_prices（案件単価 - Snapshot元データ）
  ↓
invoices（見積書: quote）
  ↓ invoice_items（金額Snapshot - 案件単価と独立）
  ↓
invoices（請求書: invoice）← converted_from_id で見積書を参照
  ↓
invoice_payments（入金履歴 - 分割払い対応）
  ↓
project_billing.actual_payment_date（入金完了）
```

---

## 2. DBテーブル（Migration 028）

### invoices（見積書・請求書の本体）

| カラム | 型 | 説明 |
|--------|-----|------|
| invoice_type | TEXT | 'quote'=見積書 / 'invoice'=請求書 |
| invoice_number | TEXT | QUO-2026-0001 / INV-2026-0001 |
| converted_from_id | UUID | 見積書からの変換元 |
| subtotal | NUMERIC(14,0) | 税抜合計（Snapshot） |
| tax_rate | NUMERIC(5,4) | 税率（0.10=10%） |
| tax_amount | NUMERIC(14,0) | 税額（Snapshot） |
| total_amount | NUMERIC(14,0) | 税込合計（Snapshot） |
| rounding_method | TEXT | 端数処理: floor/round/ceil |
| status | TEXT | draft/issued/accepted/... |
| published_to_portal | BOOLEAN | 顧客ポータル公開フラグ |
| pdf_path | TEXT | Supabase Storage パス |
| paid_amount | NUMERIC(14,0) | 入金累計額 |

### invoice_items（明細 - 金額Snapshot）

案件単価を変更しても、既存の invoice_items は変化しない。
`source_type='project_price'`, `source_id=project_prices.id` で元の参照を保持するが、金額はコピー済み。

### invoice_payments（入金履歴）

1請求書に複数の入金履歴を持てる（一部入金対応）。

### invoice_number_counters（連番管理）

DB関数 `next_invoice_number()` で行ロックを使い並行処理でも重複しない。

---

## 3. 案件タイプ別計算

### lib/billing/calculator.ts（共通計算サービス）

全画面・API・PDFで同じ関数を使用。ブラウザ側の計算結果は信用せず、サーバー側で再計算してSnapshotを作成。

| 案件タイプ | 計算方法 |
|-----------|---------|
| spot | amount_ex_tax × 1式 |
| recurring | 対象月の amount_ex_tax × 1式 |
| hotel | unit_price × quantity(室数) |

```typescript
buildItemsFromProjectPrice(price, projectType, periodLabel, projectName)
calcInvoice(items, taxRate, rounding)  // → subtotal, tax_amount, total_amount
calcTax(subtotal, taxRate, rounding)
```

---

## 4. ステータス遷移

### 見積書 (quote)
```
draft → issued → accepted → (→請求書に変換)
              → rejected
              → cancelled
```

### 請求書 (invoice)
```
draft → issued → sent → awaiting_payment → paid
                                         → overdue
                        → cancelled
```

---

## 5. 金額Snapshot

**重要**: 案件単価変更後も発行済み書類の金額は変わらない。

- 作成時: `invoice_items` に金額をコピー（Snapshot）
- `project_prices.amount_ex_tax` を変更しても影響なし
- 請求書変換時: 見積書の金額をそのままコピー

---

## 6. PDF生成

### 技術スタック

`@react-pdf/renderer` でサーバーサイド生成。

```
POST /api/invoices/[id]/pdf
  → renderToBuffer(InvoicePDF)
  → Supabase Storage: documents/{company_id}/invoices/{invoice_number}.pdf
  → 署名URL（1時間有効）を返却
```

### Storage パス構造

```
documents/
  {company_id}/
    quotes/     ← 見積書
    invoices/   ← 請求書
```

### セキュリティ

- Storage は直接公開しない（署名URL制）
- 顧客ポータルは `/api/portal/invoices/[id]/pdf` 経由でテナント検証後にリダイレクト
- `published_to_portal=true` AND `client_id` 一致のみアクセス可

---

## 7. API一覧

### CONSOLE API
| メソッド | パス | 説明 |
|---------|------|------|
| GET | /api/invoices | 一覧（KPI付き） |
| POST | /api/invoices | 作成（サーバー側で金額再計算） |
| GET | /api/invoices/[id] | 詳細 |
| PUT | /api/invoices/[id] | 更新（発行済みは限定） |
| DELETE | /api/invoices/[id] | 削除（draft のみ） |
| POST | /api/invoices/[id]/status | ステータス変更 |
| POST | /api/invoices/[id]/pdf | PDF生成 |
| POST | /api/invoices/[id]/publish | 顧客ポータル公開 |
| POST | /api/invoices/[id]/convert | 見積書→請求書変換 |
| POST | /api/invoices/[id]/payment | 入金登録 |
| GET | /api/invoices/[id]/payment | 入金履歴 |
| POST | /api/invoices/overdue | 期限超過バッチ（Cron） |

### Customer Portal API
| メソッド | パス | 説明 |
|---------|------|------|
| GET | /api/portal/invoices/[id]/pdf | PDF署名URL取得（テナント検証付き） |

---

## 8. RLS

| ロール | invoices | invoice_items | invoice_payments |
|--------|---------|---------------|-----------------|
| 管理者 | CRUD | CRUD | CRUD |
| 従業員 | ✗ | ✗ | ✗ |
| 協力業者 | ✗ | ✗ | ✗ |
| 顧客 | SELECT（公開済み+自社） | SELECT（公開済み） | ✗ |

---

## 9. Console UI

- `/invoices/quotes` - 見積書一覧
- `/invoices/bills` - 請求書一覧（KPI・期限超過ハイライト）
- `/invoices/payments` - 入金管理（未収・入金済み）
- `/invoices/new` - 作成（案件単価から自動入力）
- `/invoices/[id]` - 詳細（ステータス変更・PDF・入金登録・変換）
- 案件詳細ページ → 「見積書作成」ボタン追加

---

## 10. 顧客ポータル UI

- `/invoices` - 請求・書類一覧（公開済みのみ）
- サイドバーに「請求・書類」メニュー追加
- PDFダウンロードリンク（署名URL経由）

---

## 11. 監査ログ

invoices テーブルに保持:
- `created_by` / `created_at`
- `issued_by` / `issued_at`
- `published_by` / `published_at`
- `cancelled_by` / `cancelled_at` / `cancel_reason`

---

## 12. Phase 4 LINE連携フック

既存APIに `// 将来: LINE通知` コメントあり:
- `publish/route.ts` → `quote_published` / `invoice_issued`
- `payment/route.ts` → `payment_received`
- `status/route.ts` (issued) → 通知トリガー

Phase 4で `sendNotification()` を呼ぶだけで接続可能。

---

## 13. Phase 8 会計連携準備

invoices テーブルに以下を正確に保持:
- `invoice_number`（請求番号）
- `issue_date`（発行日）
- `client_id`（取引先）
- `subtotal` / `tax_amount` / `total_amount`（金額・税額）
- `tax_rate`（税区分）
- `paid_at`（入金日）
- `invoice_payments`（入金明細）

freee / マネーフォワード CSV出力は `v_invoice_summary` Viewから集計可能。
