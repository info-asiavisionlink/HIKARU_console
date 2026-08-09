# HIKARU Phase 5 顧客満足度 + AI品質統合 設計書

**作成日**: 2026-08-09

---

## 1. コンセプト

AI品質スコアと顧客満足度は別データとして管理し、統合分析する。

| スコア | 説明 | スケール |
|--------|------|---------|
| AI品質スコア | 写真AIによる客観的品質評価 | 0-100 |
| 顧客満足度 | 顧客が実際に感じた満足度 | 1-5（★） |
| HIKARU Quality Score | AI×0.6 + 顧客×0.4 の統合指標 | 0-100 |

---

## 2. HIKARU Quality Score (HQS)

```typescript
// 顧客評価 1-5 → 0-100 変換
ratingToScore(5) = 100
ratingToScore(4) = 80
ratingToScore(3) = 60
ratingToScore(2) = 40
ratingToScore(1) = 20

// HQS計算
HQS = AI品質 × 0.60 + 顧客スコア × 0.40

// 例: AI=90, 顧客=5
HQS = 90×0.6 + 100×0.4 = 94
```

**重み設定**: `companies.quality_weight_ai` / `companies.quality_weight_customer` で変更可能（将来）

---

## 3. 品質ギャップ分析

| ギャップ | 説明 |
|---------|------|
| ≥ +30 | AI高・顧客低: 体感に反映されていない可能性 |
| +15〜+29 | やや乖離: 対応・コミュニケーション確認 |
| -14〜+14 | ほぼ一致 |
| -15〜-29 | 顧客が接客で補完していると考えられる |
| ≤ -30 | 大きな乖離: 作業プロセスの見直し推奨 |

---

## 4. DB設計 (Migration 030)

### satisfaction_surveys テーブル

| カラム | 型 | 説明 |
|--------|-----|------|
| rating | SMALLINT 1-5 | 総合評価（必須） |
| comment | TEXT | 顧客コメント（原文保持） |
| rating_quality / speed / attitude | SMALLINT 1-5 | 詳細評価（任意） |
| ai_score | SMALLINT | 記録時のAIスコアSnapshot |
| ai_summary | TEXT | AI分析要約（原文とは別） |
| ai_positive_points / ai_improvement_points | TEXT[] | AI分析結果 |
| UNIQUE(job_id, portal_account_id) | — | 1job×1ポータルは1回のみ |

### client_project_permissions に追加
- `show_ai_score_to_client` BOOLEAN DEFAULT false
- `can_submit_survey` BOOLEAN DEFAULT true

### companies に追加
- `quality_weight_ai` NUMERIC DEFAULT 0.60
- `quality_weight_customer` NUMERIC DEFAULT 0.40

### jobs に追加
- `survey_invited_at` TIMESTAMPTZ
- `survey_reminded_at` TIMESTAMPTZ

---

## 5. RLS

| ロール | 操作 |
|--------|------|
| 管理者 | 同一company_idのアンケート全件 SELECT |
| 顧客 | 自分のportal_account_idのアンケートのみ ALL |
| 従業員 | アクセス不可 |
| 協力業者 | アクセス不可 |

---

## 6. AI品質スコアの顧客公開

`client_project_permissions.show_ai_score_to_client = true` の場合のみポータルに表示。
デフォルトは `false`（非公開）。

---

## 7. 通知フロー

顧客が評価 rating ≤ 2 → `line_notification_logs` に `customer_low_rating` イベントを記録 → Phase 4の通知基盤で送信。

高優先度条件: `ai_score < 70 AND rating ≤ 2`

---

## 8. AIコメント分析ルール

- 原文 `comment` は変更しない
- AI分析結果は `ai_summary`, `ai_positive_points`, `ai_improvement_points` に保存
- 顧客が書いていない事実を追加しない
- 断定的表現を避ける（「〜の可能性があります」など）

---

## 9. API一覧

### Console (HIKARU-CONSOLE)
| パス | 説明 |
|------|------|
| GET /api/surveys | アンケート一覧（管理者） |
| POST /api/surveys/[id]/analyze | AIコメント分析 |
| GET /api/quality | ダッシュボードKPI |
| GET /api/quality/trends | 時系列 |
| GET /api/quality/workers | 作業者別集計 |

### Portal (HIKARU-customer portal)
| パス | 説明 |
|------|------|
| GET /api/portal/surveys | 未回答・回答済み一覧 |
| POST /api/portal/surveys | アンケート回答 |

---

## 10. Console UI

- `/quality` - KPIダッシュボード（満足度・AI・HQS・分布・ギャップ）
- `/quality/surveys` - アンケート一覧（高優先度/低評価/通常に分類）
- `/quality/workers` - 作業者別ランキング

---

## 11. 顧客ポータル UI

- `/surveys` - 未回答アンケート一覧・回答フォーム（★+コメント+詳細評価）
- サイドバーに「作業評価」メニュー追加

---

## 12. Phase 6への依存事項

- 備品・消耗品との連携（在庫不足 → AI品質低下の相関）
- 案件別品質ダッシュボードのさらなる充実
- アンケートリマインド通知（survey_invited_at / survey_reminded_at 活用）
- 品質スコア重みの管理者設定UI
