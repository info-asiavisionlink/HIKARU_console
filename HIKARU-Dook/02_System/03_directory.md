# ディレクトリ構成（第10回更新・実装済み版）

## ワークスペース全体構成

```
HIKARU/ (npm workspace root)
├── package.json               # ワークスペース定義・devスクリプト
├── .gitignore
│
├── packages/                  # 共有パッケージ
│   ├── types/                 # @hikaru/types — 共有型定義
│   │   └── src/
│   │       ├── models.ts      # ドメインモデル型（User, Job, Photo等）
│   │       ├── api.ts         # APIレスポンス型
│   │       ├── database.ts    # Supabase DB型
│   │       └── index.ts
│   ├── lib/                   # @hikaru/lib — 共有ユーティリティ
│   │   └── src/
│   │       ├── supabase/client.ts / server.ts
│   │       ├── openai/client.ts   # OpenAIクライアント・OPENAI_MODELS定数
│   │       ├── openai/retry.ts    # リトライ共通ラッパー（v1.0追加）
│   │       └── utils/format.ts / validation.ts
│   └── ui/                    # @hikaru/ui — HIKARUデザインシステム
│       └── src/
│           ├── index.ts       # 全コンポーネントのre-export
│           ├── lib/utils.ts   # cn() ユーティリティ
│           └── components/    # Button, Card, Table, Dialog等 20+コンポーネント
│
├── HIKARU-System/             # 作業者向けNext.jsアプリ（port 3000）
├── HIKARU-CONSOLE/            # 管理者向けNext.jsアプリ（port 3001）
├── supabase/migrations/       # DBマイグレーションSQL (001〜007)
└── HIKARU-Dook/               # プロジェクト知識ベース（本ドキュメント群）
```

---

## HIKARU-System 実装済みファイル構成

```
HIKARU-System/
├── app/
│   ├── layout.tsx             # ルートレイアウト
│   ├── page.tsx               # → /login へリダイレクト
│   ├── globals.css            # CSS変数・Tailwind v4テーマ
│   │
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   ├── login/
│   │   │   ├── page.tsx
│   │   │   ├── actions.ts     # Server Action でログイン処理
│   │   │   └── _components/LoginForm.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── reset-password/page.tsx
│   │
│   ├── (worker)/
│   │   ├── layout.tsx         # BottomNav付きレイアウト
│   │   ├── page.tsx           # → /home へリダイレクト
│   │   ├── home/page.tsx      # ホーム（今日の作業サマリー）
│   │   ├── jobs/
│   │   │   ├── page.tsx       # 案件一覧
│   │   │   └── [jobId]/
│   │   │       ├── page.tsx   # 作業詳細（2×2グリッド・作業開始/完了）
│   │   │       ├── before/page.tsx   # Before撮影
│   │   │       ├── after/page.tsx    # After撮影
│   │   │       ├── manual/page.tsx   # マニュアル一覧
│   │   │       ├── chat/
│   │   │       │   ├── layout.tsx    # BottomNav非表示
│   │   │       │   └── page.tsx      # AIマニュアルチャット（SSEストリーミング）
│   │   │       ├── evaluation/page.tsx  # AI品質評価
│   │   │       └── report/page.tsx      # AI報告書（プレビュー・印刷・履歴）
│   │   ├── profile/page.tsx
│   │   └── notifications/page.tsx
│   │
│   ├── (client)/
│   │   ├── layout.tsx
│   │   └── page.tsx           # クライアントポータル（v1.1で実装予定）
│   │
│   └── api/
│       ├── ai/
│       │   ├── manual/route.ts    # POST: SSEストリーミング / GET: 履歴
│       │   ├── quality/route.ts   # POST: check|evaluate|evaluate-all / GET: 評価一覧
│       │   └── report/route.ts    # POST: 報告書生成 / GET: 履歴・詳細
│       ├── jobs/route.ts
│       └── photos/route.ts
│
├── components/
│   ├── layouts/
│   │   ├── WorkerHeader.tsx      # 作業者ヘッダー（戻るボタン・タイトル）
│   │   ├── WorkerLayout.tsx      # BottomNav付きレイアウト
│   │   └── BottomNav.tsx         # 下部ナビ（ホーム・案件・プロフィール）
│   ├── providers/
│   │   └── AuthProvider.tsx
│   └── worker/
│       ├── PhotoCapture.tsx      # カメラ起動・写真プレビュー・再撮影
│       └── WorkProgress.tsx      # 進捗バー・SpotStatusDot
│
├── modules/
│   ├── manual-ai/
│   │   ├── index.ts             # buildManualContext, generateManualReplyStream
│   │   └── prompts.ts
│   ├── quality-ai/
│   │   ├── index.ts             # checkPhotoQuality, evaluateBeforeAfter
│   │   └── prompts.ts
│   └── report-ai/
│       ├── index.ts             # generateReportContent, calcWorkDuration, formatDate
│       └── prompts.ts
│
├── services/
│   ├── auth.service.ts          # ログイン・ログアウト・パスワードリセット
│   ├── base.service.ts          # withErrorHandling パターン
│   ├── chat.service.ts          # sendChatMessage, loadChatHistory
│   ├── jobs.service.ts          # getOrCreateTodayJob, getTodayJob, completeJob
│   ├── photos.service.ts        # uploadPhoto, getJobPhotos
│   ├── quality.service.ts       # evaluateAllSpots, loadEvaluations
│   ├── report.service.ts        # generateReport, loadReportHistory, loadReport
│   └── worker-projects.service.ts # getWorkerProjects, getWorkerProject
│
├── hooks/useAsync.ts / useAuth.ts / useSupabase.ts
├── stores/auth.store.ts
├── lib/auth/index.ts / supabase/client.ts,server.ts / openai/client.ts
├── types/index.ts / database.types.ts
├── constants/index.ts
└── utils/format.ts / validation.ts
```

---

## HIKARU-CONSOLE 実装済みファイル構成

```
HIKARU-CONSOLE/
├── app/
│   ├── (auth)/login / forgot-password / reset-password
│   │
│   ├── (console)/
│   │   ├── layout.tsx           # サイドバーレイアウト
│   │   ├── page.tsx             # → /dashboard
│   │   ├── dashboard/page.tsx   # KPIダッシュボード
│   │   ├── projects/            # 案件CRUD（一覧・詳細・新規・編集・マニュアル）
│   │   ├── clients/             # 顧客CRUD
│   │   ├── stores/              # 店舗CRUD（撮影箇所設定・作業場所）
│   │   ├── workers/             # ユーザーCRUD（招待・権限変更）
│   │   ├── manuals/             # マニュアル管理
│   │   ├── reports/             # 報告書管理（一覧・詳細プレビュー）
│   │   ├── notifications/       # 通知管理
│   │   ├── analytics/           # AI分析ダッシュボード
│   │   │   ├── page.tsx         # 4タブ型（概要/品質/ランキング/AI提案）
│   │   │   ├── store/[id]/page.tsx
│   │   │   └── worker/[id]/page.tsx
│   │   └── settings/page.tsx
│   │
│   └── api/
│       ├── ai/analyze/route.ts  # type=overview|store|worker|trends
│       ├── clients/route.ts
│       └── projects/route.ts
│
├── components/
│   ├── analytics/
│   │   └── Charts.tsx           # SVGベースチャート群（依存なし）
│   ├── console/
│   │   ├── EmptyState.tsx
│   │   └── ConfirmDeleteDialog.tsx
│   ├── layouts/
│   │   ├── Sidebar.tsx          # サイドバーナビゲーション
│   │   ├── ConsoleLayout.tsx
│   │   └── ConsoleHeader.tsx
│   └── providers/AuthProvider.tsx
│
├── modules/
│   └── analyze-ai/
│       ├── index.ts             # analyzeOverview, analyzeStoreData, analyzeWorkerPerformance, analyzeTrends
│       └── prompts.ts
│
├── services/
│   ├── analytics.service.ts     # 8つのデータ集計関数
│   ├── auth.service.ts
│   ├── clients.service.ts
│   ├── dashboard.service.ts
│   ├── locations.service.ts
│   ├── manuals.service.ts
│   ├── photo-spots.service.ts
│   ├── projects.service.ts
│   ├── reports.service.ts       # listReports, getReport, getReportStats
│   ├── stores.service.ts
│   └── users.service.ts
│
└── hooks / stores / lib / types / constants
```

---

## 責務分担ルール

| 処理 | 場所 | 理由 |
|---|---|---|
| OpenAI API呼び出し | `modules/*/index.ts` + `app/api/*/route.ts` | APIキー保護 |
| Supabase CRUD | `services/*.service.ts` + `createClient()` | RLS自動適用 |
| ページUI | `app/(group)/*/page.tsx` | App Router規約 |
| 共通UI部品 | `packages/ui/src/components/` | デザイン統一 |
| 認証ガード | `middleware.ts` + `lib/auth/index.ts` | 二重保護 |
| 型定義 | `packages/types/src/` (共通) / `types/index.ts` (各アプリ) | 型共有 |
