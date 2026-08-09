# アーキテクチャ決定記録（ADR）

## ADR-001: npm workspaces によるモノレポ構成

**決定**: npm workspacesを使ったモノレポ構成を採用

**理由**:
- HIKARU-SystemとHIKARU-CONSOLEが型定義・ユーティリティを共有できる
- 将来的に追加アプリ（LPなど）も同一ワークスペースで管理できる
- `@hikaru/types`・`@hikaru/lib`のバージョン管理が一元化される

**代替案**: 完全分離（各アプリで型を複製）
**却下理由**: 型の不一致が発生するリスクが高く、保守コストが増大する

---

## ADR-002: TypeScript パスエイリアス

**決定**: `@/*` でアプリルートを参照、`@hikaru/*` で共有パッケージを参照

```typescript
// ✅ 正しい使い方
import { useAsync } from '@/hooks/useAsync'
import type { Job } from '@hikaru/types'

// ❌ 使わない
import { useAsync } from '../../../hooks/useAsync'
```

**理由**: 相対パスは深いネストで読みにくくなる。エイリアスで統一する。

---

## ADR-003: サーバー/クライアント責務の分離

**決定**: OpenAI APIとSupabase Service Roleは必ずサーバーサイドで処理

```
フロントエンド（'use client'）
  → /api/* へfetch
  → APIルート内でOpenAI / Supabase Service Role を呼び出す
```

**理由**: APIキーをブラウザに露出させないセキュリティ要件

---

## ADR-004: AIモジュールの独立設計

**決定**: AI機能は`modules/`ディレクトリで独立したモジュールとして実装

```
modules/
├── manual-ai/    ← OpenAI呼び出しのみ担当
├── quality-ai/   ← OpenAI Vision呼び出しのみ担当
├── report-ai/    ← 文書生成のみ担当
└── analyze-ai/   ← 分析のみ担当
```

**理由**:
- OpenAIモデルの変更を各モジュール内で吸収できる
- APIルートはモジュールを呼び出すだけで薄く保てる
- テスト・差し替えが容易

---

## ADR-005: Tailwind CSS v4の採用

**決定**: Tailwind CSS v4 + `@tailwindcss/postcss`を使用

```css
/* globals.css */
@import "tailwindcss";

@theme {
  --color-primary: oklch(0.5 0.2 240);
}
```

**理由**: Next.js 15との相性が良く、CSS変数ベースのテーマ管理が容易

**注意**: `tailwind.config.ts`は不要（v4ではCSSで設定）

---

## ADR-006: Zustandによる状態管理

**決定**: グローバル状態管理にZustandを使用

**理由**:
- Reduxより軽量でボイラープレートが少ない
- Server ComponentとClient Componentの境界を意識した設計に合う
- `create()`で型安全なストアを簡潔に定義できる

**使用範囲**: 認証状態など、複数コンポーネントをまたぐ状態のみ  
**使用しない**: サーバーから取得したデータのキャッシュ（React Cacheを使用）

---

## ADR-007: `withErrorHandling`パターンの統一

**決定**: すべてのサービス関数は`withErrorHandling`でラップする

```typescript
const result = await withErrorHandling(
  () => supabase.from('jobs').select('*'),
  'fetchJobs'
)
if (result.error) { /* エラー処理 */ }
```

**理由**: try-catchを各所に書かずに済む、エラーログの一元管理

---

## ADR-008: ページコンポーネントはServer Component優先

**決定**: `page.tsx`はデフォルトでServer Component（`'use client'`なし）

- データフェッチはServer Componentで行う
- インタラクション部分のみClient Componentに分離する
- `'use client'`は必要最小限のコンポーネントにのみ付与する

**理由**: SEO・初期表示パフォーマンス・セキュリティ（APIキーの保護）
