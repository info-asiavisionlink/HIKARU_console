# データベース設計（Supabase）

## 設計原則

- Supabaseはデータ保存専用（利用者は直接操作しない）
- すべてのCRUD操作はAPI Routesを経由する
- RLS（Row Level Security）を全テーブルに設定する

---

## テーブル一覧

### users（ユーザー）
Supabase Authと連携。

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid (PK) | Supabase Auth UID |
| email | text | メールアドレス |
| name | text | 表示名 |
| role | enum | admin / worker / client |
| created_at | timestamp | 作成日時 |

---

### companies（会社・組織）
清掃会社（管理者が属する組織）

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid (PK) | |
| name | text | 会社名 |
| logo_url | text | ロゴURL |
| created_at | timestamp | |

---

### clients（クライアント）
清掃を依頼する企業・個人

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid (PK) | |
| company_id | uuid (FK) | 所属する清掃会社 |
| name | text | クライアント名 |
| email | text | 連絡先メール |
| created_at | timestamp | |

---

### stores（店舗）
清掃対象の施設

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid (PK) | |
| client_id | uuid (FK) | オーナークライアント |
| name | text | 店舗名 |
| address | text | 住所 |
| created_at | timestamp | |

---

### projects（案件）
店舗に対する清掃契約・案件

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid (PK) | |
| store_id | uuid (FK) | 対象店舗 |
| name | text | 案件名 |
| description | text | 概要 |
| status | enum | active / paused / completed |
| created_at | timestamp | |

---

### locations（撮影場所）
案件ごとの写真撮影箇所

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid (PK) | |
| project_id | uuid (FK) | 所属案件 |
| name | text | 場所名（入口・床・トイレ等） |
| order | int | 表示順 |
| is_required | boolean | 必須撮影かどうか |
| created_at | timestamp | |

---

### manuals（マニュアル・資料）
案件に紐づく教育資料

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid (PK) | |
| project_id | uuid (FK) | 所属案件 |
| type | enum | pdf / text / image / video / faq |
| title | text | タイトル |
| content | text | テキスト内容（typeがtextの場合） |
| file_url | text | ファイルURL（Storage） |
| created_at | timestamp | |

---

### jobs（作業）
特定日・案件の1回の清掃作業

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid (PK) | |
| project_id | uuid (FK) | 対象案件 |
| worker_id | uuid (FK) | 担当作業者 |
| scheduled_date | date | 予定日 |
| status | enum | pending / in_progress / completed / cancelled |
| started_at | timestamp | 作業開始時刻 |
| completed_at | timestamp | 作業完了時刻 |
| created_at | timestamp | |

---

### photos（写真）
Before/After写真

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid (PK) | |
| job_id | uuid (FK) | 所属作業 |
| location_id | uuid (FK) | 撮影場所 |
| type | enum | before / after |
| url | text | Storage URL |
| is_valid | boolean | AI品質チェック結果 |
| quality_issues | text[] | 品質問題のリスト |
| created_at | timestamp | |

---

### ai_evaluations（AI評価）
Before/After比較評価の結果

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid (PK) | |
| job_id | uuid (FK) | 所属作業 |
| location_id | uuid (FK) | 撮影場所 |
| before_photo_id | uuid (FK) | Before写真 |
| after_photo_id | uuid (FK) | After写真 |
| score | int | 総合スコア（0〜100） |
| dirty_removal | int | 汚れ除去スコア |
| oil_stain | int | 油汚れスコア |
| dust | int | ホコリスコア |
| shine | int | 艶・清潔感スコア |
| passed | boolean | 合格/不合格 |
| comment | text | AIコメント |
| recommendation | enum | pass / check / redo |
| created_at | timestamp | |

---

### reports（報告書）
作業完了後に生成される報告書

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid (PK) | |
| job_id | uuid (FK) | 対象作業 |
| status | enum | draft / submitted |
| total_score | int | 総合品質スコア |
| ai_summary | text | AIが生成した作業サマリー |
| worker_notes | text | 作業者の特記事項 |
| pdf_url | text | PDF Storage URL |
| submitted_at | timestamp | 提出日時 |
| created_at | timestamp | |

---

### chat_history（チャット履歴）
AIマニュアルのチャット記録

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid (PK) | |
| job_id | uuid (FK) | 所属作業 |
| worker_id | uuid (FK) | 質問者 |
| role | enum | user / assistant |
| content | text | メッセージ内容 |
| sources | text[] | 参照マニュアル名 |
| created_at | timestamp | |

---

## リレーション図

```
companies
  └── users（workers/admins）
  └── clients
        └── stores
              └── projects
                    ├── locations
                    ├── manuals
                    └── jobs
                          ├── photos
                          ├── ai_evaluations
                          ├── reports
                          └── chat_history
```
