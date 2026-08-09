# 単価・売上管理 DB設計

> Migration: `014_pricing.sql`

---

## 設計思想

将来の請求書作成・売上分析・月次/年次集計まで対応できる基盤設計。

1. **2テーブル構成**: 「請求情報」と「単価情報」を分離して責務を明確化
2. **統一テーブル**: 3種類の案件を同じテーブルで管理（`period_month`で区別）
3. **計算値を保存**: `tax_amount`・`amount_inc_tax`はアプリ側で計算してDBに保存（税率変更時も遡れる）
4. **集計VIEW**: `v_project_revenue`で案件横断の売上集計を高速化
5. **管理者のみ**: 作業者には価格データを見せない（RLSで強制）

---

## テーブル設計

### project_billing（案件請求情報）— 1:1 with projects

| カラム | 型 | 説明 |
|---|---|---|
| project_id | UUID PK/FK→projects | |
| billing_status | billing_status | 請求状況（下記）|
| quote_number | TEXT | 見積番号 |
| contract_date | DATE | 契約日 |
| billing_date | DATE | 請求予定日 |
| payment_due_date | DATE | 入金予定日 |
| actual_payment_date | DATE | 実際の入金日 |
| notes | TEXT | 備考 |

**billing_status Enum:**
| 値 | 表示 |
|---|---|
| `unbilled` | 未請求 |
| `billed` | 請求済 |
| `awaiting_payment` | 入金待ち |
| `paid` | 入金済 |
| `on_hold` | 保留 |
| `cancelled` | キャンセル |

---

### project_prices（案件単価情報）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| project_id | UUID FK→projects | |
| period_month | INTEGER 1-12 / NULL | NULL=単発/ホテル、1-12=定期（月別）|
| amount_ex_tax | NUMERIC(14,0) | 税抜金額 |
| tax_rate | NUMERIC(5,4) | 消費税率（0.10=10%）|
| tax_amount | NUMERIC(14,0) | 消費税額（保存済）|
| amount_inc_tax | NUMERIC(14,0) | 税込金額（保存済）|
| unit_price | NUMERIC(14,0) | 1室単価（ホテル専用）|
| quantity | INTEGER | 客室数（ホテル専用）|

**ユニーク制約:**
- `period_month IS NULL`: project_id ごとに1レコード（単発/ホテル）
- `period_month IS NOT NULL`: (project_id, period_month) でユニーク（定期）

---

### v_project_revenue（売上集計VIEW）

```sql
SELECT
  p.id, p.company_id, p.name, p.project_type, p.status, p.client_id,
  pb.billing_status, pb.billing_date, pb.payment_due_date, pb.actual_payment_date, pb.contract_date,
  SUM(pp.amount_ex_tax)  AS total_ex_tax,
  SUM(pp.tax_amount)     AS total_tax,
  SUM(pp.amount_inc_tax) AS total_inc_tax
FROM projects p
LEFT JOIN project_billing pb ON pb.project_id = p.id
LEFT JOIN project_prices  pp ON pp.project_id = p.id
GROUP BY ...
```

ダッシュボードの売上集計はこのVIEWで取得。

---

## 種別ごとの入力方式

### 単発案件
- 1レコード（`period_month = NULL`）
- 税抜金額を入力 → 消費税・税込を自動計算
- 見積番号・契約日・請求日・入金日を管理

### 定期案件
- 最大12レコード（`period_month = 1〜12`）
- 月ごとに税抜金額を個別設定
- 「毎月同じ金額」ボタンで一括反映 → 個別編集可能
- 年間合計を自動集計

### ホテル案件
- 1レコード（`period_month = NULL`）
- 1室単価（`unit_price`）× 客室数（`quantity`）= 税抜売上（`amount_ex_tax`）
- 客室数はフロア情報の合計から自動取得
- 消費税・税込をリアルタイム計算

---

## 計算ルール

```
税抜金額 × 税率 = 消費税額（Math.floor で切り捨て）
税抜金額 + 消費税額 = 税込金額

ホテル:
単価 × 客室数 = 税抜金額
税抜金額 × 税率 = 消費税額
```

計算はアプリ側（TypeScript）で行い、結果をDBに保存。

---

## RLS

| テーブル | アクセス |
|---|---|
| project_billing | 管理者のみ（作業者不可）|
| project_prices | 管理者のみ（作業者不可）|
| v_project_revenue | 管理者のみ（VIEWにはRLSなし・API経由でフィルタ）|

---

## ダッシュボード売上集計

| 指標 | 計算方法 |
|---|---|
| 今月売上 | billing_date が当月 の合計 |
| 年間売上 | billing_date が今年 の合計 |
| 未請求 | billing_status = 'unbilled' の合計 |
| 未入金 | billing_status IN ('billed', 'awaiting_payment') の合計 |
| 単発売上 | project_type = 'spot' の合計 |
| 定期売上 | project_type = 'recurring' の合計 |
| ホテル売上 | project_type = 'hotel' の合計 |

---

## 今後の拡張方針

1. **請求書作成**: `project_billing`から請求書PDFを自動生成
2. **月次集計**: 月×種別の売上集計テーブル（マテリアライズドビュー）
3. **顧客別売上**: `client_id`でグループ化した売上分析
4. **利益管理**: `project_costs`テーブル追加（人件費・材料費）→ 売上-費用=利益
5. **消費税申告**: 税率別集計（10%/8%/0%）
6. **自動請求**: billing_dateが到来したら自動で請求済に変更（Edge Functions）
