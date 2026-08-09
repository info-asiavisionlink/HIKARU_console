# HIKARU Client Portal — 概要

## プロジェクト構成

| アプリ | ポート | ユーザー | 役割 |
|---|---|---|---|
| HIKARU-CONSOLE | 3002 | 管理者 | 全業務管理 |
| HIKARU-System | 3003 | 作業者・協力業者 | 現場作業・報告 |
| **HIKARU-customer portal** | **3001** | **顧客** | **案件閲覧・報告書確認** |

## 目的

「今、現場で何が行われているか」をリアルタイムで顧客へ透明性を持って共有する。  
単なる報告書閲覧ではなく、**リアルタイム情報共有システム**。

## ディレクトリ

```
HIKARU-customer portal/
├── app/
│   ├── (auth)/login/           # ログイン
│   ├── (portal)/
│   │   ├── dashboard/          # ダッシュボード
│   │   ├── projects/           # 案件一覧
│   │   ├── projects/[id]/      # 案件詳細（Realtime）
│   │   ├── reports/            # 報告書履歴
│   │   ├── reports/[id]/       # 報告書詳細
│   │   ├── reports/[id]/print/ # PDF印刷
│   │   └── notifications/      # 通知（Realtime）
│   └── api/                    # (将来拡張用)
├── components/layouts/         # PortalSidebar / PortalHeader
├── lib/supabase/               # client / server
└── middleware.ts               # hk_cp_uid / hk_cp_role Cookie認証

```

## 認証Cookie

| Cookie | 値 | 説明 |
|---|---|---|
| `hk_cp_uid` | Supabase user ID | ポータルユーザーID |
| `hk_cp_role` | `"client"` | ロール識別 |

CONSOLEの `hk_c_uid`（admin）とは別のcookie名。
