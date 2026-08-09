# HIKARU Phase 6 備品・消耗品管理 設計書

**作成日**: 2026-08-09

---

## 1. 基本方針

在庫数量を直接 UPDATE せず、`inventory_transactions` の取引履歴から管理する。
`stock_quantity` は非正規化キャッシュ（Supabase RPC でアトミック更新）。

```
入庫 (+) → record_stock_transaction → stock_quantity 更新 + 履歴記録
出庫 (-) → record_stock_transaction → stock_quantity 更新 + 履歴記録
調整 (±) → record_stock_transaction → stock_quantity 更新 + 履歴記録（理由必須）
```

---

## 2. DBテーブル（Migration 031）

### inventory_items（在庫マスタ）

| カラム | 型 | 説明 |
|--------|-----|------|
| name | TEXT | 商品名 |
| category | TEXT | detergent/consumable/tool/hygiene/equipment/other |
| unit | TEXT | 個/本/L/袋/箱 等 |
| unit_price | NUMERIC(12,2) | 単価（参考値） |
| stock_quantity | NUMERIC(10,2) | 現在在庫（RPCで更新） |
| min_stock | NUMERIC(10,2) | 最低在庫数 |
| supplier_* | TEXT | 仕入先情報 |
| barcode | TEXT | JAN/バーコード（将来スキャン対応） |
| last_low_stock_notified_at | TIMESTAMPTZ | 重複通知防止 |
| is_active | BOOLEAN | 論理削除フラグ |

### inventory_transactions（入出庫・調整履歴）

| カラム | 型 | 説明 |
|--------|-----|------|
| transaction_type | TEXT | in/out/adjustment |
| quantity | NUMERIC | 正値=増加、負値=減少 |
| project_id | UUID | 案件原価分析用 |
| shift_id | UUID | シフト連携 |
| job_id | UUID | 作業連携 |
| performed_by | UUID | 担当者 |
| reason | TEXT | 出庫理由・調整理由 |

### Supabase RPC: record_stock_transaction()
行ロック（FOR UPDATE）で同時出庫の競合を防止。マイナス在庫防止チェック付き（adjustmentは例外）。

---

## 3. 在庫ステータス（自動判定）

```typescript
stock_quantity <= 0  → out_of_stock
stock_quantity < min_stock → low_stock
else → normal
```

管理者が手動でステータスを変更することは不可（数量と最低在庫から自動計算）。

---

## 4. RLS

| ロール | inventory_items | inventory_transactions |
|--------|-----------------|----------------------|
| 管理者 | CRUD | CRUD |
| 従業員 | SELECT (is_active=true) | INSERT (out のみ) |
| 協力業者 | × | × |
| 顧客 | × | × |

---

## 5. API一覧

### Console (HIKARU-CONSOLE)
| パス | 説明 |
|------|------|
| GET/POST /api/inventory | 一覧+KPI / 商品登録 |
| GET/PUT/DELETE /api/inventory/[id] | 詳細/更新/無効化 |
| GET /api/inventory/[id]/transactions | 在庫履歴 |
| POST /api/inventory/[id]/in | 入庫 |
| POST /api/inventory/[id]/out | 出庫 |
| POST /api/inventory/[id]/adjust | 在庫調整 |
| GET/POST /api/inventory/usage | 作業者使用報告 |
| GET /api/projects/[id]/inventory | 案件の使用備品+原価 |

---

## 6. 在庫不足通知（Phase 4基盤使用）

```
出庫後 → calculateStockStatus() → low_stock / out_of_stock
→ shouldNotifyLowStock() → 重複チェック
→ sendNotification() → LINE通知
→ last_low_stock_notified_at を更新

重複防止:
  notification_key = "inventory_low_stock:{item_id}:{today}:{admin_id}"
  正常に回復後→再びlow_stock: last_low_stock_notified_at < last updated_at → 再通知
```

---

## 7. 案件原価連携

`inventory_transactions.project_id` に案件IDを保存することで:

```
GET /api/projects/[id]/inventory
→ 案件に紐付いた出庫履歴を集計
→ 商品別数量・原価
→ 案件合計消耗品費
```

将来: 案件売上 - 人件費 - 経費 - 消耗品費 = 案件利益

---

## 8. Console UI

- `/inventory` - ダッシュボード（在庫一覧・KPI・フィルター）
- `/inventory/[id]` - 商品詳細（入庫/出庫/調整ダイアログ・履歴）
- Sidebar: 「在庫管理」メニュー追加

---

## 9. 将来拡張

- **バーコードスキャン**: `barcode` カラム対応済み。スマートフォンカメラ → バーコード → 商品検索へ拡張可能
- **発注管理**: 在庫不足 → 発注作成 → 入庫 のワークフロー追加
- **写真・伝票**: Supabase Storage に納品書写真を添付可能
- **経費連携**: 備品購入 → 経費申請 + 入庫 の同時処理

---

## 10. Phase 7への依存事項

- 電子契約（Phase 7）で仕入先との契約書管理
- 資格・保険期限（Phase 10）で機材の保守期限管理
