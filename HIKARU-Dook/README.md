# HIKARU-Dook

> HIKARUプロジェクト唯一の正しい情報源（Single Source of Truth）

HIKARU-Dookはこのプロジェクト全体の知識ベースです。  
設計・仕様・開発ルール・運用資料のすべてをここで管理します。

---

## プロジェクト概要

**HIKARU** は清掃業界向けAI品質マネジメントプラットフォームです。

> AIを活用し、教育・品質管理・報告書作成・分析・経営改善を  
> ひとつのプラットフォームで実現するサービスです。

**現在のバージョン**: v1.0.0（2026-08-02 完成）  
**ステータス**: 🟢 コア機能完成・企業導入可能

---

## クイックリファレンス

| 知りたいこと | 参照先 |
|---|---|
| 開発環境の構築手順 | [11_Development/04_setup_guide.md](./11_Development/04_setup_guide.md) |
| 本番運用の手順・障害対応 | [11_Development/05_operations_manual.md](./11_Development/05_operations_manual.md) |
| APIエンドポイント一覧 | [06_API/01_overview.md](./06_API/01_overview.md) |
| 全画面一覧 | [07_UI_UX/02_screen_list.md](./07_UI_UX/02_screen_list.md) |
| DBスキーマ | [05_Database/01_schema.md](./05_Database/01_schema.md) |
| AIモジュール仕様 | [04_AI/01_overview.md](./04_AI/01_overview.md) |
| 開発コーディングルール | [11_Development/01_rules.md](./11_Development/01_rules.md) |
| 今後のロードマップ | [12_Roadmap/01_roadmap.md](./12_Roadmap/01_roadmap.md) |
| 変更履歴 | [13_Changelog/2026.md](./13_Changelog/2026.md) |

---

## フォルダ構成

| フォルダ | 内容 |
|---|---|
| [01_Project](./01_Project/) | プロジェクト概要・コンセプト・用語集 |
| [02_System](./02_System/) | システムアーキテクチャ・技術スタック・ディレクトリ構成 |
| [03_CONSOLE](./03_CONSOLE/) | 管理者コンソール（HIKARU-CONSOLE）仕様 |
| [04_AI](./04_AI/) | AI機能設計・各AIモジュール仕様（4機能） |
| [05_Database](./05_Database/) | データベース設計・スキーマ・RLS設計 |
| [06_API](./06_API/) | API設計・エンドポイント一覧 |
| [07_UI_UX](./07_UI_UX/) | 画面一覧・デザイン原則・UX設計・ダッシュボード設計 |
| [08_Components](./08_Components/) | コンポーネント設計・共通UI仕様 |
| [09_Report](./09_Report/) | 報告書設計・フォーマット・生成仕様 |
| [10_Security](./10_Security/) | セキュリティ方針・環境変数一覧 |
| [11_Development](./11_Development/) | 開発ルール・Git運用・セットアップガイド・運用マニュアル |
| [12_Roadmap](./12_Roadmap/) | 今後の機能追加予定・開発ロードマップ |
| [13_Changelog](./13_Changelog/) | 更新履歴 |

---

## v1.0 実装済み機能一覧

### アプリ構成

| アプリ | URL | 対象 | ステータス |
|---|---|---|---|
| HIKARU-System | localhost:3000 | 清掃作業者 | ✅ 完成 |
| HIKARU-CONSOLE | localhost:3001 | 管理者・現場責任者 | ✅ 完成 |
| クライアントポータル | - | 施設オーナー | ⏳ v1.1予定 |

### AI機能（全4機能実装済み）

| 機能 | 技術 | 詳細 |
|---|---|---|
| AIマニュアル | GPT-4o + RAG | マニュアルコンテキスト付きQAチャット（SSEストリーミング） |
| AI品質評価 | GPT-4o Vision | Before/After写真比較・スコア/判定/改善提案 |
| AI報告書 | GPT-4o | クライアント提出品質の報告書自動生成 |
| AI分析 | GPT-4o | 全体/店舗/作業者/時系列の4軸AI分析 |

### 画面数

| カテゴリ | 実装済み |
|---|---|
| 作業者（System） | 11画面 |
| 管理者（CONSOLE） | 24画面 |
| 認証（共通） | 3画面 |
| **合計** | **38画面** |

---

## HIKARU-Dook 更新ルール

```
① 仕様決定 → HIKARU-Dookへ追加・更新
② 実装
③ 動作確認
④ HIKARU-Dookへ最終仕様を反映
```

仕様と実装の内容は**常に一致**した状態を維持すること。  
実装完了後に更新を忘れることで、ドキュメントと実装の乖離が生じる。

---

## 最終更新

| 項目 | 内容 |
|---|---|
| 最終更新日 | 2026-08-02 |
| バージョン | **v1.0.0** |
| ステータス | 🟢 コア機能完成 |
| 次回更新予定 | v1.1（クライアントポータル実装時） |
