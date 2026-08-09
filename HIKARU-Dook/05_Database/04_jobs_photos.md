# HIKARU データベース構造（作業・写真テーブル）

## jobs（作業セッション）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID | PK |
| project_id | UUID | FK → projects |
| worker_id | UUID | FK → profiles |
| company_id | UUID | FK → companies |
| status | TEXT | in_progress / completed / cancelled |
| work_date | DATE | 作業日（DEFAULT: 今日） |
| started_at | TIMESTAMPTZ | 作業開始日時 |
| completed_at | TIMESTAMPTZ | 作業完了日時 |
| notes | TEXT | 作業メモ |

**UNIQUE制約:** `(project_id, worker_id, work_date)` WHERE status != 'cancelled'
→ 1日1プロジェクトにつき1セッションのみ

---

## photos（写真）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID | PK |
| job_id | UUID | FK → jobs |
| spot_id | UUID | FK → photo_spots（NULLは自由撮影） |
| photo_type | TEXT | 'before' / 'after' |
| storage_path | TEXT | Supabase Storage パス |
| url | TEXT | 公開URL |
| created_at | TIMESTAMPTZ | 撮影日時 |

**UNIQUE制約:** `(job_id, spot_id, photo_type)` WHERE spot_id IS NOT NULL
→ 同一スポット・同一タイプは上書き（upsert）

---

## RLS ポリシー

| テーブル | ポリシー | 内容 |
|---|---|---|
| jobs | worker own CRUD | 自分のジョブのみ操作可 |
| jobs | admin read company | 同一会社の管理者は参照可 |
| photos | worker own CRUD | 自分のジョブの写真のみ操作可 |
| photos | admin read company | 同一会社の管理者は参照可 |

---

## マイグレーション

| ファイル | 内容 |
|---|---|
| 004_jobs_photos.sql | jobs・photos テーブル作成 + RLS設定 |

---

## Supabase Storage

| バケット | 公開設定 | パス形式 |
|---|---|---|
| photos | Public推奨 | `{job_id}/{type}/{spot_id}_{timestamp}.{ext}` |

手動でSupabaseダッシュボードから作成が必要。
