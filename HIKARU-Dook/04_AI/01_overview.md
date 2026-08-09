# AI設計概要

## HIKARUのAI設計思想

HIKARUのAIは「後付け機能」ではなく「システムの中心」です。  
4つのAIモジュールが連携し、データが蓄積されるほど価値が高まります。

---

## 4つのAIモジュール

| モジュール | 機能 | 技術 | ファイル |
|---|---|---|---|
| manual-ai | AIマニュアル（教育AI） | RAG | modules/manual-ai/ |
| quality-ai | AI品質管理（写真評価） | Vision AI | modules/quality-ai/ |
| report-ai | AI報告書（文書生成） | Text Generation | modules/report-ai/ |
| analyze-ai | AI分析（時系列・改善提案） | Data Analysis | modules/analyze-ai/ |

---

## AI間の連携マップ

```
【案件登録】管理者がマニュアル・撮影場所・資料を登録
                    ↓
    ┌───────────────────────────────┐
    │          OpenAI API           │
    │  ┌────────┐   ┌────────────┐  │
    │  │manual  │   │quality-ai  │  │
    │  │  -ai   │   │(Vision)    │  │
    │  └───┬────┘   └─────┬──────┘  │
    │      │              │         │
    │  ┌───▼────────────▼──────┐   │
    │  │     report-ai          │   │
    │  └───────────┬────────────┘   │
    │              │                │
    │  ┌───────────▼────────────┐   │
    │  │     analyze-ai          │   │
    │  └────────────────────────┘   │
    └───────────────────────────────┘
```

### 連携の流れ

| 連携 | 内容 |
|---|---|
| ①→② | マニュアルの基準写真を品質評価の参照基準として活用 |
| ②→③ | Before/After写真とAI評価が自動で報告書に流入 |
| ②→④ | 評価スコアが蓄積データとして分析モジュールに供給 |
| ④→① | 過去のミスパターンから次回作業前に関連マニュアルを先出し提案 |

---

## 使用モデル

```typescript
// lib/openai/client.ts
export const OPENAI_MODELS = {
  CHAT: 'gpt-4o',
  VISION: 'gpt-4o',
  REPORT: 'gpt-4o',
  ANALYZE: 'gpt-4o',
} as const
```

モデルの変更は`lib/openai/client.ts`の1箇所のみ修正すること。

---

## API呼び出しルール

- OpenAI APIはすべて `app/api/*` のサーバーサイドで呼び出す
- フロントエンドからOpenAI APIを直接呼び出すことは禁止
- APIキーは `OPENAI_API_KEY` 環境変数から取得（ハードコード禁止）
- エラー時は適切なフォールバックメッセージを返す

---

## 詳細ドキュメント

- [AIマニュアル（manual-ai）](./02_manual_ai.md)
- [AI品質管理（quality-ai）](./03_quality_ai.md)
- [AI報告書（report-ai）](./04_report_ai.md)
- [AI分析（analyze-ai）](./05_analyze_ai.md)
