---
name: console-progress
description: HIKARUコンソール開発進捗。完了した機能と現在の状態
metadata:
  type: project
---

第6回完了：案件管理を3種類（単発・定期・ホテル）に全面リファクタリング

**完了済み機能（累積）:**
- 管理画面全基本機能（CRUD・検索・フィルター・ページネーション）
- 従業員管理・協力業者管理（アカウント発行・パスワード変更・論理削除）
- 案件管理（全案件一覧 + 種別ナビ）
  - 単発案件: /projects/spot（作業日時・内容・必要人数）
  - 定期案件: /projects/recurring（周期設定・年間スケジュール12ヶ月）
  - ホテル案件: /projects/hotel（フロア管理・稼働管理・作業エリア）
- サイドバー: 案件管理→ネスト型ナビ（全案件/単発/定期/ホテル）

**DB状態（Supabase: cgdrrowxfraykeyyafxg）:**
- Migration 011: employees / partners / project_assignments 作成済み
- Migration 012: テストデータ投入済み（従業員10名 / 協力業者10社）
- Migration 013: project_type Enum / spot_project_details / recurring_project_details / recurring_monthly_schedules / hotel_project_details / hotel_floors / hotel_staffing_rules / hotel_work_areas 作成済み
- 実際のcompany_id: 5ef11de6-d45f-4b05-a761-19ccd62fafc2

**Why:** 将来100社・複数ホテル・数千件規模に対応するための拡張設計。

**How to apply:** 新案件ページ追加時はproject_typeに応じたdetailテーブルを使う設計を維持。
