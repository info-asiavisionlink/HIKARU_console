# 認証・権限管理設計

## 技術スタック

| レイヤー | 技術 |
|---|---|
| 認証基盤 | Supabase Authentication |
| セッション管理 | `@supabase/ssr`（Server Side Rendering対応） |
| フレームワーク | Next.js 15 App Router |
| 権限チェック | Middleware（Edge）+ Server Components |
| DB セキュリティ | Row Level Security（RLS） |

---

## ユーザー権限（UserRole）

```typescript
type UserRole = 'admin' | 'worker' | 'client'
```

| ロール | 説明 | アクセス先 |
|---|---|---|
| `admin` | 管理者 | HIKARU-CONSOLE（/dashboard 等） |
| `worker` | 清掃作業者 | HIKARU-System（/jobs 等） |
| `client` | オーナー（閲覧のみ） | HIKARU-System（/client 等） |

### 将来のロール追加
`user_role` Enum を拡張し、DB移行 + 権限チェックロジックを追加するだけで対応可能。

---

## ユーザープロフィール構造

```sql
profiles テーブル（auth.users を拡張）
  id            UUID     -- auth.users.id と同一
  email         TEXT     -- メール���ドレス
  name          TEXT     -- 氏名
  role          user_role -- 権限（admin/worker/client）
  company_id    UUID     -- 所属会社（FK: companies.id）
  phone         TEXT     -- 電話番号（任意）
  avatar_url    TEXT     -- プロフィール画像URL
  last_login_at TIMESTAMPTZ -- 最終ログイン日��
  created_at    TIMESTAMPTZ
  updated_at    TIMESTAMPTZ
```

**自動処理:**
- 新規ユーザー作成 → `handle_new_user()` トリガーで profiles を自動作成
- ログイン → `last_login_at` を更新（アクション内で実行）

---

## 認証フロー

### ログイン
```
1. ユーザーがメール/パスワードを入力
2. Server Action: supabase.auth.signInWithPassword()
3. 成功 → profiles.role を確認
4. role = admin  → CONSOLE /dashboard へリダイレクト
   role = worker → System /jobs へリダイレクト
   role = client → System /client へリダイレクト
5. last_login_at を更新
```

### セッション管理
```
- Supabase が JWT Cookie を発行・管理
- middleware.ts が毎リクエストで supabase.auth.getUser() を呼び出し
  → Cookie を自動更新（リフレッシュトークン対応）
- セッション期限: Supabase デフォルト（1週間）
```

### パスワードリセット
```
1. /forgot-password でメールを入力
2. supabase.auth.resetPasswordForEmail() → メール送信
3. ユーザーがメール内リンクをクリック
4. /reset-password へリダイレクト（Supabase がトークンを Cookie に設定）
5. 新パスワードを入力 → supabase.auth.updateUser()
6. 完了 → ダッシュボードへリダイレクト
```

### ログアウト
```
supabase.auth.signOut() → Cookie 削除 → /login へリダイレクト
```

---

## 認証ガード（多層防御）

### 層1: Middleware（エッジ）
```
リクエスト → middleware.ts
  ↓
supabase.auth.getUser() でセッション検証
  ↓
未認証 → /login へリダイレクト
認証済み → profiles.role を確認
  ↓
CONSOLE: admin 以外 → System へリダイレクト
System:  admin → CONSOLE へリダイレクト
```

### 層2: Server Component（ページレベル）
```typescript
// 各ページで明示的に権限チェック
export default async function Page() {
  await requireAdmin()   // CONSOLE用
  await requireWorker()  // System用
  // ...
}
```

### 層3: API Routes
```typescript
// /api/* は全て認証チェック
const user = await getServerUser()
if (!user) return apiError('UNAUTHORIZED', '認証が必要です', 401)
```

### 層4: RLS（データベース）
```sql
-- profiles: 自分のプロフィールのみ参照・更新
-- 管理者は同一会社のプロフィールを管理可能
```

---

## ルーティング設計

### HIKARU-System（localhost:3000）
| パス | アクセス可能ロール | 説明 |
|---|---|---|
| /login | 全員 | ログインページ |
| /forgot-password | 全員 | パスワードリセット |
| /reset-password | 全員 | 新パスワード設定 |
| /jobs/* | worker | 作業フロー |
| /client/* | client | オーナーポータル |

### HIKARU-CONSOLE（localhost:3001）
| パス | アクセス可能ロール | 説明 |
|---|---|---|
| /login | 全員 | 管理者ログイン |
| /dashboard | admin | ダッシュボード |
| /projects/* | admin | 案件管理 |
| /clients/* | admin | クライアント管理 |
| /workers/* | admin | 作業者管理 |
| /analytics/* | admin | AI分析 |

---

## セキュリティ原則

1. **APIキーはサーバーサイドのみ** — `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` はブラウザに露出しない
2. **二重認証チェック** — Middleware + Server Component の両方でチェック
3. **RLS必須** — Supabaseの全テーブルに RLS を有効化
4. **セキュアCookie** — Supabase SSR が自動的に HttpOnly/Secure Cookie を設定
5. **HTTPS必須** — 本番環境は必ずHTTPS

---

## 環境変数（認証関連）

```bash
# Supabase（公開可）
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Supabase（サーバーサイドのみ）
SUPABASE_SERVICE_ROLE_KEY=

# アプリ間ルーティング
NEXT_PUBLIC_SYSTEM_URL=http://localhost:3000
NEXT_PUBLIC_CONSOLE_URL=http://localhost:3001
```

---

## 初期セットアップ手順

1. Supabase でプロジェクトを作成
2. SQL Editor で `supabase/migrations/001_create_profiles.sql` を実行
3. Supabase Authentication > URL Configuration を設定
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/reset-password`, `http://localhost:3001/reset-password`
4. 初期管理者アカウントを Supabase Dashboard > Authentication から作成
   - User Metadata に `{"role": "admin", "name": "管理者名"}` を設定
5. `.env.local` に環境変数を設定して起動
