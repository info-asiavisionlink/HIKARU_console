# HIKARU データベース構造（CONSOLEテーブル）

## テーブル一覧

```
companies         会社（テナント）
├── profiles      ユーザープロフィール（auth.usersと連携）
├── clients       顧客企業
│   └── stores    店舗
│       ├── locations    作業場所
│       ├── photo_spots  撮影箇所
│       └── projects     案件
│           ├── project_workers  担当作業者（M2M）
│           └── manuals          マニュアル
└── notifications  通知
```

---

## clients（顧客企業）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID | PK |
| company_id | UUID | FK → companies |
| name | TEXT | 顧客名 |
| code | TEXT | 顧客コード（例: CLI-001） |
| email | TEXT | メール |
| phone | TEXT | 電話番号 |
| address | TEXT | 住所 |
| contact_name | TEXT | 担当者名 |
| notes | TEXT | 備考 |
| is_active | BOOLEAN | 有効/無効 |

---

## stores（店舗）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID | PK |
| client_id | UUID | FK → clients |
| company_id | UUID | FK → companies |
| name | TEXT | 店舗名 |
| code | TEXT | 店舗コード |
| address | TEXT | 住所 |
| phone | TEXT | 電話番号 |
| business_hours | TEXT | 営業時間 |
| manager_name | TEXT | 責任者名 |
| emergency_contact | TEXT | 緊急連絡先 |
| contract_info | TEXT | 契約情報 |
| notes | TEXT | 備考 |
| is_active | BOOLEAN | 有効/無効 |

---

## locations（作業場所）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID | PK |
| store_id | UUID | FK → stores |
| name | TEXT | 場所名（例: 入口） |
| order_num | INT | 表示順（0始まり） |
| is_active | BOOLEAN | 有効/無効 |

---

## photo_spots（撮影箇所）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID | PK |
| store_id | UUID | FK → stores |
| name | TEXT | 撮影箇所名 |
| description | TEXT | 説明・撮影ポイント |
| order_num | INT | 表示順 |
| is_required | BOOLEAN | 必須撮影かどうか |
| ref_image_url | TEXT | 参考画像URL |

---

## projects（案件）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID | PK |
| company_id | UUID | FK → companies |
| store_id | UUID | FK → stores |
| name | TEXT | 案件名 |
| code | TEXT | 案件コード |
| status | ENUM | active/paused/completed/cancelled |
| start_date | DATE | 開始日 |
| end_date | DATE | 終了日 |
| contract_info | TEXT | 契約内容 |
| notes | TEXT | 注意事項 |
| address | TEXT | 現場住所（第3回追加） |
| assigned_to | TEXT | 担当者名（第3回追加） |

---

## manuals（マニュアル）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID | PK |
| project_id | UUID | FK → projects |
| type | ENUM | pdf/image/video/text/faq/note |
| title | TEXT | タイトル |
| content | TEXT | テキスト内容 |
| file_url | TEXT | ファイルURL（PDF・画像・動画） |
| order_num | INT | 表示順 |

---

## notifications（通知）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID | PK |
| company_id | UUID | FK → companies |
| title | TEXT | タイトル |
| body | TEXT | 本文 |
| type | TEXT | info/warning/error/success |
| is_read | BOOLEAN | 既読フラグ |
| target_url | TEXT | リンク先URL |
| created_at | TIMESTAMPTZ | 作成日時 |

---

## マイグレーション履歴

| ファイル | 内容 |
|---|---|
| 001_create_profiles.sql | companies・profiles・RLS・トリガー |
| 002_console_tables.sql | clients・stores・locations・photo_spots・projects・project_workers・manuals・RLS |
| 003_notifications_and_updates.sql | projects に address/assigned_to 追加、notifications テーブル作成 |
