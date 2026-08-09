# AI分析（analyze-ai）— 第9回実装済み

## 概要

蓄積された作業データから、店舗・作業者・全体の横断分析を行い、  
AIが改善提案・フィードバック・トレンド解説を自動生成する。

**技術**: OpenAI GPT-4o（データ解析・自然言語生成）  
**ステータス**: ✅ 実装完了（第9回）

---

## ダッシュボード構成

```
/analytics（タブ型）
├── 概要タブ：KPIカード・月別スコア推移・判定分布ドーナツ・月別作業件数
├── 品質分析タブ：スコア分布・箇所別品質ランキング・再清掃率・スコアサマリー
├── ランキングタブ：店舗品質ランキング・作業者ランキング（詳細ページへのリンク付き）
└── AI提案タブ：AI総合評価・強み・課題・優先改善提案（高/中/低）

/analytics/store/[id]
├── KPIカード（作業回数・平均スコア・住所・最終作業日）
├── スコアリング表示
├── 月別品質スコア推移（折れ線グラフ）
├── 撮影箇所別スコア（横棒グラフ・要改善順）
├── 最近の報告書一覧
└── AI分析・改善提案（オンデマンド実行）

/analytics/worker/[id]
├── KPIカード（作業回数・合格率・再清掃回数・AIチャット利用）
├── 平均品質スコア
├── 月別スコア推移
├── 箇所別スコア
├── AIチャット活用状況
└── AIフィードバック（強み・改善点・研修アドバイス）
```

---

## 実装ファイル構成

```
HIKARU-CONSOLE/
├── services/analytics.service.ts           ← データ集計サービス（Supabase直接）
├── modules/analyze-ai/
│   ├── index.ts                             ← AI生成関数（4種類）
│   └── prompts.ts                           ← プロンプト定義（4種類）
├── app/api/ai/analyze/route.ts             ← GET API（type=overview|store|worker|trends）
├── components/analytics/Charts.tsx          ← SVGチャートコンポーネント群
└── app/(console)/analytics/
    ├── page.tsx                             ← メイン分析ダッシュボード（タブ型）
    ├── store/[id]/page.tsx                  ← 店舗詳細分析
    └── worker/[id]/page.tsx                 ← 作業者詳細分析
```

---

## チャートコンポーネント（SVGベース・依存ライブラリなし）

| コンポーネント | 用途 |
|---|---|
| `<LineChart>` | 月別スコア推移（折れ線）|
| `<HBarChart>` | ランキング表示（横棒）|
| `<DonutChart>` | 判定分布（ドーナツ）|
| `<ScoreRing>` | 品質スコア表示（円形リング）|
| `<VBarChart>` | 月別作業件数（縦棒）|
| `<Sparkline>` | ミニトレンド表示 |

---

## APIエンドポイント（実装済み）

```
GET /api/ai/analyze?type=overview    # 全体サマリーAI分析
GET /api/ai/analyze?type=store&id=xxx # 店舗別AI分析
GET /api/ai/analyze?type=worker&id=xxx # 作業者別AIフィードバック
GET /api/ai/analyze?type=trends       # 時系列トレンドAI解説
```

---

## データ集計関数（analytics.service.ts）

| 関数 | 内容 |
|---|---|
| `getAnalyticsOverview()` | 全体KPI集計（作業数・スコア・写真数・再清掃数等）|
| `getMonthlyTrends()` | 過去12ヶ月の月別平均スコア・作業件数 |
| `getStoreRankings()` | 店舗別平均スコアランキング |
| `getWorkerRankings()` | 作業者別平均スコア・合格率ランキング |
| `getQualityDistribution()` | スコア帯別分布（0-44/45-59/60-74/75-89/90-100）|
| `getSpotQualityRankings()` | 撮影箇所別平均スコア・再清掃率 |
| `getStoreAnalyticsDetail(id)` | 店舗詳細（月別推移・箇所別・報告書）|
| `getWorkerAnalyticsDetail(id)` | 作業者詳細（月別推移・箇所別・チャット利用数）|

---

## AI分析機能（4種類）

| 関数 | モデル | 入力 | 出力 |
|---|---|---|---|
| `analyzeOverview()` | GPT-4o | 全体統計JSON | overallAssessment, strengths, concerns, suggestions |
| `analyzeStoreData()` | GPT-4o | 店舗統計JSON | trend, issues, suggestions, summary |
| `analyzeWorkerPerformance()` | GPT-4o | 作業者統計JSON | overallFeedback, strengths, improvements, trainingAdvice |
| `analyzeTrends()` | GPT-4o | 時系列データJSON | trendComment, spotInsights, warnings, forecast |

---

## 将来拡張

- [ ] ヒートマップ表示（曜日×時間帯の品質ヒートマップ）
- [ ] AIによる需要予測（作業ピーク時期の予測）
- [ ] 人員配置最適化提案
- [ ] 設備劣化トレンド予測（多数回の写真比較から劣化度を判定）
- [ ] 月次自動レポート生成（定期メール配信）
- [ ] 契約更新予測
- [ ] 異常検知アラート（スコア急落の自動通知）
- [ ] 経営ダッシュボード（売上・人件費・品質の3軸分析）
- [ ] クライアントポータルでの品質レポート共有
