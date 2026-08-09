# 運用マニュアル — HIKARU Version 1.0

## 本番環境チェックリスト

### デプロイ前の確認事項

- [ ] `.env.local` が `.gitignore` に含まれていること
- [ ] 本番用環境変数がホスティングプラットフォームに設定済みであること
- [ ] `NEXT_PUBLIC_SUPABASE_URL` が本番用URLを指していること
- [ ] Supabase RLS が全テーブルで有効になっていること
- [ ] Storage バケット `photos` が作成済みであること
- [ ] HTTPS が有効であること（Camera API は HTTPS 必須）

### 本番環境変数（ホスティングプラットフォームに設定）

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
```

---

## 日常運用タスク

### 新規クライアント（オーナー）の追加

1. HIKARU-CONSOLE `/clients/new` で顧客を作成
2. `/stores/new` で店舗を登録（顧客に紐付け）
3. `/stores/[id]` で撮影箇所を設定
4. `/projects/new` で案件を作成（店舗に紐付け）
5. `/workers/new` で作業者アカウントを招待

### 新規作業者の追加

1. HIKARU-CONSOLE `/workers/new` でメールアドレスを入力
2. 作業者宛てに招待メールが送信される（Supabase Auth）
3. 作業者がパスワードを設定してログイン
4. 必要に応じて担当案件を `/projects` で設定

### 撮影箇所の変更

1. `/stores/[id]` → 「撮影箇所」タブ
2. 箇所の追加・削除・並び替え・必須/任意の切り替えが可能
3. 変更は即時反映（次回の作業から有効）

---

## AI機能の運用

### OpenAI APIの利用状況確認

https://platform.openai.com/usage でトークン使用量を確認。  
月次予算アラートを設定することを推奨。

### AIコメントの品質が低い場合

`modules/*/prompts.ts` のプロンプトを調整する。  
モデルを変更する場合は `packages/lib/src/openai/client.ts` の `OPENAI_MODELS` を編集。

```typescript
export const OPENAI_MODELS = {
  CHAT:    'gpt-4o',    // ← モデル名を変更
  VISION:  'gpt-4o',
  REPORT:  'gpt-4o',
  ANALYZE: 'gpt-4o',
}
```

---

## データ管理

### バックアップ

Supabase は日次自動バックアップを提供（Free Planは7日間保持）。  
重要データは定期的に CSV エクスポートすることを推奨。

Supabaseダッシュボード → **Database** → **Backups**

### データ削除ポリシー

- 案件削除 → 紐付く全データが CASCADE DELETE（photos, jobs, reports等）
- 顧客削除 → 店舗・案件も含めて削除
- ユーザー削除 → プロフィールのみ（作業履歴は残す）

### Storage容量管理

写真は `photos/{jobId}/{type}/{spotId}_{timestamp}.{ext}` に保存。  
古い写真の削除は手動対応（将来: 自動クリーンアップを追加予定）。

---

## 障害対応

### AIエラーが続く場合

1. OpenAI API ダッシュボードでサービス状態を確認: https://status.openai.com
2. API キーの利用制限・残高を確認
3. レート制限の場合はしばらく待機（指数バックオフ実装済み）

### ログインできない場合

1. Supabaseダッシュボード → **Authentication** → **Users** でアカウント確認
2. メール確認が未完了の場合は「Confirm user」
3. パスワードリセットは `/forgot-password` から実行

### 写真がアップロードできない場合

1. Supabase Storage の `photos` バケットが存在するか確認
2. バケットのアクセスポリシーを確認
3. Storage容量の上限に達していないか確認（Supabaseダッシュボード）

---

## セキュリティ運用

### APIキーのローテーション

OpenAI APIキーは定期的（3〜6ヶ月）にローテーションを推奨。  
手順:
1. OpenAI ダッシュボードで新しいキーを生成
2. ホスティング環境変数を更新
3. デプロイ
4. 古いキーを削除

### 不審なアクセスの発見

Supabaseダッシュボード → **Auth** → **Users** でログイン履歴を確認。  
異常を発見した場合は該当ユーザーを無効化。

---

## パフォーマンス監視

### 確認すべき指標

| 指標 | 確認場所 |
|---|---|
| API レスポンス時間 | ブラウザ DevTools Network タブ |
| OpenAI API レイテンシ | platform.openai.com/usage |
| Supabase DB パフォーマンス | ダッシュボード → Database → Performance |
| Storage 使用量 | ダッシュボード → Storage |

### 最適化のポイント

- AI評価は一括実行（evaluate-all）を使用して API呼び出し回数を最小化
- 報告書は再生成より既存バージョンを再利用
- 分析ダッシュボードは必要時のみ AI 分析を実行（ボタン押下式）

---

## 定期メンテナンス

| 頻度 | タスク |
|---|---|
| 週次 | Supabase バックアップ確認・OpenAI 使用量確認 |
| 月次 | APIキー有効期限確認・Storage 使用量確認 |
| 四半期 | APIキーローテーション・不要ユーザー削除 |
| 年次 | セキュリティレビュー・依存パッケージ更新 |
