# 開発ルール

## 開発フロー（必ず守ること）

```
① HIKARU-Dookへ仕様を追加・更新
    ↓
② 実装
    ↓
③ 動作確認
    ↓
④ HIKARU-Dookへ最終仕様を反映
```

**仕様と実装内容は常に一致した状態を維持すること。**

---

## HIKARU-Dook更新ルール

| タイミング | 対応 |
|---|---|
| 新機能追加前 | 該当ドキュメントに仕様を先に記載 |
| 実装完了後 | 仕様の変更があれば即時反映 |
| バグ修正後 | 仕様に影響する場合は更新 |
| APIエンドポイント変更 | `06_API/`を必ず更新 |
| DB変更 | `05_Database/`を必ず更新 |
| UI変更 | `07_UI_UX/`を必ず更新 |

---

## コーディングルール

### TypeScript
- `any`型の使用禁止（`unknown`を使用）
- 型定義は`lib/types/`で一元管理
- Supabaseの型は自動生成を使用

### コンポーネント
- Server ComponentとClient Componentを明示する
- `'use client'`は必要最小限のコンポーネントにのみ付与
- データフェッチはServer Componentで行う

### API Routes
- すべてのルートでセッション確認を行う
- try-catch でエラーハンドリングを必ず実装
- エラーレスポンスは統一フォーマットで返す

### AIモジュール
- プロンプトは`modules/*/prompts.ts`で管理
- ハードコードされたモデル名を使わない（`lib/openai/client.ts`から取得）
- AIのレスポンスは必ずバリデーションする

---

## ファイル・命名規則

| 対象 | ルール | 例 |
|---|---|---|
| ディレクトリ | kebab-case | `manual-ai/` |
| Reactコンポーネント | PascalCase | `PhotoCapture.tsx` |
| ユーティリティ関数 | camelCase | `formatDate.ts` |
| 定数 | UPPER_SNAKE_CASE | `OPENAI_MODEL` |
| 型定義 | PascalCase + Suffix | `JobRecord`, `PhotoEvaluation` |
| APIルート | kebab-case | `/api/ai/quality` |

---

## Git運用ルール

詳細は[02_git.md](./02_git.md)を参照。

## アーキテクチャ決定記録

重要な設計判断は[03_architecture_decisions.md](./03_architecture_decisions.md)に記録する。

---

## 禁止事項

| 禁止 | 代替 |
|---|---|
| APIキーのハードコード | `.env.local`使用 |
| `any`型 | `unknown`を使用 |
| フロントからOpenAI直接呼び出し | `/api/ai/*`を経由 |
| コメントで「何をしているか」を説明 | 変数名・関数名で表現 |
| 不要なconsole.log | 削除する |
