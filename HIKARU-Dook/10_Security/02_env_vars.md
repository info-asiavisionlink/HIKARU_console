# 環境変数一覧

## .env.example（リポジトリに含める）

```bash
# ==============================
# OpenAI
# ==============================
OPENAI_API_KEY=

# ==============================
# Supabase（公開可）
# ==============================
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# ==============================
# Supabase（サーバーサイド専用）
# ==============================
SUPABASE_SERVICE_ROLE_KEY=

# ==============================
# アプリ設定
# ==============================
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 変数詳細

| 変数名 | 取得場所 | 用途 | 必須 |
|---|---|---|---|
| `OPENAI_API_KEY` | OpenAI Dashboard | AI全機能の認証 | ✅ |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Settings > API | SupabaseエンドポイントURL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase > Settings > API | Supabase匿名認証 | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Settings > API | サーバー側管理者操作 | ✅ |
| `NEXT_PUBLIC_APP_URL` | 手動設定 | リダイレクトURL等 | ✅ |

---

## 環境別設定

| 環境 | ファイル | 説明 |
|---|---|---|
| ローカル開発 | `.env.local` | 開発用の値を設定 |
| 本番 | Vercel/サーバーの環境変数設定画面 | ソースコードには含めない |

---

## セキュリティルール

1. `.env.local` は **絶対にGitにコミットしない**
2. `SUPABASE_SERVICE_ROLE_KEY` は `app/api/*` 内のサーバーサイドのみで使用
3. `OPENAI_API_KEY` は `app/api/*` 内のサーバーサイドのみで使用
4. `NEXT_PUBLIC_`プレフィックスの変数はクライアントサイドに公開される前提で値を設定する
