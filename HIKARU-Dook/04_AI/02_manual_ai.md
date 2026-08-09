# AIマニュアル（manual-ai）— 第6回実装済み

## 概要

案件に登録されたマニュアル・手順・FAQをもとに、作業者の質問にAIがリアルタイムで回答する案件専用AIアシスタントです。

- 実装方式: **Full-Context RAG（全文コンテキスト）**  
  現フェーズではマニュアル全文をOpenAIに渡す。将来的にpg_vector（Vector DB）に移行予定。
- ストリーミング: **SSE（Server-Sent Events）** でリアルタイム表示
- 履歴: **chat_messages テーブル**に保存

---

## 案件専用AIとは

- 一般的なChatGPTではなく、「この案件のマニュアルを知っているAI」として動作
- マニュアルに記載がある内容は、常にマニュアルを優先して回答
- マニュアルにない内容は「このマニュアルには記載がありません」と明示し、一般補足情報として回答

---

## AIが参照する資料

| 種別 | content | file_url | コンテキスト扱い |
|---|---|---|---|
| text（文章・手順） | ✅ 全文 | - | 全文含める |
| faq（FAQ） | ✅ 全文 | - | 全文含める |
| note（注意事項） | ✅ 全文 | - | 優先度最高・先頭に配置 |
| pdf | - | ✅ URL | タイトル + URL を含める |
| image | - | ✅ URL | タイトル + URL を含める |
| video | - | ✅ URL | タイトル + URL を含める（将来: フレーム解析） |

---

## 回答フォーマット

AIは必ず以下の構造で回答します：

```
■回答
（直接的な答え）

■手順・方法
（具体的なステップ。箇条書き）

■注意事項
（安全・失敗しやすいポイント）

■参照マニュアル
（回答の根拠となったマニュアル名）

■補足
（マニュアルにない一般情報）
```

UIでは各セクションを色分けして表示（■注意事項は警告色など）。

---

## 処理フロー（ストリーミング）

```
作業者がチャット画面で質問
  ↓
POST /api/ai/manual
  { projectId, message, chatHistory, jobId }
  ↓
Supabase認証チェック（サーバーサイド）
  ↓
manuals テーブルから当該案件のマニュアルを全件取得
  ↓
buildManualContext() でコンテキスト文字列を構築
  （注意事項→FAQ→文章→PDF→画像→動画の順）
  ↓
OpenAI gpt-4o にストリーミングリクエスト
  temperature: 0.3（確実・一貫した回答）
  max_tokens: 1500
  ↓
TransformStream 経由でSSEチャンクをクライアントへ送信
  data: { type: 'chunk', content: '...' }
  ↓
ストリーム完了後、chat_messages テーブルに保存
  （ユーザーメッセージ + AI回答 の2レコード）
  ↓
data: { type: 'done', sources: [...] } で完了通知
```

---

## APIエンドポイント

### POST /api/ai/manual — AI回答生成（SSEストリーミング）

```typescript
Request Body:
{
  projectId: string       // 案件ID
  message: string         // 質問文
  chatHistory: { role: 'user' | 'assistant'; content: string }[]  // 直近10件
  jobId?: string          // 作業セッションID（nullable）
}

Response: text/event-stream (SSE)
data: { type: 'start' }
data: { type: 'chunk', content: string }   // 複数回
data: { type: 'done', sources: string[] }  // 参照マニュアル名
data: { type: 'error', message: string }   // エラー時
```

### GET /api/ai/manual?projectId=xxx&limit=30 — 履歴取得

```typescript
Response: { success: true, data: ChatMessageRow[] }
```

---

## データ構造

### chat_messages テーブル

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID | PK |
| project_id | UUID | FK → projects |
| worker_id | UUID | FK → profiles |
| job_id | UUID | FK → jobs (nullable) |
| role | TEXT | 'user' / 'assistant' |
| content | TEXT | メッセージ本文 |
| sources | TEXT[] | 参照マニュアル名（assistantのみ） |
| created_at | TIMESTAMPTZ | 送信日時 |

---

## UIフロー

```
案件詳細 (/jobs/[projectId])
  ├─ [マニュアル] → /jobs/[projectId]/manual  (静的マニュアル閲覧)
  │     └─ [AIに質問] ボタン → /jobs/[projectId]/chat
  └─ [AIに質問] → /jobs/[projectId]/chat  (AIチャット)
```

### チャット画面の機能
- ウェルカムメッセージ（初回表示）
- クイック質問ボタン（よく使われる質問4件）
- ストリーミング表示（文字が順次表示）
- セクション別カラーレンダリング（■回答=青・■注意事項=オレンジなど）
- ソースバッジ（参照マニュアル名）
- 会話履歴（Supabaseに永続化）
- BottomNav非表示（入力欄との干渉を防ぐ）

---

## ファイル構成

```
modules/manual-ai/
  index.ts     - buildManualContext, generateManualReplyStream, extractSources
  prompts.ts   - MANUAL_SYSTEM_PROMPT, MANUAL_USER_PROMPT, WELCOME_MESSAGE

app/api/ai/manual/
  route.ts     - POST（SSEストリーミング）+ GET（履歴取得）

services/
  chat.service.ts  - loadChatHistory, sendChatMessage, parseAIResponse

app/(worker)/jobs/[projectId]/
  chat/page.tsx    - チャットUI
  chat/layout.tsx  - BottomNav非表示レイアウト
  manual/page.tsx  - マニュアル閲覧 + AIチャットバナー
```

---

## 将来拡張ロードマップ

| フェーズ | 内容 |
|---|---|
| 現在 | 全文コンテキストRAG（シンプル実装） |
| 次フェーズ | Supabase pg_vector によるVector DB移行（大量マニュアル対応） |
| 将来 | 画像質問（カメラで撮影して質問） |
| 将来 | 音声質問（音声入力→テキスト変換） |
| 将来 | 動画解析（動画フレームの内容理解） |
| 将来 | 多言語対応 |
| 将来 | 社内ナレッジ共有（全案件横断検索） |

---

## モデル設定（変更箇所）

`packages/lib/src/openai/client.ts` の `OPENAI_MODELS.CHAT` を変更するだけでモデルを更新できます。
現在: `gpt-4o`
