# セキュリティ方針（第10回更新・v1.0実装済み）

## 基本方針

このプロジェクトはGitHubで管理し、将来的に公開リポジトリで運用する可能性があります。  
そのため、**セキュリティを最優先**に設計します。

---

## 絶対禁止事項

| 禁止事項 | 理由 | 実装での対処 |
|---|---|---|
| APIキーのソースコードへの記述 | GitHub公開時に漏洩 | `.env.local`で管理 |
| `.env.local` のGitコミット | 同上 | `.gitignore`で除外 |
| フロントエンドからOpenAI API直接呼び出し | APIキーがブラウザに露出 | 全AI処理は`app/api/*`経由 |
| フロントエンドでService Role Keyを使用 | 全データへの無制限アクセス | HIKARU-System / CONSOLEとも未使用 |
| RLS無効のままテーブルを公開 | 全ユーザーが全データ閲覧可能 | 全7テーブルでRLS有効・確認済み |

---

## 環境変数の分類と管理

| 変数名 | 用途 | 公開範囲 |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI API認証 | サーバーサイドのみ（API Routes内） |
| `NEXT_PUBLIC_SUPABASE_URL` | SupabaseエンドポイントURL | 公開可（RLSで保護） |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase匿名認証キー | 公開可（RLSで保護） |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase管理者操作 | サーバーサイドのみ（API Routes内） |

### ルール
- `NEXT_PUBLIC_`プレフィックスのある変数のみクライアントで使用可
- それ以外は`app/api/*`のみで使用
- `.env.local`は`.gitignore`に必ず含める

---

## 実装済みセキュリティ対策

### 認証
- **Supabase Auth**（メールアドレス + パスワード）
- **JWTトークン**はSupabaseが管理・自動更新
- **middleware.ts**（両アプリ）でルーティング保護:
  - 未認証 → `/login` へリダイレクト
  - ロール不一致 → アクセス拒否

### 認可（ロールベースアクセス制御）

| ロール | アクセス可能 |
|---|---|
| `admin` | HIKARU-CONSOLE 全機能 |
| `worker` | HIKARU-System 作業者画面 |
| `client` | HIKARU-System クライアントポータル（v1.1） |

### Row Level Security (RLS)

全テーブルで有効化済み。主なポリシー:

```sql
-- 例: jobs テーブル
-- 作業者は自分のジョブのみ操作可能
worker_id = auth.uid()

-- 管理者は同一会社のデータのみ操作可能
public.is_admin_of(company_id)
```

データは `company_id` で完全に分離（マルチテナント対応）。

### API Routes 認証チェック

**全てのAPI Routeで実装済み**:

```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) {
  return Response.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: '認証が必要です' } },
    { status: 401 }
  )
}
```

### 入力値バリデーション

- フロントエンド: `utils/validation.ts` による入力値チェック
- API Routes: 必須パラメーターの存在チェック + 適切なエラーレスポンス
- Supabase: スキーマレベルのバリデーション（NOT NULL, CHECK制約等）

### XSS対策

- Next.js のReact JSX は自動エスケープ
- AIコメントの表示は `dangerouslySetInnerHTML` 不使用（テキストとして表示）
- Markdown表示箇所: `marked` ライブラリは設定で安全モード適用

### ファイルアップロードのセキュリティ

| 項目 | ルール | 実装 |
|---|---|---|
| 許可ファイル形式 | 写真: jpg/png/webp | PhotoCapture.tsx で accept制限 |
| ファイルサイズ上限 | 写真: 10MB | Storage設定で制限 |
| ファイル名 | タイムスタンプ付きパス | `${jobId}/${type}/${spotId}_${Date.now()}.${ext}` |
| 元ファイル名 | 使用しない | Storage path はサーバー側で生成 |

---

## カメラ権限

- カメラAPIはHTTPS環境でのみ動作（本番はHTTPS必須）
- 権限要求のタイミングはユーザーアクション時（撮影ボタンタップ後）

---

## セキュリティチェックリスト（デプロイ時）

- [ ] `.env.local` が `.gitignore` に含まれている
- [ ] 全テーブルでRLSが有効
- [ ] `OPENAI_API_KEY` が本番環境変数に設定済み
- [ ] `SUPABASE_SERVICE_ROLE_KEY` がサーバーサイドのみで使用
- [ ] HTTPS が有効（カメラAPI要件）
- [ ] Supabase Storage の photos バケットが適切な権限設定

---

## Gitセキュリティ

```
# .gitignore に必ず含めること
.env
.env.local
.env.*.local
```
