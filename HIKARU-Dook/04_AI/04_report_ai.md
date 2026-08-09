# AI報告書（report-ai）— 第8回実装済み

## 概要

作業完了後、ボタン1タップでクライアント提出用の報告書を自動生成する。

**技術**: OpenAI GPT-4o（文書生成）  
**ステータス**: ✅ 実装完了（第8回）

---

## 目的

> 作業者が報告書作成に時間をかけない  
> クライアントに高品質な報告書を提出できる

---

## 報告書に含まれる内容

| 項目 | 内容 | 自動/手動 |
|---|---|---|
| 案件名・店舗名・クライアント | DBから自動取得 | 自動 |
| 作業日・開始/終了時刻・作業時間 | DBから自動取得 | 自動 |
| 担当者名 | DBから自動取得 | 自動 |
| Before写真 | 撮影箇所ごとに並べて表示 | 自動 |
| After写真 | Beforeと対比表示 | 自動 |
| AI品質評価スコア | 各箇所のスコア・総合スコア | 自動 |
| 箇所別AIコメント | OpenAIが各箇所を分析・文章化 | 自動 |
| 改善提案 | AI評価データから転記 | 自動 |
| 作業内容サマリー | OpenAIが自動生成 | 自動 |
| 品質評価総括 | OpenAIが自動生成 | 自動 |
| 総合評価コメント | OpenAIが自動生成 | 自動 |
| 次回推奨事項 | OpenAIが自動生成 | 自動 |

---

## 生成フロー

```
作業者が「AI報告書を作成する」をタップ
    ↓
[API] POST /api/ai/report
    ↓
jobId から関連データを取得（Supabase）
  - jobs / projects / stores / clients テーブル
  - photos テーブル（Before/After URL）
  - ai_evaluations テーブル（スコア・比較・改善提案）
  - photo_spots テーブル（全撮影箇所）
    ↓
スコア集計
  - overall_score = 各箇所のスコア平均
  - passed/check/redo のカウント
    ↓
OpenAI API 呼び出し (REPORT_GENERATION_PROMPT)
  → work_summary（作業内容サマリー）
  → quality_assessment（品質評価総括）
  → spot_comments（箇所別AIコメント）
  → total_comment（総合評価コメント）
  → next_recommendations（次回推奨事項）
    ↓
ReportContent オブジェクト構築
    ↓
[DB] reports テーブルに保存（content=JSONB, version++）
    ↓
報告書プレビュー表示
    ↓
作業者が「印刷/PDF」ボタンで提出用PDF出力
```

---

## AIプロンプト仕様

**入力**: 店舗名・クライアント名・作業日・担当者・各箇所の評価データ  
**出力**: JSON形式（work_summary, quality_assessment, spot_comments, total_comment, next_recommendations）  
**文体**: クライアント企業へ提出する正式文書・丁寧・専門的  
**言語**: 日本語  
**モデル**: GPT-4o（OPENAI_MODELS.REPORT）  
**温度**: 0.6 / max_tokens: 2000

---

## APIエンドポイント（実装済み）

```
POST /api/ai/report
Body:     { jobId: string }
Response: {
  success: boolean
  data: {
    reportId: string
    content: ReportContent
  }
}

GET /api/ai/report?jobId=xxx
Response: {
  success: boolean
  data: ReportListItem[]   // バージョン履歴一覧
}

GET /api/ai/report?reportId=xxx
Response: {
  success: boolean
  data: { id, version, content, overall_score, created_at }
}
```

---

## 実装ファイル

```
modules/report-ai/
├── index.ts        ← generateReportContent() / 型定義 / 日付フォーマット
└── prompts.ts      ← REPORT_GENERATION_PROMPT / SpotInput型

app/api/ai/report/route.ts   ← POST生成 / GETリスト/詳細
services/report.service.ts   ← generateReport() / loadReportHistory() / loadReport()
```

---

## バージョン管理

- 同じjobIdで複数回生成可能
- 毎回 `version` が増加（v1, v2, v3...）
- 履歴から任意のバージョンを選択して表示可能
- 最新バージョンがデフォルト表示

---

## 将来の拡張

- [ ] PDF生成ライブラリ（@react-pdf/renderer）への移行
- [ ] 生成PDFをSupabase Storageへ保存 → `pdf_url` カラムに格納
- [ ] 電子署名API連携
- [ ] 多言語プロンプト対応（英語・中国語）
- [ ] メール自動送信（SendGrid連携）
- [ ] LINE Messaging API連携
- [ ] クライアントへの共有リンク生成
