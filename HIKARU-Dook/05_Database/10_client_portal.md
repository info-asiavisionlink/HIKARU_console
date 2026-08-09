# Client Portal DB設計・権限・RLS

## 概要

顧客ポータル（HIKARU-customer portal）向けのデータベース設計。  
顧客は自社案件のみ閲覧でき、RLSにより他社データへのアクセスは完全に遮断される。

---

## 新規テーブル

### `client_portal_accounts`（ポータルアカウント）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| profile_id | UUID FK → profiles.id | Supabase auth連携 |
| company_id | UUID FK → companies.id | 清掃会社のID |
| client_id | UUID FK → clients.id | どの顧客会社か |
| login_id | TEXT | CLT-0001 形式 |
| contact_name | TEXT | 担当者名 |
| is_active | BOOLEAN | アカウント有効フラグ |
| last_login_at | TIMESTAMPTZ | 最終ログイン日時 |

**インターナルメール形式**: `clt-0001@hikaru.client`（Supabase auth用）

---

### `client_project_permissions`（案件閲覧権限）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| portal_account_id | UUID FK | |
| project_id | UUID FK → projects.id | |
| can_view_reports | BOOLEAN | 報告書閲覧権限 |
| can_view_photos | BOOLEAN | 写真閲覧権限 |
| can_view_timeline | BOOLEAN | タイムライン閲覧権限 |
| can_download_pdf | BOOLEAN | PDF DL権限 |

---

### `client_notifications`（顧客通知）

| カラム | 型 | 通知タイプ |
|---|---|---|
| type | TEXT | `job_started` / `job_completed` / `report_ready` / `quality_evaluated` / `redo_requested` / `info` |
| is_read | BOOLEAN | 既読フラグ |
| job_id / project_id | UUID | 関連エンティティ |

---

### `report_views`（報告書閲覧記録）

閲覧済み・未読を管理するための履歴テーブル。  
`UNIQUE(portal_account_id, report_id)` → 重複カウント防止、`view_count`でupsert。

---

## ER図（主要関係）

```
companies
  └─ clients ──────────────── client_portal_accounts
                                     │
                                     ├─ profiles (auth.users)
                                     └─ client_project_permissions
                                              │
                                              └─ projects
                                                   ├─ jobs
                                                   │   ├─ photos ── ai_evaluations
                                                   │   └─ reports
                                                   └─ stores
```

---

## ヘルパー関数

```sql
-- 顧客が対象案件のアクセス権を持つか確認
is_client_with_project_access(target_project_id UUID) → BOOLEAN

-- 現在のユーザーのポータルアカウントIDを返す
my_portal_account_id() → UUID
```

---

## RLS設計

### 顧客（role='client'）がアクセスできるデータ

| テーブル | アクセス範囲 |
|---|---|
| projects | `client_project_permissions`に登録された案件のみ |
| jobs | 上記案件に紐づくジョブのみ |
| photos | 上記ジョブの写真のみ |
| ai_evaluations | 上記ジョブのAI評価のみ |
| reports | 上記案件の報告書のみ（`can_view_reports=true`の場合） |
| client_notifications | 自分宛の通知のみ（読み取り・既読更新） |
| report_views | 自分の閲覧記録のみ（CRUD） |
| client_portal_accounts | 自分のアカウントのみ（SELECT） |

### 管理者（role='admin'）がアクセスできるデータ

- `client_portal_accounts`: 同一会社の全アカウントをCRUD
- `client_project_permissions`: 同一会社のアカウントに紐づく権限をCRUD
- `client_notifications`: 同一会社の顧客へ通知をINSERT

---

## マイグレーション

`supabase/migrations/016_client_portal.sql`

---

# Client Portal 画面構成

## ページ一覧

| パス | 説明 |
|---|---|
| `/login` | ログインページ（CLT-0001形式ID） |
| `/dashboard` | ダッシュボード（統計・最新情報） |
| `/projects` | 閲覧可能案件一覧 |
| `/projects/[id]` | 案件詳細（タイムライン・写真・AI評価）+ Realtime |
| `/reports` | 報告書履歴（検索・期間指定） |
| `/reports/[id]` | 報告書詳細（スコア・写真・AI評価・コメント） |
| `/reports/[id]/print` | PDF印刷用ページ |
| `/notifications` | 通知一覧（Realtimeで自動更新） |

---

# Supabase Realtime構成

## チャンネル設計

### 案件詳細ページ（`project-{projectId}`）

| テーブル | イベント | フィルター | 用途 |
|---|---|---|---|
| photos | INSERT / UPDATE | `job_id=eq.{jobId}` | 写真アップロード時に即反映 |
| jobs | ALL | `project_id=eq.{projectId}` | 作業開始・完了をリアルタイム表示 |
| reports | INSERT | `project_id=eq.{projectId}` | 報告書生成完了を即通知 |
| ai_evaluations | INSERT | なし（写真再取得でカバー） | AI評価完了を反映 |

### 通知ページ（`notifications-page`）

| テーブル | イベント | 用途 |
|---|---|---|
| client_notifications | INSERT | 新規通知をリアルタイム追加 |
| client_notifications | UPDATE | 既読状態を即反映 |

---

# 通知フロー

## 作業者の操作 → 顧客通知の流れ

```
作業者がHIKARU-System で操作
  │
  ├─ 作業開始     → jobs.INSERT(status='in_progress')
  │                → client_notifications INSERT(type='job_started')
  │
  ├─ 写真撮影     → photos.INSERT
  │                → (Realtime: 顧客画面に即時反映)
  │
  ├─ AI品質評価   → ai_evaluations.INSERT
  │                → client_notifications INSERT(type='quality_evaluated')
  │                → (Realtime: 品質スコアが顧客画面に反映)
  │
  ├─ 作業完了     → jobs.UPDATE(status='completed')
  │                → client_notifications INSERT(type='job_completed')
  │
  └─ 報告書生成   → reports.INSERT
                   → client_notifications INSERT(type='report_ready')
                   → report_views で既読管理開始
```

**実装注意**: 現時点の通知INSERT は `service_role` または管理者が行う。  
将来的には Supabase Edge Functions を使って自動トリガーする予定。

---

# API設計（CONSOLE側）

## 顧客ポータルアカウントAPI

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/api/client-accounts` | アカウント一覧取得 |
| POST | `/api/client-accounts` | アカウント新規発行 |
| GET | `/api/client-accounts/[id]` | アカウント詳細 |
| PATCH | `/api/client-accounts/[id]` | アカウント更新（担当者名・パスワード・案件権限） |
| DELETE | `/api/client-accounts/[id]` | アカウント削除（auth user削除 → cascade） |

### POSTリクエスト例

```json
{
  "loginId": "CLT-0001",
  "password": "password123",
  "contactName": "山田 太郎",
  "email": "yamada@example.com",
  "clientId": "<client_uuid>",
  "projectIds": ["<project_uuid_1>", "<project_uuid_2>"],
  "permissions": {
    "<project_uuid_1>": {
      "reports": true,
      "photos": true,
      "timeline": true,
      "pdf": true
    }
  }
}
```

---

# UI設計方針（Client Portal）

## カラー

| 要素 | 色 |
|---|---|
| 背景 | `oklch(0.06 0.004 260)` — 深い漆黒 |
| ゴールド（ブランド） | `oklch(0.73 0.12 78)` |
| テキスト | `oklch(0.95 0.008 75)` |
| 成功・合格 | `oklch(0.72 0.18 150)` — グリーン |
| 警告・要確認 | `oklch(0.73 0.12 78)` — ゴールド |
| エラー・再清掃 | `oklch(0.65 0.25 27)` — レッド |

## 設計思想

- CONSOLEのHudBackground/パーティクルなし → より落ち着いた高級感
- 大きなスコア表示でAI評価を一目で確認
- タイムラインは縦線＋ドットで視覚的な進捗表示
- LIVE バッジで Realtime 接続中を明示
- 未読報告書はゴールドドットで強調

---

# 拡張性

今後追加予定の機能に備えた設計：

| 機能 | 対応方針 |
|---|---|
| 請求書閲覧 | `invoices` テーブル + `client_project_permissions.can_view_invoices` |
| 契約書・見積書 | `documents` テーブル（type: contract / quote / invoice） |
| メッセージ | `client_messages` テーブル（portal_account_id → profile_id） |
| お知らせ | `announcements` テーブル（company_id ブロードキャスト） |
| 多言語対応 | i18n対応（英語・中国語など） |
| Push通知 | Web Push API / FCM |
