# API設計概要（第10回更新・実装済み版）

## 設計原則

- すべてのAPIはNext.js App RouterのRoute Handlers（`app/api/*`）で実装
- フロントエンドからOpenAI APIを直接呼び出すことは**禁止**
- `OPENAI_API_KEY`・`SUPABASE_SERVICE_ROLE_KEY`はAPI Routes内のみ使用
- すべてのAPIエンドポイントで`supabase.auth.getUser()`による認証チェックを実施
- レスポンス形式は統一フォーマット（成功/エラー）を使用

---

## 統一レスポンス形式

```typescript
// 成功
{ "success": true, "data": { ... } }

// エラー
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_ERROR" | "AI_ERROR" | "INTERNAL_ERROR",
    "message": "エラー説明"
  }
}
```

---

## エンドポイント一覧（実装済み）

### HIKARU-System（作業者アプリ）

#### AI系

| メソッド | パス | 機能 | 認証 |
|---|---|---|---|
| GET | /api/ai/manual?jobId=xxx | チャット履歴取得 | ✅ worker |
| POST | /api/ai/manual | AIマニュアルチャット（SSEストリーミング） | ✅ worker |
| POST | /api/ai/quality | 写真品質チェック/Before-After評価/一括評価 | ✅ worker |
| GET | /api/ai/quality?jobId=xxx | 評価結果一覧取得 | ✅ worker |
| POST | /api/ai/report | AI報告書生成・DB保存 | ✅ worker |
| GET | /api/ai/report?jobId=xxx | 報告書履歴一覧 | ✅ worker |
| GET | /api/ai/report?reportId=xxx | 報告書詳細取得 | ✅ worker |

#### 作業系

| メソッド | パス | 機能 | 認証 |
|---|---|---|---|
| GET | /api/jobs | 本日作業一覧取得 | ✅ worker |
| POST | /api/jobs | 作業（job）作成 | ✅ worker |
| POST | /api/photos | 写真メタデータ登録 | ✅ worker |

---

### HIKARU-CONSOLE（管理者アプリ）

#### AI分析系

| メソッド | パス | 機能 | 認証 |
|---|---|---|---|
| GET | /api/ai/analyze?type=overview | 全体サマリーAI分析 | ✅ admin |
| GET | /api/ai/analyze?type=store&id=xxx | 店舗別AI分析 | ✅ admin |
| GET | /api/ai/analyze?type=worker&id=xxx | 作業者別AIフィードバック | ✅ admin |
| GET | /api/ai/analyze?type=trends | 時系列トレンドAI解説 | ✅ admin |

#### 案件管理系（Route Handlers）

定期・ホテル案件はRoute Handlersで実装（`getAuthContext`で認証・会社フィルタ自動付与）。

| メソッド | パス | 機能 | 認証 |
|---|---|---|---|
| GET | /api/projects/recurring | 定期案件一覧（検索・ステータスフィルター・ページネーション） | ✅ admin |
| POST | /api/projects/recurring | 定期案件新規登録（詳細・月次スケジュール・担当者を一括登録） | ✅ admin |
| GET | /api/projects/recurring/[id] | 定期案件詳細（月次スケジュール・担当者含む） | ✅ admin |
| PATCH | /api/projects/recurring/[id] | 定期案件更新（月次スケジュール・担当者の一括置換を含む） | ✅ admin |
| DELETE | /api/projects/recurring/[id] | 定期案件論理削除（status=cancelled） | ✅ admin |
| GET | /api/projects/hotel | ホテル案件一覧（検索・ステータスフィルター・ページネーション） | ✅ admin |
| POST | /api/projects/hotel | ホテル案件新規登録（詳細・フロア・稼働・エリア・担当者を一括登録） | ✅ admin |
| GET | /api/projects/hotel/[id] | ホテル案件詳細（フロア・稼働・エリア・担当者含む） | ✅ admin |
| PATCH | /api/projects/hotel/[id] | ホテル案件更新 | ✅ admin |
| DELETE | /api/projects/hotel/[id] | ホテル案件論理削除 | ✅ admin |
| GET | /api/projects/[id]/pricing | 案件の単価・請求情報取得 | ✅ admin |
| PUT | /api/projects/[id]/pricing | 案件の単価・請求情報一括更新（prices全削除→再登録） | ✅ admin |
| PUT | /api/projects/[id]/assignments | 案件担当者一括更新（従業員・協力業者） | ✅ admin |

> **注意**: 単発案件（spot）は`/api/projects/spot/[id]`（一覧はサービス経由）

#### その他管理系（Supabase直接クライアント）

| 画面 | サービス | Supabase操作 |
|---|---|---|
| 顧客管理 | clients.service.ts | clients テーブルCRUD |
| 店舗管理 | stores.service.ts | stores テーブルCRUD |
| ユーザー管理 | users.service.ts | profiles テーブルCRUD |
| マニュアル管理 | manuals.service.ts | manuals テーブルCRUD |
| 報告書管理 | reports.service.ts | reports テーブル参照 |
| 分析 | analytics.service.ts | 複数テーブル集計 |
| ダッシュボード | dashboard.service.ts | 複数テーブル件数集計 |

---

## AI POST /api/ai/quality のアクション詳細

```
Body: { action: 'check' | 'evaluate' | 'evaluate-all', ... }

- action: 'check'        → 写真1枚の品質チェック（ブレ・露出等）
- action: 'evaluate'     → Before/After比較評価（スコア・判定生成）
- action: 'evaluate-all' → job内の全撮影箇所を一括評価
```

---

## 認証フロー

```
リクエスト受信
    ↓
supabase.auth.getUser() でセッション確認
    ↓
user == null → 401 UNAUTHORIZED
    ↓
Supabase RLS により company_id フィルタリング（自動）
    ↓
処理実行
    ↓
レスポンス返却
```

---

## エラーコード一覧

| コード | HTTP | 意味 | 対処 |
|---|---|---|---|
| UNAUTHORIZED | 401 | 未認証 | ログインしてください |
| FORBIDDEN | 403 | 権限なし | 管理者に連絡 |
| NOT_FOUND | 404 | リソースなし | IDを確認 |
| VALIDATION_ERROR | 400 | 入力値不正 | リクエストを確認 |
| AI_ERROR | 500 | OpenAI APIエラー | 再試行 / APIキー確認 |
| INTERNAL_ERROR | 500 | サーバーエラー | ログを確認 |

---

## 将来追加予定エンドポイント

| メソッド | パス | 機能 |
|---|---|---|
| GET | /api/reports/client/[storeId] | クライアント向け報告書一覧 |
| POST | /api/ai/report/submit | 報告書提出・クライアント通知 |
| POST | /api/notifications/send | プッシュ通知送信 |
| GET | /api/analytics/export | CSV/Excel出力 |
| POST | /api/ai/analyze/monthly | 月次自動レポート生成 |
