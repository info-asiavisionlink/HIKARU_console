# 案件中心設計（Migration 008）

## 設計変更の背景

HIKARUは飲食店・店舗だけでなく、**戸建住宅・マンション・オフィス・病院・学校・工場・ホテル・建設現場**など、あらゆる清掃案件で利用する。

「店舗管理」という概念は業種を限定してしまうため廃止し、**「案件中心設計」**に移行。

---

## 変更内容

### 廃止
- サイドメニューの「店舗管理」
- 案件作成フォームの「店舗選択」
- `photo_spots.store_id` による撮影箇所管理

### 追加
- `projects` テーブルに作業場所情報を直接持つ
- `photo_spots.project_id` による撮影箇所管理

---

## projects テーブル追加フィールド（Migration 008）

| カラム | 型 | 説明 |
|---|---|---|
| `location_name` | TEXT | 作業場所名（○○マンション/病院/工場など） |
| `phone` | TEXT | 現場の電話番号 |
| `emergency_contact` | TEXT | 緊急連絡先 |
| `business_hours` | TEXT | 作業可能時間帯 |

既存の `store_id` は後方互換のため残す（NULL許容）。

---

## 案件が持つ情報（完全版）

```
案件（projects）
├── 案件名
├── 案件コード
├── 顧客（clients FK）
├── ステータス（active/paused/completed/cancelled）
├── 担当者（assigned_to）
├── 開始日 / 終了日
│
├── 作業場所情報（Migration 008で追加）
│   ├── 作業場所名（location_name）
│   ├── 住所（address）
│   ├── 電話番号（phone）
│   ├── 緊急連絡先（emergency_contact）
│   └── 作業可能時間帯（business_hours）
│
├── 契約内容（contract_info）
├── 注意事項（notes）
│
└── 紐づくデータ
    ├── 撮影箇所（photo_spots.project_id）
    ├── 作業場所（locations.project_id）
    ├── マニュアル（manuals.project_id）
    ├── 作業記録（jobs.project_id）
    │   ├── 写真（photos.job_id）
    │   ├── AI品質評価（ai_evaluations.job_id）
    │   └── AIチャット（chat_messages.job_id）
    └── 報告書（reports.project_id）
```

---

## photo_spots テーブル変更

```sql
-- 追加
project_id UUID REFERENCES projects(id) ON DELETE CASCADE

-- 既存（後方互換）
store_id UUID REFERENCES stores(id)  -- NULL許容
```

既存データは Migration 008 で自動的に `project_id` へ移行済み。

---

## 利用可能な業種例

| 業種 | 作業場所名の例 |
|---|---|
| マンション | グランドパレス渋谷 202号室 |
| 病院 | 〇〇総合病院 手術室棟 |
| オフィス | △△ビル 3F ABCカンパニー |
| 工場 | □□製造 第2工場 |
| 学校 | ◇◇小学校 体育館 |
| ホテル | ▽▽ホテル 客室412号 |
| 戸建住宅 | 田中様邸 |
| 建設現場 | ○○プロジェクト 現場 |
