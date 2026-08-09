# AI品質管理システム（quality-ai）— 第7回実装済み

## 概要

作業者が撮影したBefore/After写真をOpenAI Vision APIが解析・比較し、清掃品質を100点満点で評価するシステムです。

- **モデル**: gpt-4o（Vision対応）
- **合格ライン**: 75点以上（`QUALITY_PASS_THRESHOLD` 定数で変更可）
- **要確認ライン**: 60点以上（`QUALITY_CHECK_THRESHOLD` 定数で変更可）

---

## 評価フロー

```
After写真撮影完了
  ↓
「AI品質チェックへ進む」ボタン
  ↓
/jobs/[projectId]/evaluation?run=1
  ↓
POST /api/ai/quality { action: 'evaluate-all', jobId }
  ↓
撮影箇所ごとにOpenAI Vision APIで評価（順次処理）
  ↓
ai_evaluations テーブルに保存（upsert）
  ↓
評価結果画面に表示
  ↓
全箇所合格 → 「作業完了」ボタン
失敗あり   → 「再清掃する」+ 「再評価」ボタン
```

---

## スコア基準

| 点数 | ラベル | 判定 |
|---|---|---|
| 90-100 | 素晴らしい | 合格 (pass) |
| 75-89  | 良好       | 合格 (pass) |
| 60-74  | 普通       | 要確認 (check) |
| 45-59  | 要改善     | 再清掃推奨 (redo) |
| 0-44   | 不合格     | 再清掃推奨 (redo) |

---

## APIエンドポイント

### POST /api/ai/quality

| action | 説明 |
|---|---|
| `check` | 単一写真の品質チェック（ピント・明るさ等） |
| `evaluate` | 単一スポットのBefore/After評価 |
| `evaluate-all` | ジョブの全スポットを一括評価 |

### GET /api/ai/quality?jobId=xxx

評価結果一覧取得

---

## データベース（ai_evaluations）

UNIQUE制約: `(job_id, spot_id)` → 再評価は upsert で上書き

主要カラム: score, dirty_removal, thoroughness, shine, passed, recommendation, comparison, comment, improvements[], remaining_issues[]

---

## 将来拡張

- リアルタイム判定（撮影直後に評価）
- 店舗ごとの品質推移グラフ
- 過去データとの比較・劣化診断
- ライブカメラリアルタイム判定
- 動画解析対応
