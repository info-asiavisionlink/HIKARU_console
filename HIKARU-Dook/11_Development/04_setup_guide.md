# 開発環境セットアップガイド

## 前提条件

| ツール | バージョン | 確認方法 |
|---|---|---|
| Node.js | ≥ 20.0.0 | `node -v` |
| npm | ≥ 10.0.0 | `npm -v` |
| Git | 最新推奨 | `git --version` |

外部サービス:
- **Supabase** アカウント（プロジェクト作成済み）
- **OpenAI** APIキー（GPT-4o へのアクセス権限）

---

## 1. リポジトリのクローン

```bash
git clone <repository-url>
cd HIKARU
```

---

## 2. 依存パッケージのインストール

```bash
# ルートで実行（npm workspaces が全パッケージを一括インストール）
npm install
```

---

## 3. 環境変数の設定

### HIKARU-System

```bash
cp HIKARU-System/.env.local.example HIKARU-System/.env.local
```

`.env.local` に以下を設定:

```env
# Supabase（SupabaseダッシュボードのSettings > APIから取得）
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # ← API Routesのみで使用

# OpenAI（https://platform.openai.com/api-keys から取得）
OPENAI_API_KEY=sk-...

# 他アプリURL（開発時）
NEXT_PUBLIC_CONSOLE_URL=http://localhost:3001
```

### HIKARU-CONSOLE

```bash
cp HIKARU-CONSOLE/.env.local.example HIKARU-CONSOLE/.env.local
```

`.env.local` に以下を設定:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_SYSTEM_URL=http://localhost:3000
```

---

## 4. Supabase データベースのセットアップ

### 4-1. マイグレーション実行

Supabaseダッシュボードの **SQL Editor** で、以下の順にマイグレーションファイルを実行:

```
supabase/migrations/
├── 001_create_profiles.sql       ← 最初に実行
├── 002_console_tables.sql
├── 003_notifications_and_updates.sql
├── 004_jobs_photos.sql
├── 005_chat_messages.sql
├── 006_ai_evaluations.sql
└── 007_reports.sql               ← 最後に実行
```

### 4-2. Supabase Storage のセットアップ

Supabaseダッシュボードの **Storage** で:
1. 「New bucket」をクリック
2. バケット名: `photos`
3. Public: **ON**（写真URLを公開するため）
4. 「Create」をクリック

---

## 5. 開発サーバーの起動

### 両アプリを同時に起動（推奨）

```bash
# ターミナル1 — 作業者システム (port 3000)
npm run dev:system

# ターミナル2 — 管理コンソール (port 3001)
npm run dev:console
```

### 個別起動

```bash
# 作業者システムのみ
cd HIKARU-System && npm run dev

# 管理コンソールのみ
cd HIKARU-CONSOLE && npm run dev
```

---

## 6. 初期管理者アカウントの作成

1. HIKARU-CONSOLE の `/login` からアカウント作成
2. Supabaseダッシュボードの **Authentication > Users** でメールアドレスを確認
3. SQL Editor で管理者ロールを付与:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'your-admin@example.com';
```

---

## 7. 動作確認チェックリスト

- [ ] `http://localhost:3001/login` でログインできる
- [ ] ダッシュボードにアクセスできる
- [ ] 顧客・店舗・案件を作成できる
- [ ] `http://localhost:3000/login` で作業者ログインできる
- [ ] 案件一覧が表示される
- [ ] Before写真を撮影・アップロードできる
- [ ] AI品質評価が実行できる
- [ ] AI報告書が生成できる

---

## トラブルシューティング

### `OPENAI_API_KEY is not configured` エラー

`.env.local` の `OPENAI_API_KEY` が正しく設定されているか確認。  
Next.js サーバーを再起動（`ctrl+C` → `npm run dev`）。

### `photos` バケットへのアップロードが失敗する

Supabase Storage の `photos` バケットが作成されているか確認。  
バケットのポリシーが `SELECT`, `INSERT`, `UPDATE` を許可しているか確認。

### RLS エラーが出る

プロファイルの `company_id` が設定されているか確認。  
`001_create_profiles.sql` のトリガーが正常に実行されているか確認。

### チャットのSSEストリームが機能しない

開発環境では Vercel Edge Runtime が使えないため、`runtime = 'nodejs'` の設定を確認。
