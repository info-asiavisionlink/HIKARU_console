# reports テーブル（第8回追加）

## 概要

AI生成報告書を保存するテーブル。  
`content` JSONB に報告書の全データを格納し、再表示・再印刷を可能にする。

---

## テーブル定義

```sql
CREATE TABLE public.reports (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        UUID        NOT NULL REFERENCES public.jobs(id)       ON DELETE CASCADE,
  project_id    UUID        NOT NULL REFERENCES public.projects(id)   ON DELETE CASCADE,
  worker_id     UUID        NOT NULL REFERENCES public.profiles(id)   ON DELETE CASCADE,
  company_id    UUID        NOT NULL REFERENCES public.companies(id)  ON DELETE CASCADE,
  version       SMALLINT    NOT NULL DEFAULT 1,   -- 再生成のたびに+1
  content       JSONB       NOT NULL,              -- 全報告書データ
  overall_score SMALLINT,                          -- 総合品質スコア (0-100)
  pdf_url       TEXT,                              -- 将来: Supabase Storage PDF URL
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## インデックス

```sql
CREATE INDEX reports_job_id_idx     ON reports(job_id);
CREATE INDEX reports_project_id_idx ON reports(project_id);
CREATE INDEX reports_worker_id_idx  ON reports(worker_id);
CREATE INDEX reports_company_id_idx ON reports(company_id);
CREATE INDEX reports_created_at_idx ON reports(created_at DESC);
```

---

## RLS ポリシー

| ポリシー | 対象 | 権限 |
|---|---|---|
| reports: worker own | 認証ユーザー | 自分のworker_idの報告書をCRUD |
| reports: admin read company | 認証ユーザー | 同一会社の報告書を閲覧 |

---

## content JSONB スキーマ

```json
{
  "project": {
    "name": "○○店 定期清掃",
    "code": "PROJ-001",
    "address": null,
    "assigned_to": null,
    "notes": null
  },
  "store": {
    "name": "○○店",
    "address": "東京都○○区...",
    "phone": "03-xxxx-xxxx"
  },
  "client": {
    "name": "株式会社○○"
  },
  "job": {
    "work_date": "2026-08-02",
    "started_at": "2026-08-02T09:00:00+09:00",
    "completed_at": "2026-08-02T11:30:00+09:00",
    "worker_name": "田中 太郎"
  },
  "spots": [
    {
      "name": "床",
      "order": 1,
      "score": 92,
      "recommendation": "pass",
      "before_url": "https://...",
      "after_url": "https://...",
      "ai_comment": "清掃前に見られたホコリ・黒ずみは除去され...",
      "improvements": [],
      "remaining_issues": [],
      "comparison": "全体的に光沢が改善されています"
    }
  ],
  "summary": {
    "overall_score": 87,
    "passed_count": 5,
    "check_count": 1,
    "redo_count": 0,
    "total_spots": 6,
    "work_summary": "今回の清掃では...",
    "quality_assessment": "総合的に高品質な...",
    "total_comment": "全体を通して...",
    "next_recommendations": ["厨房壁際を重点清掃"]
  },
  "generated_at": "2026-08-02T11:35:00Z",
  "version": 1
}
```

---

## 関連テーブル

| テーブル | 関係 | 用途 |
|---|---|---|
| jobs | 1:N | 1つのジョブに複数バージョンの報告書 |
| projects | 参照 | 案件情報 |
| profiles | 参照 | 担当者名 |
| companies | 参照 | RLS用会社識別 |

---

## マイグレーション

`supabase/migrations/007_reports.sql` で定義済み。
