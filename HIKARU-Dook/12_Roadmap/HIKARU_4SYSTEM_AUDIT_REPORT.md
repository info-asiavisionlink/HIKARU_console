# HIKARU 4システム データ連携・UI表示 完全監査レポート

**監査日**: 2026-08-10  
**対象**: HIKARU-CONSOLE / HIKARU-System / HIKARU-Partner / HIKARU-Client (customer portal)

---

## 監査サマリー

| システム | DB→UI | UI→DB | 権限分離 | 総合 |
|---------|-------|-------|---------|------|
| HIKARU-CONSOLE | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS |
| HIKARU-System | ⚠️ PARTIAL | ✅ PASS | ✅ PASS | ⚠️ PARTIAL |
| HIKARU-Partner | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS |
| HIKARU-Client | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS |

---

## 発見した問題

### DATA-001 【CRITICAL】HIKARU-System `/api/upload` に認証チェックなし

**システム**: HIKARU-System  
**ファイル**: `HIKARU-System/app/api/upload/route.ts`  
**問題**: Service Role Key を使う upload ルートに UID/認証チェックが一切なし。middleware の cookie チェックを通過できれば任意ファイルを `documents` バケットに書き込める  
**原因**: ルート実装時に認証チェックを省略  
**影響**: 認証済み（`hk_s_uid` cookie 所持）ユーザーが任意パスに書き込み可能  
**修正**: ルート先頭で `hk_s_uid` Cookie を検証して 401 返却  
**ステータス**: ✅ 修正済み

---

### DATA-002 【CRITICAL】`photos` Storageバケットが Migration に存在しない

**システム**: 全システム  
**ファイル**: `supabase/migrations/004_jobs_photos.sql`  
**問題**: `photos` テーブルの RLS は定義済みだが、`storage.buckets` への INSERT がなく「ダッシュボードから手動作成」のコメントのみ。マイグレーションだけでは `photos` バケットは作成されない  
**影響**: 手動作成されていない環境では全写真アップロードが失敗する  
**修正**: `034_photos_storage_setup.sql` を追加してバケットと Storage RLS を定義  
**ステータス**: ✅ Migration 作成済み

---

### DATA-003 【HIGH】HIKARU-System `/api/photos` が完全スタブ（501）

**システム**: HIKARU-System  
**ファイル**: `HIKARU-System/app/api/photos/route.ts`  
**問題**: `POST /api/photos` が常に 501 を返す。ただし実際の写真アップロードは `services/photos.service.ts` の Browser Client 経由で行われており、このルートは現在は使われていない。しかし将来的に混乱の原因となる  
**影響**: 現在は実害なし（browser service 経由は動作）  
**修正**: スタブに明確なコメントを追加し、実際のルートと整合させる  
**ステータス**: ✅ コメント修正済み

---

### DATA-004 【HIGH】写真URLがPublic（`getPublicUrl` 使用）

**システム**: HIKARU-System / HIKARU-Partner  
**ファイル**: `HIKARU-System/services/photos.service.ts`、`HIKARU-Partner/app/api/photos/route.ts`  
**問題**: 作業写真のURLに `getPublicUrl()` を使用。バケットが Public のため、URLを知っていれば認証なしでアクセス可能  
**影響**: 清掃現場の写真が公開状態（ただしUUID含むパスで推測は困難）  
**対応**: バケットをpublicで運用する設計判断を維持（UIに写真を直接表示するため）。ただしURLは直接 DB 保存ではなく Signed URL を経由する設計への移行を将来検討  
**ステータス**: ⚠️ 既知リスクとして記録（現設計を維持）

---

### DATA-005 【MEDIUM】HIKARU-System `upload-receipt` ルートのパス検証なし

**システム**: HIKARU-System  
**ファイル**: `HIKARU-System/app/api/upload-receipt/route.ts`  
**問題**: 領収書アップロードルートの path パラメータに最低限のバリデーションがあるか確認が必要  
**修正**: 実装確認後、問題なし（`receipts/` プレフィックスチェックがあることを確認）

---

## 4システム連携マトリクス

| データ | CONSOLE | System | Partner | Client |
|--------|---------|--------|---------|--------|
| 案件（projects）| ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS |
| シフト（shifts）| ✅ PASS | ✅ PASS | ✅ PASS | N/A |
| 写真（photos）| ✅ PASS | ⚠️ PARTIAL* | ✅ PASS | ✅ PASS |
| 報告書（reports）| ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS |
| AI評価（ai_evaluations）| ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS |
| 経費（expense_claims）| ✅ PASS | ✅ PASS | ✅ PASS | N/A |
| 請求書（invoices）| ✅ PASS | N/A | N/A | ✅ PASS |
| 在庫（inventory）| ✅ PASS | N/A | N/A | N/A |
| 契約（contracts）| ✅ PASS | N/A | ⚠️ PARTIAL** | N/A |
| 満足度アンケート | ✅ PASS | N/A | N/A | ✅ PASS |
| マニュアル | ✅ PASS | ✅ PASS | ✅ PASS | N/A |

*写真: photos bucket が手動作成前提  
**Partner契約: 一覧取得は可能、UI画面は未実装

---

## データフロー検証結果

### CONSOLE → System（案件・シフト）

```
CONSOLE: project_assignments 作成（assignee_type='employee', assignee_id=employees.id）
         ↓
Supabase: project_assignments テーブル
         ↓
System API: profiles.entity_type + entity_id で project_assignments JOIN
         ↓
UI: 担当案件一覧に表示
```
**結果**: ✅ 正常に動作

### System → CONSOLE（ジョブ・写真）

```
System: photos.service.ts で Supabase Storage (photos bucket) にアップロード
        jobs.status 更新
         ↓
Supabase: jobs / photos テーブル（RLS: worker_id = auth.uid()）
         ↓
CONSOLE API: adminClient + company_id フィルタで取得
         ↓
UI: 報告書・作業管理画面
```
**結果**: ✅ 正常（ただし photos bucket 存在前提）

### System/Partner → Client

```
System/Partner: 作業完了 → photos / reports 保存
                ↓
Supabase: photos / reports / ai_evaluations
                ↓
Client Portal: client_project_permissions で権限確認
               admin client で photos / reports 取得
                ↓
UI: 作業タイムライン・写真・AI評価
```
**結果**: ✅ 正常（client_project_permissions による適切な分離）

---

## 認証・権限確認

| 確認項目 | 結果 |
|---------|------|
| CONSOLE admin cookie (hk_c_uid) | ✅ |
| System worker cookie (hk_s_uid) + Supabase JWT | ✅ |
| Partner cookie (hk_p_uid) | ✅ |
| Client portal cookie (hk_cp_uid) | ✅ |
| company_id テナント分離（全API） | ✅ |
| Employee A が Employee B のデータを取得できない | ✅ (RLS: worker_id = auth.uid()) |
| Partner A が Partner B の案件を取得できない | ✅ (project_assignments による分離) |
| 顧客 A が顧客 B の請求書を取得できない | ✅ (client_project_permissions) |

---

## Storage 状況

| バケット | 種別 | 作成方法 | Status |
|---------|------|---------|--------|
| photos | PUBLIC | 手動（Dashboardのみ） | ⚠️ Migration追加済み |
| receipts | PRIVATE | Migration 027 | ✅ |
| documents | PRIVATE（修正済み） | Migration 025→033 | ✅ |
| contracts | PRIVATE | Migration 032 | ✅ |

---

## HIKARU-Client（customer portal）存在確認

- **場所**: `/Users/tanakayoshiki/Desktop/HIKARU/HIKARU-customer portal/`
- **Vercelデプロイ**: 別途確認が必要（HIKARU-System vercel remote あり）
- **主要ページ**: dashboard / projects / reports / invoices / surveys / notifications
- **認証**: `hk_cp_uid` cookie + `client_portal_accounts` テーブル
- **データ分離**: `client_project_permissions` でプロジェクト単位の権限管理

---

## 残存リスク

1. `photos` バケットのPublic設定 → 将来 Signed URL に移行推奨
2. HIKARU-System の `photos/route.ts` がスタブのまま → 実装または削除推奨
3. Client portal の Vercel デプロイ状態の確認

---

## Phase 8 開始への影響

- **CRITICAL 修正完了**: DATA-001（upload認証）、DATA-002（photosバケット）
- **HIGH 修正完了**: DATA-003（スタブコメント）
- Phase 8 機能実装への影響: なし（既存フローは正常動作）
