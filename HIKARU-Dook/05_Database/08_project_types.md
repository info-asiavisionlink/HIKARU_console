# 案件管理 DB設計（3種類対応）

> Migration: `013_project_types.sql`

---

## 設計思想

将来100社・複数ホテル・数千件規模に対応するため、以下の原則を採用：

1. **基底テーブル統一**: `projects`テーブルに`project_type`を持ち、全種別を横断検索可能
2. **1:1拡張テーブル**: 種別固有の情報は`spot_project_details` / `recurring_project_details` / `hotel_project_details`に分離
3. **1:Nサブテーブル**: 繰り返し・複数の情報（フロア・稼働・エリア・月次スケジュール）は専用テーブル
4. **RLSで保護**: 全テーブルにRow Level Securityを適用
5. **インデックス設計**: `project_type`・`company_id`・`status`にインデックス

---

## project_type Enum

| 値 | 意味 |
|---|---|
| `spot` | 単発案件（引渡・スポット・退去・イベント清掃など）|
| `recurring` | 定期案件（毎日・毎週・毎月の繰り返し清掃）|
| `hotel` | ホテル案件（ホテル専用清掃管理）|

---

## テーブル構成

### projects（基底テーブル）

既存に以下を追加：

| カラム追加 | 型 | 説明 |
|---|---|---|
| project_type | project_type | 案件種別（必須）|
| client_id | UUID FK→clients | 顧客（任意）|

---

### spot_project_details（単発案件詳細）

| カラム | 型 | 説明 |
|---|---|---|
| project_id | UUID PK/FK→projects | |
| work_datetime | TIMESTAMPTZ | 作業日時 |
| work_content | TEXT | 作業内容 |
| required_staff | INTEGER | 必要人数 |
| estimated_hours | NUMERIC(4,1) | 予定時間（例: 3.5h）|

---

### recurring_project_details（定期案件詳細）

| カラム | 型 | 説明 |
|---|---|---|
| project_id | UUID PK/FK→projects | |
| cycle_type | cycle_type | 作業周期（下記）|
| cycle_config | JSONB | 周期の詳細設定 |
| work_start_time / work_end_time | TIME | 作業時間帯 |
| required_staff | INTEGER | 必要人数 |
| auto_generate | BOOLEAN | 自動案件生成ON/OFF |
| last_generated_at | TIMESTAMPTZ | 最後の自動生成日時 |

**cycle_type Enum:** `daily` / `weekly` / `monthly` / `biweekly` / `nth_weekday` / `custom`

**cycle_config examples:**
```json
// weekly: 月・水・金
{"weekdays": [1, 3, 5]}

// monthly: 毎月15日
{"day": 15}

// nth_weekday: 第2金曜
{"n": 2, "weekday": 5}
```

---

### recurring_monthly_schedules（年間作業スケジュール）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| project_id | UUID FK→projects | |
| month | INTEGER 1-12 | 月 |
| work_content | TEXT | その月の作業内容 |
| notes | TEXT | 備考 |

`UNIQUE(project_id, month)`

例: 1月→床洗浄、4月→エアコン洗浄、12月→大掃除

---

### hotel_project_details（ホテル案件詳細）

| カラム | 型 | 説明 |
|---|---|---|
| project_id | UUID PK/FK→projects | |
| total_floors | INTEGER | 総階数 |
| operating_start_time / operating_end_time | TIME | 稼働時間 |
| manager_name | TEXT | 担当責任者 |
| phone | TEXT | 電話番号 |
| contract_start_date / contract_end_date | DATE | 契約期間 |
| auto_generate | BOOLEAN | 毎日自動生成 |

---

### hotel_floors（フロア情報）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| hotel_detail_id | UUID FK→hotel_project_details | |
| floor_name | TEXT | フロア名（1F, 2F, B1, PH等）|
| room_count | INTEGER | 部屋数 |
| order_num | INTEGER | 表示順 |

---

### hotel_staffing_rules（稼働管理）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| hotel_detail_id | UUID FK | |
| time_slot | TEXT | 時間帯（朝/昼/夜/自由設定）|
| required_staff | INTEGER | 必要人数 |
| order_num | INTEGER | 表示順 |

---

### hotel_work_areas（作業エリア）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| hotel_detail_id | UUID FK | |
| name | TEXT | エリア名（部屋清掃/共用部/廊下等）|
| description | TEXT | 説明 |
| order_num | INTEGER | 表示順 |

---

## ER図（案件種別）

```
projects (project_type: spot/recurring/hotel)
    │
    ├── 1:1 spot_project_details
    │
    ├── 1:1 recurring_project_details
    │       └── 1:N recurring_monthly_schedules (month 1-12)
    │
    ├── 1:1 hotel_project_details
    │       ├── 1:N hotel_floors
    │       ├── 1:N hotel_staffing_rules
    │       └── 1:N hotel_work_areas
    │
    └── 1:N project_assignments → employees / partners
```

---

## 自動案件生成設計

### 定期案件の自動生成
- `recurring_project_details.auto_generate = TRUE`のとき有効
- `cycle_type` + `cycle_config`から次回作業日を計算
- 毎月1日などのトリガー（将来：Supabase Edge Functions + pg_cron）で実行
- `last_generated_at`で重複生成を防止

### ホテル案件の自動生成
- `hotel_project_details.auto_generate = TRUE`のとき有効
- 毎日稼働案件を自動生成（前日23:59等に実行）
- `project_assignments`から担当者を取得してjobsに追加

---

## 画面構成（HIKARU-CONSOLE）

```
案件管理（親メニュー）
  ├── 全案件      /projects
  ├── 単発案件    /projects/spot
  │   ├── 一覧
  │   ├── 新規    /projects/spot/new
  │   └── 詳細    /projects/spot/[id]
  ├── 定期案件    /projects/recurring
  │   ├── 一覧（年間スケジュール表示）
  │   ├── 新規    /projects/recurring/new
  │   └── 詳細    /projects/recurring/[id]
  └── ホテル案件  /projects/hotel
      ├── 一覧
      ├── 新規    /projects/hotel/new
      └── 詳細    /projects/hotel/[id]
```

---

## HIKARU-System（作業者画面）

- 担当案件のみ表示（`project_assignments`でフィルタ）
- `project_type`に応じてUIを自動切替：
  - `spot` → 単発案件UI（作業日時・内容表示）
  - `recurring` → 定期案件UI（月次スケジュール表示）
  - `hotel` → ホテル案件UI（フロア・エリア・稼働表示）
