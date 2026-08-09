# Git運用ルール

## ブランチ戦略

```
main          ← 本番環境（直接コミット禁止）
  └── develop ← 開発統合��ランチ
        ├── feature/xxx  ← 機能開発
        ├── fix/xxx      ← バグ修正
        └── docs/xxx     ← ドキュメント更新
```

---

## ブランチ命名規則

| 種類 | プレフィックス | 例 |
|---|---|---|
| 機能開発 | `feature/` | `feature/ai-manual-chat` |
| バグ��正 | `fix/` | `fix/photo-upload-error` |
| ドキュメント | `docs/` | `docs/update-api-spec` |
| 緊急修正 | `hotfix/` | `hotfix/auth-bypass` |

---

## コミットメッセージ規則

```
<type>: <概要（日本語可）>

[任意] 詳細説明

例:
feat: AIマニュアルチャット機能を追加
fix: Before写真アップロード時のエラーを修正
docs: データベーススキーマをHIKARU-Dookに更新
chore: OpenAI APIバージョンを更新
```

| type | 用途 |
|---|---|
| feat | 新機能 |
| fix | バグ修正 |
| docs | ドキュメント |
| style | コードスタイル |
| refactor | リファクタリング |
| chore | 依存関係・設定変更 |

---

## .gitignore 必須項目

```
# 環境変数（絶対にコミットしない）
.env
.env.local
.env.*.local

# ビルド成果物
.next/
out/
build/

# 依存関係
node_modules/

# OS
.DS_Store
Thumbs.db
```

---

## コミット前チェックリスト

- [ ] `.env.local`がステージングに含まれていないか
- [ ] APIキーがコードに含まれていないか
- [ ] `console.log`が残っていないか
- [ ] TypeScriptのビルドエラーがないか
- [ ] HIKARU-Dookの更新が必要な変更ではないか
