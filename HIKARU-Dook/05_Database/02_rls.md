# Row Level Security（RLS）設計

## 概要

SupabaseのRLS（行レベルセキュリティ）を全テーブルに設定します。  
ユーザーは自分に関係するデータのみアクセスできます。

---

## ロール別アクセス権限

| テーブル | admin | worker | client |
|---|---|---|---|
| users | 自社ユーザー全件 | 自分のみ | 自分のみ |
| companies | 自社のみ | 読み取り | - |
| clients | 自社の全件 | 読み取り | 自分のみ |
| stores | 自社の全件 | 担当案件の店舗 | 自分の店舗 |
| projects | 自社の全件 | 担当案件のみ | 自店舗の案件 |
| locations | 自社の全件 | 担当案件の場所 | 読み取り |
| manuals | CRUD | 担当案件のみ読み取り | - |
| jobs | 自社の全件 | 自分の担当のみ | 自店舗の作業 |
| photos | 自社の全件 | 自分の担当のみ | 自店舗のみ |
| ai_evaluations | 自社の全件 | 自分の担当のみ | 自店舗のみ |
| reports | 自社の全件 | 自分の担当のみ | 自店舗のみ |
| chat_history | 自社の全件 | 自分のみ | - |

---

## 重要ルール

1. **全テーブルにRLSを有効化すること**（デフォルトでは無効）
2. Service Role Keyは管理者操作のみサーバーサイドで使用
3. クライアントサイドからはAnon Keyのみ使用
4. RLSポリシーはマイグレーションファイルで管理する

---

## 実装方針

```sql
-- 例: jobs テーブルのRLS
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- 作業者は自分の担当ジョブのみ参照可
CREATE POLICY "worker_own_jobs" ON jobs
  FOR SELECT USING (
    auth.uid() = worker_id
  );

-- 管理者は自社のジョブすべて参照可
CREATE POLICY "admin_company_jobs" ON jobs
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM users
      WHERE role = 'admin' AND company_id = (
        SELECT company_id FROM projects WHERE id = jobs.project_id
      )
    )
  );
```
