# HIKARU Phase 4 LINE通知連携 設計書

**作成日**: 2026-08-09  
**対象**: HIKARU-CONSOLE + 全システム  
**方針**: 共通通知基盤 / 業務処理とLINE通知を完全分離

---

## 1. アーキテクチャ

```
各機能（shifts/expenses/invoices等）
  ↓ void sendNotification(req)
lib/line/notification.service.ts
  ├── 冪等チェック（notification_key）
  ├── LINE User ID解決（profiles / client_portal_accounts）
  ├── 通知OFFチェック
  └── lib/line/client.ts → LINE Messaging API
         ↓
  line_notification_logs に記録（sent / failed / skipped）
```

### 重要設計原則
- LINE通知失敗は業務処理を止めない（`void sendNotification(...)` で非同期）
- 各ページからLINE APIを直接呼び出すことは禁止
- LINE秘密情報はサーバーサイドのみ。NEXT_PUBLIC_不可

---

## 2. ファイル構成

```
HIKARU-CONSOLE/
├── lib/line/
│   ├── types.ts                 # 型定義（イベント種別・パラメータ）
│   ├── client.ts                # LINE Push Message 送信クライアント
│   ├── templates.ts             # メッセージテンプレート（全通知文）
│   └── notification.service.ts # メインサービス（送信・再送・ログ）
├── app/api/
│   ├── notifications/
│   │   ├── route.ts             # GET: 通知ログ一覧
│   │   └── [id]/resend/route.ts # POST: 失敗通知再送
│   ├── employees/[id]/line/route.ts   # GET/PATCH: 従業員LINE状態
│   ├── partners/[id]/line/route.ts    # GET/PATCH: 協力業者LINE状態
│   └── invoices/overdue/route.ts      # POST: 期限超過バッチ通知
├── components/console/
│   └── LineStatusCard.tsx       # LINE連携状態UI（従業員・協力業者詳細）
└── app/(console)/
    └── notifications/page.tsx   # 通知ログ管理画面
```

---

## 3. DB設計

### Migration 029_line_notifications.sql

#### profiles に追加
```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS line_user_id        TEXT,
  ADD COLUMN IF NOT EXISTS line_notify_enabled BOOLEAN NOT NULL DEFAULT true;
```

#### client_portal_accounts に追加
```sql
ALTER TABLE public.client_portal_accounts
  ADD COLUMN IF NOT EXISTS line_user_id        TEXT,
  ADD COLUMN IF NOT EXISTS line_notify_enabled BOOLEAN NOT NULL DEFAULT true;
```

#### line_notification_logs テーブル
```sql
CREATE TABLE public.line_notification_logs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID        NOT NULL REFERENCES public.companies(id),
  profile_id        UUID        REFERENCES public.profiles(id),
  portal_account_id UUID        REFERENCES public.client_portal_accounts(id),
  event_type        TEXT        NOT NULL,
  notification_key  TEXT,       -- 冪等キー
  message           TEXT        NOT NULL,
  line_user_id      TEXT,
  status            TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  error_message     TEXT,
  sent_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- 冪等制約
CREATE UNIQUE INDEX line_logs_notification_key_idx
  ON public.line_notification_logs(company_id, notification_key)
  WHERE notification_key IS NOT NULL;
```

---

## 4. LINE User ID管理

### 誰がどこで管理するか

| 対象 | 保存先 | 管理者がUIで設定 |
|------|--------|----------------|
| 従業員 | profiles.line_user_id | 従業員詳細ページ > LINE連携カード |
| 協力業者 | profiles.line_user_id | 協力業者詳細ページ > LINE連携カード |
| 顧客 | client_portal_accounts.line_user_id | 顧客ポータルアカウント詳細（将来） |
| 管理者 | profiles.line_user_id | 自分のプロフィール設定（将来） |

### LINE User ID取得方法
1. LINE公式アカウントのWebhookでユーザーがメッセージを送信した際に取得
2. LINE Login（将来実装）でユーザー自身が連携
3. 現状は管理者が手入力（UIで設定）

---

## 5. 通知イベント一覧

| イベント | event_type | 通知先 | 冪等キー |
|---------|-----------|--------|---------|
| シフト作成 | shift_created | 担当者 | shift_created:{shift_id} |
| シフト変更 | shift_updated | 担当者 | shift_updated:{shift_id}:{timestamp} |
| シフトキャンセル | shift_cancelled | 担当者 | shift_cancelled:{shift_id} |
| シフト確定 | shift_confirmed | 担当者 | shift_confirmed:{shift_id} |
| 作業開始 | job_started | 管理者 | job_started:{job_id} |
| 作業完了 | job_completed | 管理者 | job_completed:{job_id} |
| AI評価アラート | ai_evaluation_alert | 管理者 | ai_evaluation_alert:{eval_id} |
| 報告書完成 | report_ready | 管理者 + 顧客 | report_ready:{report_id}:{target_id} |
| 経費申請 | expense_submitted | 管理者全員 | expense_submitted:{expense_id}:{admin_id} |
| 経費承認 | expense_approved | 申請者 | expense_approved:{expense_id} |
| 経費却下 | expense_rejected | 申請者 | expense_rejected:{expense_id} |
| 見積書公開 | quote_published | 顧客 | quote_published:{invoice_id}:{account_id} |
| 請求書発行 | invoice_issued | 顧客 | invoice_issued:{invoice_id}:{account_id} |
| 入金確認 | payment_received | 管理者 | payment_received:{invoice_id} |
| 支払期限超過 | invoice_overdue | 管理者 | invoice_overdue:{invoice_id}:{today}:{admin_id} |

---

## 6. ENV設定

```bash
# サーバーサイドのみ（NEXT_PUBLIC_禁止）
LINE_CHANNEL_ACCESS_TOKEN=  # LINE Messaging API チャンネルアクセストークン
LINE_CHANNEL_SECRET=        # LINE チャンネルシークレット

# 各システムのURL（通知リンク生成用）
HIKARU_CONSOLE_URL=         # 管理者向けコンソールURL
HIKARU_SYSTEM_URL=          # 従業員向けシステムURL
HIKARU_PARTNER_URL=         # 協力業者向けURL
HIKARU_CLIENT_URL=          # 顧客ポータルURL

# 期限超過バッチ認証（任意）
CRON_SECRET=                # Vercel Cron からのリクエスト認証
```

---

## 7. RLS設計

| テーブル | 管理者 | 従業員 | 協力業者 | 顧客 |
|---------|--------|--------|---------|------|
| line_notification_logs | SELECT（同一company_id） | × | × | × |
| profiles.line_user_id | CRUD | 自分のみ更新 | 自分のみ更新 | × |

---

## 8. 重複防止ロジック

```
notification_key = "${event_type}:${entity_id}[:${additional_info}]"
例:
  "shift_created:abc123"
  "expense_approved:def456"
  "invoice_overdue:ghi789:2026-08-09:admin-id"

notification.service.ts:
  1. notificationKeyが存在し、status != 'failed' → skipped
  2. status = 'failed' → 再試行を許可（UPSERT）
```

---

## 9. エラー処理

```
sendNotification() の戻り値:
  { success: true }                              → sent
  { success: true, skipped: true, skipReason }   → skipped
  { success: false, error }                      → failed（ログに記録）

業務処理の分離:
  void sendNotification(...)  ← returnを待たない
  → 業務API は常に成功レスポンスを返す
  → LINE失敗は line_notification_logs.status = 'failed' として記録
```

---

## 10. 再送フロー

```
CONSOLE > 通知管理 > 失敗ログ一覧
  → 「再送」ボタン
  → POST /api/notifications/{id}/resend
  → resendNotification(logId, companyId)
  → LINE API再送 → ログ更新
```

---

## 11. 期限超過バッチ

```
POST /api/invoices/overdue

実行タイミング: 毎日朝（Vercel Cron または手動実行）
認証: x-cron-secret ヘッダー

処理:
  1. status IN ('issued','sent','awaiting_payment','overdue') かつ due_date < today の請求書を取得
  2. 同一company_idの管理者へ通知
  3. 冪等キー: invoice_overdue:{id}:{today}:{admin_id} → 1日1回のみ

Vercel cron.json 設定例:
{
  "crons": [{
    "path": "/api/invoices/overdue",
    "schedule": "0 9 * * *"
  }]
}
```

---

## 12. 将来拡張ポイント

- **メール通知**: sendNotification() にemail channelを追加するだけ
- **アプリ内通知**: 同様にchannel追加
- **イベント別ON/OFF**: notification_preferences テーブルを追加し、サービス内でチェック
- **LINE Login**: profiles.line_user_id を LINE Login OAuth コールバックで自動設定
- **LINE公式アカウント Webhook**: ユーザーがメッセージ送信 → line_user_id を自動取得
