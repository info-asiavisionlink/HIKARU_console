# HIKARU Phase 2: 経費申請・精算 実装仕様書
**実装日**: 2026-08-09 | **ステータス**: 実装完了・本番デプロイ済み

---

## 1. 業務フロー

```
経費発生（現場で駐車場代など支払）
  ↓
経費登録（Systemアプリ or Partnerアプリ）
  → status: draft
  → 領収書撮影（カメラ優先UI）
  ↓
申請する
  → status: submitted, submitted_at 記録
  ↓ （管理者がConsoleで確認）
承認 → status: approved, approved_by, approved_at 記録
却下 → status: rejected, reject_reason 必須
  ↓（承認の場合）
精算済み → status: settled, settled_by, settled_at, settled_amount 記録
  ↓
給与計算データ（将来: settled の経費を月次集計）
  ↓
会計ソフト連携（将来: v_project_expense_summary から CSV出力）
```

### 取り下げ
申請中（submitted）に限り本人が取り下げ可能 → status: withdrawn, withdrawn_at 記録

---

## 2. DB設計

### expenses テーブル（既存拡張）

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | UUID PK | |
| `worker_id` | UUID → profiles | 申請者（auth.uid()） |
| `company_id` | UUID → companies | テナント分離 |
| `assignee_type` | text | 'employee' / 'partner' |
| `employee_id` | UUID → employees | 従業員ID（nullable） |
| `partner_id` | UUID → partners | 協力業者ID（nullable） |
| `expense_date` | date | 経費発生日 |
| `claim_month` | date | 対象月（YYYY-MM-01） |
| `category` | text | transport/parking/supplies/consumables/other |
| `amount` | integer | 申請金額（円） |
| `description` | text | 内容説明 |
| `note` | text | 備考 |
| `project_id` | UUID → projects | 関連案件（nullable） |
| `shift_id` | UUID → shifts | 関連シフト（nullable） |
| `job_id` | UUID → jobs | 関連JOB（nullable） |
| `status` | text | draft/submitted/approved/rejected/settled/withdrawn |
| `submitted_at` | timestamptz | 申請日時 |
| `approved_by` | UUID → profiles | 承認/却下した管理者 |
| `approved_at` | timestamptz | 承認/却下日時 |
| `reject_reason` | text | 却下理由（rejectedの場合必須） |
| `settled_by` | UUID → profiles | 精算した担当者 |
| `settled_at` | timestamptz | 精算日時 |
| `settled_amount` | integer | 精算額（申請額と異なる場合あり） |
| `withdrawn_at` | timestamptz | 取り下げ日時 |
| `ocr_result` | JSONB | OCR結果（将来実装用） |
| `receipt_url` | text | 旧フィールド（廃止予定） |

### expense_receipts テーブル（新設）

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | UUID PK | |
| `expense_id` | UUID → expenses | 紐付く経費 |
| `company_id` | UUID → companies | テナント分離 |
| `storage_path` | text | receipts/{company_id}/{uid}/{expense_id}/{filename} |
| `file_name` | text | 元ファイル名 |
| `mime_type` | text | image/jpeg, image/png, application/pdf 等 |
| `file_size` | integer | bytes |
| `ocr_status` | text | pending/processing/completed/failed/skipped |

---

## 3. Storage設計

### receipts バケット（private）

```
receipts/
  {company_id}/
    {profile_id}/
      {expense_id}/
        receipt-{timestamp}.jpg
```

- **private バケット** → 直接URLではアクセス不可
- **Signed URL** で5〜10分間限定のプレビューURL発行
- 10MB制限 / 許可MIME: image/jpeg, image/png, image/webp, image/heic, application/pdf

---

## 4. RLS設計

| 操作 | 従業員/協力業者 | 管理者 |
|------|----------------|--------|
| INSERT | ✅（自分のみ） | ❌ |
| SELECT | ✅（自分のみ） | ✅（同一会社） |
| UPDATE（draft） | ✅（draft状態のみ） | ✅ |
| UPDATE（submit/withdraw） | ✅（status変更のみ） | ✅ |
| DELETE | ✅（draft状態のみ） | ✅ |

**重要**: submitted以降の金額・内容変更はAPIレベルとRLSの両方で禁止

---

## 5. カテゴリー

| key | 表示名 |
|-----|--------|
| transport | 交通費 |
| parking | 駐車場代 |
| supplies | 備品 |
| consumables | 消耗品 |
| other | その他 |

→ CHECK制約で型安全。将来追加時はMigrationでCHECK制約を変更。

---

## 6. API一覧

### System / Partner（申請者）
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/expenses` | 自分の経費一覧 |
| POST | `/api/expenses` | 経費登録（draft） |
| GET | `/api/expenses/[id]` | 詳細取得 |
| PUT | `/api/expenses/[id]` | 編集（draft only） |
| DELETE | `/api/expenses/[id]` | 削除（draft only） |
| POST | `/api/expenses/[id]/submit` | 申請（draft→submitted） |
| POST | `/api/expenses/[id]/withdraw` | 取り下げ（submitted→withdrawn） |
| POST | `/api/upload-receipt` | 領収書アップロード |
| GET | `/api/receipt-url?path=` | 領収書 Signed URL（本人のみ） |

### CONSOLE（管理者）
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/expenses` | 全経費一覧 + KPI |
| GET | `/api/expenses/[id]` | 詳細（関連データ含む） |
| POST | `/api/expenses/[id]/approve` | 承認 |
| POST | `/api/expenses/[id]/reject` | 却下（理由必須） |
| POST | `/api/expenses/[id]/settle` | 精算 |
| GET | `/api/receipts/signed-url?path=` | 領収書プレビュー |

---

## 7. 将来の拡張ポイント

### OCR（Phase 4以降）
```typescript
// expense_receipts.ocr_status を 'processing' に更新
// OpenAI Vision API で解析
// expense_receipts.ocr_result に格納:
// { date: "2026-08-10", amount: 1500, store: "○○コンビニ", raw: "..." }
// expenses.ocr_result にも複製（高速参照用）
```

### LINE通知接続（Phase 4）
```typescript
// 各APIに TODO コメント追加済み:
// submit → expense_submitted イベント
// approve → expense_approved イベント  
// reject → expense_rejected イベント
// settle → expense_settled イベント
```

### 給与計算連携
```sql
-- 月次経費集計（approved または settled）
SELECT worker_id, SUM(amount) as total_expense
FROM expenses
WHERE claim_month = '2026-08-01'
  AND status IN ('approved', 'settled')
  AND company_id = '{company_id}'
GROUP BY worker_id;
```

### 案件利益分析（将来）
```sql
-- 案件別経費集計View: v_project_expense_summary
SELECT project_id, status, COUNT(*), SUM(amount)
FROM expenses WHERE project_id IS NOT NULL
GROUP BY project_id, company_id, status;

-- 案件粗利 = 案件売上 - 案件経費
-- project_prices.amount_inc_tax - v_project_expense_summary.total_amount
```

---

## 8. 変更ファイル一覧

### 新規
- `supabase/migrations/027_expense_claims.sql`
- `HIKARU-CONSOLE/app/(console)/expenses/page.tsx`
- `HIKARU-CONSOLE/app/(console)/expenses/[id]/page.tsx`
- `HIKARU-CONSOLE/app/api/expenses/route.ts`
- `HIKARU-CONSOLE/app/api/expenses/[id]/route.ts`
- `HIKARU-CONSOLE/app/api/expenses/[id]/approve/route.ts`
- `HIKARU-CONSOLE/app/api/expenses/[id]/reject/route.ts`
- `HIKARU-CONSOLE/app/api/expenses/[id]/settle/route.ts`
- `HIKARU-CONSOLE/app/api/receipts/signed-url/route.ts`
- `HIKARU-System/app/(worker)/expenses/page.tsx`
- `HIKARU-System/app/(worker)/expenses/new/page.tsx`
- `HIKARU-System/app/(worker)/expenses/[id]/page.tsx`
- `HIKARU-System/app/api/expenses/route.ts`
- `HIKARU-System/app/api/expenses/[id]/route.ts`
- `HIKARU-System/app/api/expenses/[id]/submit/route.ts`
- `HIKARU-System/app/api/expenses/[id]/withdraw/route.ts`
- `HIKARU-System/app/api/upload-receipt/route.ts`
- `HIKARU-System/app/api/receipt-url/route.ts`
- `HIKARU-Partner/app/api/expenses/route.ts`
- `HIKARU-Partner/app/api/expenses/[id]/submit/route.ts`

### 更新
- `HIKARU-CONSOLE/components/layouts/Sidebar.tsx`（経費管理追加）
- `HIKARU-System/components/layouts/WorkerSidebar.tsx`（経費申請追加）
