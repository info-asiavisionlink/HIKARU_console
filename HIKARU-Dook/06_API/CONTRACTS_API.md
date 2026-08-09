# Phase 7: 電子契約・契約書管理 API設計

**実装日**: 2026-08-09  
**対象アプリ**: HIKARU-CONSOLE  

---

## エンドポイント一覧

### 契約 CRUD

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/contracts` | 契約一覧 + KPI |
| POST | `/api/contracts` | 契約作成 |
| GET | `/api/contracts/[id]` | 契約詳細 + ファイル一覧 |
| PUT | `/api/contracts/[id]` | 契約更新 |
| DELETE | `/api/contracts/[id]` | 論理削除（status→terminated） |

### ファイル管理

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/contracts/[id]/upload` | 契約書アップロード（バージョン管理） |
| GET | `/api/contracts/[id]/file` | Signed URL取得（10分） |

### アクション

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/contracts/[id]/publish` | ポータル公開切り替え |
| POST | `/api/contracts/[id]/sign` | 契約締結記録 |

### 履歴・通知

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/contracts/[id]/events` | 監査ログ一覧 |
| POST | `/api/contracts/expiry-check` | 期限チェック＆LINE通知送信 |

---

## GET /api/contracts

### クエリパラメータ

| パラメータ | 説明 |
|-----------|------|
| `search` | 契約名・番号・相手名で検索 |
| `status` | ステータスフィルター |
| `contract_type` | 種類フィルター |
| `counterparty_type` | `client` / `partner` |
| `auto_renewal` | `true` / `false` |
| `expiring_days` | N日以内に期限が来る契約 |

### レスポンス

```json
{
  "contracts": [
    {
      "id": "...",
      "title": "定期清掃業務委託契約",
      "contract_type": "service",
      "status": "active",
      "end_date": "2027-03-31",
      "deadline": {
        "daysUntilExpiry": 234,
        "urgency": "normal",
        "label": "234日後"
      },
      "clients": { "id": "...", "name": "株式会社○○" },
      "projects": { "id": "...", "title": "○○ビル定期清掃" }
    }
  ],
  "kpi": {
    "total": 12,
    "active": 8,
    "expiring30d": 2,
    "expired": 1,
    "auto_renewal": 5,
    "client_count": 7,
    "partner_count": 5
  }
}
```

---

## POST /api/contracts

### リクエストボディ

```json
{
  "title": "定期清掃業務委託契約",
  "contract_number": "CON-2026-001",
  "counterparty_type": "client",
  "client_id": "uuid",
  "project_id": "uuid",
  "contract_type": "service",
  "start_date": "2026-04-01",
  "end_date": "2027-03-31",
  "renewal_date": "2027-03-31",
  "auto_renewal": true,
  "notes": "備考テキスト",
  "internal_memo": "社内向けメモ"
}
```

---

## POST /api/contracts/[id]/upload

- `Content-Type: multipart/form-data`
- フィールド: `file`
- 許可形式: PDF, JPEG, PNG, GIF, WebP, DOCX
- 最大サイズ: 20MB
- バージョン管理: 旧バージョンは `is_current=false` で保持

---

## GET /api/contracts/[id]/file

- クエリ: `?version=N`（省略時は最新）
- レスポンス: `{ url, file_name, version, mime_type, file_size }`
- URL有効期限: 10分（Signed URL）

---

## POST /api/contracts/expiry-check

- 期限が設定された `active` / `signed` / `reviewing` 状態の契約をスキャン
- 60日前・30日前・7日前・当日 に管理者へLINE通知
- 重複通知防止: `contract_expiry_notifications` で今年同一通知をスキップ
- レスポンス: `{ checked, notified, skipped, results }`

---

## LINE通知イベント種別

| イベント | 説明 |
|---------|------|
| `contract_expiry_60d` | 契約終了60日前 |
| `contract_expiry_30d` | 契約終了30日前 |
| `contract_expiry_7d` | 契約終了7日前 |
| `contract_expiry_0d` | 契約終了当日 |

---

## セキュリティ方針

- 全APIは認証必須（`getAuthContext()`）
- 全クエリに `company_id` フィルター強制
- 契約書ファイルはPrivate Storage + Signed URLのみ
- APIキー（LINE, CloudSign等）はサーバーサイドENVのみ

---

## 将来のCloudSign/DocuSign連携

```typescript
// sign_provider = 'cloudsign' の場合の拡張ポイント
// app/api/contracts/[id]/sign/route.ts
if (sign_provider === 'cloudsign') {
  // TODO: CloudSign API連携
  // const cloudSignRes = await createCloudSignRequest(contract, apiKey)
  // updatePayload.sign_request_id = cloudSignRes.requestId
}
```

ENV（将来追加予定）:
```bash
# CLOUDSIGN_API_KEY=
# DOCUSIGN_INTEGRATION_KEY=
# DOCUSIGN_ACCOUNT_ID=
```
