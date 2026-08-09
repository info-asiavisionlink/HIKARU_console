# HIKARU Phase 1: シフト管理 実装仕様書
**実装日**: 2026-08-09  
**ステータス**: 実装完了・本番デプロイ済み

---

## 1. SHIFTとJOBの違い（最重要）

```
SHIFT = 予定（管理者がConsoleから登録）
  誰を / どの案件に / 何日 / 何時〜何時

JOB = 実績（作業者がSystemアプリで記録）
  何時に到着 / 何時に作業開始 / 何時に完了
```

### データモデルの対応
```
shifts.shift_date + start_time + end_time  ← 予定時間
jobs.started_at + completed_at             ← 実績時間
```

SHIFTはJOBの「予定の元データ」だが、直接紐付けは今回未実装。  
（将来: `jobs.shift_id` を追加してトレース可能にする）

---

## 2. DBテーブル設計

### shifts テーブル

```sql
CREATE TABLE public.shifts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES public.companies(id),
  project_id      UUID        NOT NULL REFERENCES public.projects(id),
  assignee_type   TEXT        NOT NULL CHECK (assignee_type IN ('employee', 'partner')),
  employee_id     UUID        REFERENCES public.employees(id),
  partner_id      UUID        REFERENCES public.partners(id),
  shift_date      DATE        NOT NULL,
  start_time      TIME        NOT NULL,
  end_time        TIME        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled','confirmed','in_progress','completed','cancelled')),
  notes           TEXT,
  created_by      UUID        REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 設計ポイント
- `1シフト = 1人` の設計。複数人配置は複数レコードで表現。
- `assignee_type + employee_id/partner_id` でemployee/partner両対応。
- `created_by` で誰が登録したかをトレース可能。

### ステータス遷移
```
scheduled（予定）→ confirmed（確定）→ in_progress（作業中）→ completed（完了）
                                    ↓
                              cancelled（キャンセル）
```

---

## 3. RLS設計

```
管理者(admin):     同一company_idのシフトをCRUD
従業員(worker):    自分のemployee_id に紐づくシフトをSELECTのみ
協力業者(partner): 自分のpartner_id  に紐づくシフトをSELECTのみ
顧客(client):      アクセス不可
```

### RLSポリシー実装方法

```sql
-- 従業員は employees.auth_user_id = auth.uid() 経由でフィルタ
CREATE POLICY "shifts: employee read own"
  ON public.shifts FOR SELECT TO authenticated
  USING (
    assignee_type = 'employee'
    AND employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid())
  );
```

**重要**: UIで隠すだけは禁止。Supabase RLSで必ずデータレベルで制御。

---

## 4. API設計

### HIKARU-CONSOLE API

| メソッド | エンドポイント | 説明 |
|---------|--------------|------|
| GET | `/api/shifts` | 一覧取得（date_from/date_to/project_idで絞込） |
| POST | `/api/shifts` | シフト登録 |
| GET | `/api/shifts/[id]` | 単件取得 |
| PUT | `/api/shifts/[id]` | 更新（status変更含む） |
| DELETE | `/api/shifts/[id]` | 削除 |
| GET | `/api/shifts/overlap` | 重複チェック |

### HIKARU-System API

| メソッド | エンドポイント | 説明 |
|---------|--------------|------|
| GET | `/api/shifts` | 自分のシフトのみ（RLSで強制）|

### HIKARU-Partner API

| メソッド | エンドポイント | 説明 |
|---------|--------------|------|
| GET | `/api/shifts` | 自社partner_idのシフトのみ |

---

## 5. 画面構成

### CONSOLE（管理者）

**サイドバー**: 従業員管理の下に「シフト管理（CalendarDaysアイコン）」追加

**`/shifts`** - シフト一覧
- 日/週/月 表示切替
- 前後ナビゲーション + 「今日」ボタン
- 日付ごとにシフトをグループ表示
- ステータス別カラーコード
- 「確定」ワンクリックボタン
- 削除ボタン
- 日付ヘッダーから直接「+」でその日のシフト追加

**`/shifts/new`** - シフト作成
- 案件選択（アクティブ案件のみ表示）
- 案件選択後にプレビュー表示（名称・場所・種別）
- 担当種別（従業員/協力業者）切替
- 担当者プルダウン
- **重複チェック**: 同人物の同時間帯シフトをリアルタイム警告
- 管理者権限で上書き登録可能
- ステータス（予定/確定）選択

### System（従業員）

**ホーム画面**: 「今日の予定シフト」セクション追加  
→ 今日のシフトがある場合のみ表示

**スケジュール画面**: シフト週表示に刷新
- 週カレンダー（前後週ナビ）
- シフトのある日にドット表示
- シフト詳細カード（時間/案件名/場所/ステータス）
- **Supabase Realtime** でリアルタイム更新

### Partner（協力業者）

- `/api/shifts` で自社partner_idのシフトのみ取得
- 今後: Partnerのscheduleページにも同様のUI追加予定

---

## 6. Realtime実装

```typescript
// Supabase Realtimeでshiftsテーブルを購読
const channel = supabase
  .channel('shifts-realtime')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => {
    fetchShifts() // 変更があれば再取得
  })
  .subscribe()
```

**接続状態インジケーター**: 画面上部にLIVE/connecting表示

---

## 7. 重複チェック機能

```sql
-- DBレベルの重複チェック関数
SELECT * FROM public.check_shift_overlap(
  p_employee_id  := 'uuid',
  p_assignee_type := 'employee',
  p_shift_date   := '2026-08-10',
  p_start_time   := '09:00',
  p_end_time     := '12:00'
);
```

同一人物・同日・時間帯が重複する場合:
1. フォームに警告表示（案件名・時間帯）
2. **管理者は上書き登録可能**（警告は表示するが送信はできる）

---

## 8. 将来の給与計算との接続

```
shifts（予定）
  shift_date, start_time, end_time
  ↓
jobs（実績）
  started_at, completed_at
  ↓
[将来] salary_calculations
  実働時間 × 時給（profiles.hourly_rate）
  + 交通費（expense_claims）
  = 給与計算データ
```

接続点:
- `profiles.hourly_rate` / `profiles.daily_rate` が既に存在
- `expense_claims`（Phase 2）でシフトと紐付け可能
- `shifts.id → jobs.shift_id` で予実管理を将来実装

---

## 9. 変更ファイル一覧

```
supabase/migrations/026_shifts.sql          ← NEW
HIKARU-CONSOLE/components/layouts/Sidebar.tsx  ← 更新
HIKARU-CONSOLE/app/(console)/shifts/page.tsx   ← NEW
HIKARU-CONSOLE/app/(console)/shifts/new/page.tsx ← NEW
HIKARU-CONSOLE/app/api/shifts/route.ts         ← NEW
HIKARU-CONSOLE/app/api/shifts/[id]/route.ts    ← NEW
HIKARU-CONSOLE/app/api/shifts/overlap/route.ts ← NEW
HIKARU-System/app/api/shifts/route.ts          ← NEW
HIKARU-System/app/(worker)/home/page.tsx       ← 更新（今日のシフト追加）
HIKARU-System/app/(worker)/schedule/page.tsx   ← 更新（シフト表示に刷新）
HIKARU-Partner/app/api/shifts/route.ts         ← NEW
```
