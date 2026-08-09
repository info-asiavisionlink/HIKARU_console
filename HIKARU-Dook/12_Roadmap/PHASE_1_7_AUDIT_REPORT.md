# HIKARU Phase 1〜7 総合監査レポート

**監査日**: 2026-08-10  
**監査対象**: HIKARU-CONSOLE / HIKARU-System / HIKARU-Partner / supabase/migrations 026〜032

---

## エグゼクティブサマリー

| Phase | 状態 | Critical | High | Medium | Low |
|-------|------|---------|------|--------|-----|
| Phase 1 シフト管理 | ✅ PASS | 0 | 0 | 1 | 0 |
| Phase 2 経費申請 | ✅ PASS | 0 | 1 | 0 | 0 |
| Phase 3 見積書・請求書 | ⚠️ PASS* | 0 | 1 | 0 | 0 |
| Phase 4 LINE通知 | ✅ PASS | 0 | 0 | 0 | 0 |
| Phase 5 顧客満足度 | ✅ PASS | 0 | 0 | 0 | 0 |
| Phase 6 在庫管理 | ✅ PASS | 0 | 0 | 0 | 0 |
| Phase 7 契約管理 | ❌ FAIL | 2 | 0 | 1 | 0 |
| **全体** | | **2** | **2** | **2** | **0** |

---

## Issue 一覧

---

### P7-001

**Phase**: Phase 7  
**カテゴリ**: TypeScript / Build  
**Severity**: CRITICAL  
**問題**: `app/api/contracts/expiry-check/route.ts` がTypeScriptビルドエラーを起こしている  
**原因**:  
1. Line 37: `await ...chain... as { data: any[] | null; error: unknown }` — `as` type assertion を destructuring の右辺で使う場合、`await`式を括弧で囲まないとパースエラーになる  
2. Line 118: `.on('conflict', 'do-nothing' as any)` — Supabase JS clientに `.on()` メソッドは存在しない。無効なAPIコール  
**影響**: `npm run build` が通らない。本番デプロイ不可  
**修正案**: `await` 式を括弧で包む。`.on()` を削除し、通常の `.insert()` に変更して例外をtry-catchで無視  
**対象ファイル**: `HIKARU-CONSOLE/app/api/contracts/expiry-check/route.ts`  
**ステータス**: ✅ 修正済み

---

### P7-002

**Phase**: Phase 7  
**カテゴリ**: DB Migration / SQL Syntax  
**Severity**: CRITICAL  
**問題**: `supabase/migrations/032_contracts.sql` line 129 のUNIQUE制約が無効なPostgreSQL構文  
**原因**: `UNIQUE (contract_id, notification_type, EXTRACT(YEAR FROM notified_at)::INTEGER)` — PostgreSQLのテーブルレベルUNIQUE制約には関数呼び出しを含めることができない。有効なのはGenerated ColumnまたはFunctional Index  
**影響**: Migration適用時に `ERROR: functions in index expression must be marked IMMUTABLE` でデプロイ失敗  
**修正案**: UNIQUEをテーブル定義から削除し、`CREATE UNIQUE INDEX` で代替  
**対象ファイル**: `supabase/migrations/032_contracts.sql`  
**ステータス**: ✅ 修正済み (033_contracts_fix.sql として追加)

---

### P3-001

**Phase**: Phase 3  
**カテゴリ**: Storage Security  
**Severity**: HIGH  
**問題**: `documents` バケット（`public=true`）に請求書PDFが保存されている  
**原因**: Migration 025 で `documents` バケットが `public=true` として作成された。PDF保存パスは `invoices/{company_id}/{type}/{number}.pdf` だが、バケットがpublicのため正確なパスを知れば認証なしでアクセス可能  
**影響**: 請求書・見積書の内容（金額・顧客情報）が外部に漏洩する可能性  
**修正案**: ① documents バケットを private 化 + RLS追加（Migration 033で対応）、または ② 請求書PDFを専用privateバケットに移す  
**対象ファイル**: `supabase/migrations/025_storage_documents_rls.sql`、`app/api/invoices/[id]/pdf/route.ts`  
**ステータス**: ✅ 修正済み (033_contracts_fix.sql でRLS強化)

---

### P2-001

**Phase**: Phase 2  
**カテゴリ**: UI / Loading State  
**Severity**: HIGH  
**問題**: `app/(console)/expenses/page.tsx` でネットワーク例外発生時に `setLoading(false)` が呼ばれない  
**原因**: `fetchExpenses` 関数に try-catch がなく、`fetch()` 自体がthrowした場合（タイムアウト・ネットワーク断）に `setLoading(false)` が実行されない  
**影響**: 経費管理ページがローディング状態のまま固まる  
**修正案**: try-finally に変更して `finally { setLoading(false) }` を保証  
**対象ファイル**: `HIKARU-CONSOLE/app/(console)/expenses/page.tsx`  
**ステータス**: ✅ 修正済み

---

### P1-001

**Phase**: Phase 1  
**カテゴリ**: UI / Loading State  
**Severity**: MEDIUM  
**問題**: `app/(console)/attendance/page.tsx` でfetchエラー時にloadingが解除されない  
**原因**: `.then()` チェーンのみで `.catch()` がなく、レスポンスエラー時に `setLoading(false)` が未実行  
**影響**: 勤怠管理画面がローディングのまま止まる  
**修正案**: `.catch(() => setLoading(false))` を追加  
**対象ファイル**: `HIKARU-CONSOLE/app/(console)/attendance/page.tsx`  
**ステータス**: ✅ 修正済み

---

### P7-003

**Phase**: Phase 7  
**カテゴリ**: UI  
**Severity**: MEDIUM  
**問題**: `app/(console)/contracts/[id]/page.tsx` の一部UI文字列に文字化けがある（コード上の文字列エンコーディング問題）  
**原因**: ファイル内に `"に失���しました"` などの不正なUnicode置換文字が混入  
**影響**: UI表示が崩れる  
**修正案**: 対象文字列を正しい日本語に修正  
**対象ファイル**: `HIKARU-CONSOLE/app/(console)/contracts/[id]/page.tsx`  
**ステータス**: ✅ 修正済み

---

## 確認済み正常項目

### Phase 1 シフト管理
- ✅ `shifts` テーブル・RLS（admin CRUD / employee/partner 自分のみ SELECT）
- ✅ CONSOLE: シフト作成・編集・削除・確定・キャンセル
- ✅ System: `/api/shifts` 自分のシフトのみ取得（employee_id/partner_id フィルター）
- ✅ Partner: シフト表示
- ✅ company_id 分離
- ✅ LINE通知（シフト確定時）

### Phase 2 経費申請
- ✅ `expense_claims` / `expense_items` テーブル・RLS
- ✅ RLS: submitted以降は従業員が更新不可（draft のみ UPDATE 可）
- ✅ Storage: `receipts` バケットは **private**
- ✅ Signed URL で領収書取得（`/api/receipts/signed-url`）
- ✅ 承認・却下・精算フロー
- ✅ 合計金額計算
- ✅ Partner側: 経費申請実装済み

### Phase 3 見積書・請求書
- ✅ `invoices` / `invoice_items` テーブル・RLS
- ✅ `project_prices` との連携（金額二重管理なし）
- ✅ PDF生成（@react-pdf/renderer）
- ✅ 請求番号採番は DB関数 `next_invoice_number()` で行ロック付き原子的採番
- ✅ 顧客ポータル公開フラグ
- ⚠️ documents バケットが public（H3-001 で修正）

### Phase 4 LINE通知
- ✅ `LINE_CHANNEL_ACCESS_TOKEN` はサーバーサイドENVのみ（NEXT_PUBLIC_ なし）
- ✅ `line_notification_logs` で重複防止（notification_key UNIQUE）
- ✅ Phase 1〜3 の各イベントで通知実装済み
- ✅ 失敗時のログ・再送機能

### Phase 5 顧客満足度
- ✅ `satisfaction_surveys` テーブル・RLS（顧客は自分のsurveyのみ）
- ✅ AI品質スコアとの統合View (`v_quality_scores`)
- ✅ 1ジョブ1回の重複防止 UNIQUE
- ✅ company_id による顧客間データ分離

### Phase 6 在庫管理
- ✅ `inventory_items` / `inventory_transactions` テーブル・RLS
- ✅ `record_stock_transaction()` RPC で FOR UPDATE ロック + 在庫マイナス防止
- ✅ 在庫数と履歴の整合性（トリガーで自動同期）
- ✅ 最低在庫アラート

### Phase 7 契約管理
- ✅ `contracts` / `contract_files` / `contract_events` テーブル
- ✅ `contracts` Storage バケットは **private**
- ✅ Signed URL でファイル取得（10分有効）
- ✅ バージョン管理（旧ファイル保持）
- ✅ 監査ログ（contract_events）
- ✅ RLS（管理者CRUD / 顧客公開済みのみ / 協力業者制限）
- ⚠️ migration SQL syntax error（C1で修正）
- ⚠️ TypeScript build error（C2で修正）

---

## セキュリティ確認結果

| チェック項目 | 結果 |
|-----------|------|
| LINE_CHANNEL_ACCESS_TOKEN が NEXT_PUBLIC_ でない | ✅ |
| SUPABASE_SERVICE_ROLE_KEY が NEXT_PUBLIC_ でない | ✅ |
| OPENAI_API_KEY が NEXT_PUBLIC_ でない | ✅ |
| receipts バケットが private | ✅ |
| contracts バケットが private | ✅ |
| documents バケット（PDF格納） | ⚠️ public→修正 |
| 全APIルートに getAuthContext() | ✅ |
| 全APIルートに company_id フィルター | ✅ |
| 顧客が他社データを取得できない | ✅ (RLS) |
| 従業員が他社シフトを取得できない | ✅ (RLS) |

---

## Phase 8 開始条件

**CRITICAL残件**: 0（修正済み）  
**HIGH残件**: 0（修正済み）  
**MEDIUM残件**: 0（修正済み）  
**LOW残件**: 0  

→ **Phase 8 開始可能**
