# 従業員・協力業者管理 DB設計

> Migration: `011_employee_partner_management.sql`

---

## 設計思想

HIKARUはSaaSではなく、**自社運用型清掃管理システム**です。

- 管理者がすべてのアカウントを発行・管理
- 招待メールなし。管理者がID/パスワードを直接設定
- 従業員・協力業者の区別をシステムで明確化
- 案件割り当ても管理者が実施し、作業者は担当案件のみ閲覧可能

---

## テーブル構成

### employees（従業員マスタ）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | 従業員ID |
| employee_number | TEXT UNIQUE | 社員番号（EMP-0001形式で自動採番）|
| company_id | UUID FK→companies | 所属会社 |
| name | TEXT NOT NULL | 氏名 |
| name_kana | TEXT | フリガナ |
| birth_date | DATE | 生年月日 |
| gender | TEXT | 性別 (male/female/other) |
| phone | TEXT | 電話番号 |
| email | TEXT | メールアドレス（業務連絡用） |
| address | TEXT | 住所 |
| emergency_contact | TEXT | 緊急連絡先 |
| hire_date | DATE | 入社日 |
| department | TEXT | 所属部署 |
| position | TEXT | 役職 |
| qualifications | TEXT[] | 保有資格 |
| notes | TEXT | 備考 |
| status | employee_status | ステータス（下記参照）|
| auth_user_id | UUID UNIQUE FK→auth.users | ログインアカウントへの紐付け（任意）|
| created_at / updated_at | TIMESTAMPTZ | 日時 |

**employee_status Enum:**
- `active` - 在籍中
- `on_leave` - 休職中
- `resigned` - 退職
- `suspended` - 利用停止
- `deleted` - 削除済み（論理削除）

---

### partners（協力業者マスタ）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | 協力業者ID |
| company_id | UUID FK→companies | 発注元会社 |
| company_name | TEXT NOT NULL | 会社名 |
| company_name_kana | TEXT | 会社名カナ |
| contact_person_name | TEXT | 担当者名 |
| contact_person_kana | TEXT | 担当者カナ |
| phone | TEXT | 電話番号 |
| email | TEXT | メールアドレス |
| address | TEXT | 住所 |
| billing_info | JSONB | 請求先情報 |
| contract_start_date | DATE | 契約開始日 |
| contract_end_date | DATE | 契約終了日 |
| service_areas | TEXT[] | 対応可能エリア |
| service_types | TEXT[] | 対応可能業務 |
| qualifications | TEXT[] | 保有資格 |
| notes | TEXT | 備考 |
| status | partner_status | ステータス（下記参照）|
| auth_user_id | UUID UNIQUE FK→auth.users | ログインアカウントへの紐付け（任意）|
| created_at / updated_at | TIMESTAMPTZ | 日時 |

**partner_status Enum:**
- `active` - 契約中
- `suspended` - 一時停止
- `terminated` - 契約終了
- `deleted` - 削除済み（論理削除）

---

### project_assignments（案件割り当て）

`project_workers` の後継テーブル。従業員・協力業者の両方に対応。

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| project_id | UUID FK→projects | 案件ID |
| assignee_type | TEXT | 'employee' または 'partner' |
| assignee_id | UUID | employees.id または partners.id |
| assigned_at | TIMESTAMPTZ | 割り当て日時 |

**制約:** `UNIQUE(project_id, assignee_type, assignee_id)`

---

### profiles テーブル変更（追記）

| カラム追加 | 型 | 説明 |
|---|---|---|
| entity_type | TEXT | 'employee' または 'partner'（adminはNULL）|
| entity_id | UUID | employees.id または partners.id |

ログインユーザーがどの従業員/協力業者レコードに対応するかを示す。

---

## ER図（関連）

```
auth.users
    │
    │ auth_user_id (1:1 optional)
    ├──────────────────► employees
    │                        │
    │                        │ entity_id (profiles.entity_id)
    │                        ▼
    │                   profiles ◄──────── auth.users
    │
    └──────────────────► partners
                             │
                             │ entity_id (profiles.entity_id)
                             ▼
                         profiles

projects ◄──── project_assignments ────► employees / partners
                 (assignee_type, assignee_id)
```

---

## RLS 設計

### helpers（SECURITY DEFINER関数）

```sql
-- ログインユーザーの entity_id (employees.id or partners.id)
get_my_entity_id() → UUID

-- ログインユーザーの entity_type
get_my_entity_type() → TEXT

-- 担当プロジェクトID一覧（project_assignments経由）
get_my_assigned_project_ids() → SETOF UUID

-- 管理者の会社の全プロジェクトID一覧
get_my_admin_project_ids() → SETOF UUID

-- ログインユーザーの company_id
get_my_company_id() → UUID
```

### employees RLS

| 操作 | 対象 | 条件 |
|---|---|---|
| ALL | 管理者 | company_id = get_my_company_id() |
| SELECT | 本人 | auth_user_id = auth.uid() |

### partners RLS

| 操作 | 対象 | 条件 |
|---|---|---|
| ALL | 管理者 | company_id = get_my_company_id() |
| SELECT | 本人 | auth_user_id = auth.uid() |

### project_assignments RLS

| 操作 | 対象 | 条件 |
|---|---|---|
| ALL | 管理者 | project_id IN get_my_admin_project_ids() |
| SELECT | 担当者 | assignee_id = get_my_entity_id() AND assignee_type = get_my_entity_type() |

### projects RLS（更新）

| 操作 | 対象 | 条件 |
|---|---|---|
| SELECT | 担当者 | id IN get_my_assigned_project_ids()（project_assignments経由）|

---

## 権限設計

| ロール | ログイン先 | 説明 |
|---|---|---|
| admin | HIKARU-CONSOLE のみ | profiles.role = 'admin' の従業員 |
| worker（従業員）| HIKARU-System のみ | profiles.role = 'worker' / entity_type = 'employee' |
| worker（協力業者）| HIKARU-System のみ | profiles.role = 'worker' / entity_type = 'partner' |

管理者は `profiles.role = 'admin'` かつ `entity_type = 'employee'` の従業員のみ。

---

## アカウント発行フロー

```
管理者が HIKARU-CONSOLE で操作
    │
    ├─ 従業員を登録（/employees/new）
    │       ├─ 業務情報を入力
    │       ├─ ログイン設定（メール/パスワード/権限）を入力
    │       └─ 保存 → API → admin.createUser() → employees INSERT
    │                              → profiles 更新（entity_type='employee', entity_id）
    │
    └─ 協力業者を登録（/partners/new）
            ├─ 会社情報を入力
            ├─ ログイン設定（メール/パスワード）を入力
            └─ 保存 → API → admin.createUser() → partners INSERT
                                   → profiles 更新（entity_type='partner', entity_id）
```

招待メールは送信されない。管理者がIDとパスワードを直接伝達する。

---

## 案件割り当てフロー

```
管理者が案件を作成/編集
    │
    ├─ 担当者セクションで「従業員」を選択 → employees一覧から選ぶ
    ├─ 担当者セクションで「協力業者」を選択 → partners一覧から選ぶ
    └─ 複数登録可能
           │
           └─ 保存 → PUT /api/projects/[id]/assignments
                         → project_assignments INSERT (upsert)
```

---

## HIKARU-System での閲覧制御

```
作業者がログイン
    │
    └─ profiles から entity_type / entity_id を取得
           │
           └─ project_assignments WHERE assignee_id = entity_id AND assignee_type = entity_type
                   │
                   └─ 担当案件のみ表示（HIKARU-System）
```

---

## 削除方針

- **論理削除** を基本とする
- `status = 'deleted'` に更新（実データは保持）
- ログインアカウントは `auth.admin.updateUserById()` で BAN（`ban_duration: '876600h'`）
- 物理削除は不要な場合は実施しない

---

## 拡張性

- 将来的に `employee_status` に 'maternity_leave'（産休）等を追加可能
- `billing_info` はJSONBなので請求先の項目を自由に拡張可能
- `project_assignments` の `assignee_type` に 'client_staff' 等を追加することで顧客担当者への拡張も可能
