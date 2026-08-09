# 報告書設計（第8回実装済み）

## 概要

AIが自動生成するクライアント提出用の清掃品質報告書。  
作業者は「AI報告書を作成する」ボタン1タップで生成できる。

---

## 報告書の位置づけ

- クライアントへ提出できる品質のHTML報告書
- 作業の証跡・品質の証明として機能
- 蓄積することで品質推移を可視化するデータになる
- ブラウザの印刷機能（`window.print()`）でPDF出力

---

## 報告書の構成

```
─────────────────────────────────
  HIKARU Quality Report    清掃品質報告書
                            No. 001 / 2026-08-02
─────────────────────────────────
  【作業概要】
  案件名: ○○店 定期清掃
  クライアント: 株式会社○○
  店舗名: ○○店
  店舗住所: 東京都○○区...
  担当者: 田中 太郎
  作業日: 2026年8月2日（土）
  開始時刻: 09:00
  終了時刻: 11:30
  作業時間: 2時間30分
─────────────────────────────────
  【品質評価サマリー】
  87点 / 100点 — 良好
  合格: 5箇所 / 要確認: 1箇所
─────────────────────────────────
  【本日の作業内容】
  （AIが自動生成した作業サマリー）
─────────────────────────────────
  【品質評価】
  （AIが自動生成した評価コメント）
─────────────────────────────────
  【撮影箇所別詳細 (6箇所)】

  ① 床 — 92点 ✅ 合格
  Before [写真]  |  After [写真]
  AIコメント: 清掃前に見られたホコリ・黒ずみは除去され...
  
  ② 厨房 — 85点 ⚠️ 要確認
  Before [写真]  |  After [写真]
  AIコメント: 油汚れは大幅に改善されましたが...
  改善提案: • 壁際の油汚れを重点的に

  ...（箇所ごとに繰り返し）
─────────────────────────────────
  【総合評価】
  （AIが生成した全体まとめコメント）
  
  次回作業への推奨事項:
  → 厨房壁際の油汚れを重点清掃
─────────────────────────────────
  HIKARU 清掃品質管理システム
  生成日時: 2026/08/02 11:45  担当: 田中 太郎  Ver.1
─────────────────────────────────
```

---

## 出力形式

| 項目 | 仕様 |
|---|---|
| ファイル形式 | ブラウザ印刷 → PDF保存（将来: @react-pdf/renderer） |
| 用紙サイズ | A4（@page CSS定義済み） |
| 生成方法 | HTML + 印刷CSS (`window.print()`) |
| 保存先 | Supabaseの `reports.content` (JSONB) |
| ファイル名 | 将来: `report_{jobId}_{date}.pdf` |
| 言語 | 日本語 |

---

## 実装ファイル構成

```
HIKARU-System/
├── app/(worker)/jobs/[jobId]/report/page.tsx   ← 報告書ページ（作業者）
├── app/api/ai/report/route.ts                   ← 生成・取得API
├── modules/report-ai/
│   ├── index.ts                                  ← AI生成ロジック + 型定義
│   └── prompts.ts                                ← OpenAIプロンプト
└── services/report.service.ts                   ← フロントエンドサービス

HIKARU-CONSOLE/
├── app/(console)/reports/page.tsx               ← 報告書一覧（管理者）
├── app/(console)/reports/[id]/page.tsx          ← 報告書詳細・印刷（管理者）
└── services/reports.service.ts                  ← 報告書取得サービス
```

---

## ナビゲーションフロー

```
作業者アプリ:
  案件詳細 (jobs/[jobId]) →[報告書ボタン]→ 報告書ページ
  AI品質評価 (evaluation) →[AI報告書を作成する]→ 報告書ページ

管理コンソール:
  サイドバー「報告書管理」→ 一覧 → 詳細・印刷
```

---

## 生成タイミング・ルール

1. AI品質評価完了後に「AI報告書を作成する」ボタンが表示される
2. 作業者がボタンをタップ → OpenAI APIが自動生成
3. 報告書プレビューを確認
4. 「印刷/PDF」ボタンで提出用PDFを出力
5. 報告書はSupabaseに保存（再閲覧・再生成可能）
6. バージョン管理あり（再生成するとVer.が上がる）

---

## 報告書データ型 (ReportContent)

```typescript
interface ReportContent {
  project: { name, code, address, assigned_to, notes }
  store:   { name, address, phone }
  client:  { name }
  job:     { work_date, started_at, completed_at, worker_name }
  spots:   ReportSpot[]     // 撮影箇所別データ
  summary: ReportSummary    // 品質スコア・AIコメント集約
  generated_at: string
  version: number
}

interface ReportSpot {
  name, order, score, recommendation
  before_url, after_url
  ai_comment        // OpenAIが生成した箇所別コメント
  improvements[]    // 改善提案リスト
  remaining_issues[]
  comparison
}

interface ReportSummary {
  overall_score, passed_count, check_count, redo_count, total_spots
  work_summary        // 今日の作業概要（AI生成）
  quality_assessment  // 品質評価総括（AI生成）
  total_comment       // 全体評価コメント（AI生成）
  next_recommendations[]
}
```

---

## 将来の拡張

- [ ] 会社ロゴの差し込み（管理者設定から取得）
- [ ] 報告書テンプレートの変更（複数テンプレート対応）
- [ ] @react-pdf/renderer による真のPDF生成・Supabase Storage保存
- [ ] 電子署名・担当者サイン欄
- [ ] クライアントコメント欄
- [ ] メール添付での自動送信
- [ ] LINE送信
- [ ] 多言語報告書（英語・中国語対応）
- [ ] 複数店舗の月次サマリー報告書
- [ ] 会社ロゴ・ブランドカラーのカスタマイズ
- [ ] クライアントポータルからの直接閲覧
