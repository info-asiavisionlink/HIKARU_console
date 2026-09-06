// ============================================================
// HIKARU Universal Import — Editable Field Metadata (Phase U3)
//
// 目的:
//   Review UI 上で「どの canonical field を、どの入力方式で編集できるか」を
//   entity 別に 1 箇所に集約する。UI (input/select/reference dropdown) の
//   生成と Server 側 PATCH allowlist の両方で参照される「唯一の真実」。
//
// 設計原則:
//   - Server-authoritative:
//       クライアントから来た field 名をそのまま mapped_data に merge しない。
//       必ずここに定義された EDITABLE_FIELDS に含まれる field のみ patch を許可。
//       内部 UUID (company_id / session_id / row_id / client_id / worker_id 等)
//       は絶対に editable にしない。
//
//   - Type-driven UI:
//       field 毎に type (text / date / time / money / boolean / enum /
//       reference) を宣言し、UI 側はこの type を見て input を切り替える。
//       これにより「巨大な if entity === ...」を UI 全体に散らさない。
//
//   - Enum canonical:
//       enum field は canonical value (Migration + enum-dictionaries 参照)
//       の一覧を options として持ち、UI は選択された canonical をそのまま
//       server 送信する。日本語表示 label はここで管理。
//
//   - Reference:
//       reference field は「どの entity table を参照するか」を宣言し、
//       server 側は candidate UUID を必ず company_id 制約で再検証する。
//       ここに載っていない reference type は絶対に resolve しない。
//
//   - Non-editable の明示除外:
//       Migration commit RPC が受け付ける (allowlist) column であっても、
//       ユーザーが Review 画面で書き換えるべきでないもの (workflow 系:
//       submitted_at / approved_at / settled_at / withdrawn_at /
//       approved_by / settled_by / receipt_url / claim_month の一部、
//       shift_id / job_id / worker_id 内部 UUID 系) は EDITABLE から除外。
//
//   - Historical Import 副作用ゼロ契約維持:
//       Expense / Attendance / Shift の editable set は
//       「業務判定 → status 遷移 → 通知発火」を招く field を含めない。
// ============================================================

import type { ImportEntityType } from '@/types/import'

// ---- Field type ----

export type FieldType =
  | 'text'
  | 'date'
  | 'time'
  | 'datetime'   // ISO 8601 (TIMESTAMPTZ) — attendance の clock_in 等、raw を RPC で cast する
  | 'money'      // integer 表現の日本円 (¥1,280 → 1280)
  | 'integer'    // 純粋な整数 (break_minutes 等)
  | 'boolean'
  | 'enum'
  | 'reference'  // 他 entity への FK (client / store / employee / project / partner)

export type ReferenceType = 'client' | 'store' | 'employee' | 'project' | 'partner'

export interface EditableField {
  /** canonical field 名 (mapped_data key) */
  key:       string
  /** UI label (Japanese) */
  label:     string
  /** input 種別 */
  type:      FieldType
  /** enum 選択肢 (type='enum' の時のみ) */
  enumOptions?: ReadonlyArray<{ value: string; label: string }>
  /** reference 対象 entity (type='reference' の時のみ) */
  referenceType?: ReferenceType
  /** 選択できない value を選ばせないための短い help (optional) */
  help?:     string
}

// ---- ENUM options (canonical value = 保存値、label = 表示名) ----

const EXPENSE_CATEGORY_OPTS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'transport',   label: '交通費' },
  { value: 'parking',     label: '駐車場代' },
  { value: 'supplies',    label: '備品費' },
  { value: 'consumables', label: '消耗品費' },
  { value: 'other',       label: 'その他' },
]

const EXPENSE_STATUS_OPTS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'draft',     label: '下書き' },
  { value: 'submitted', label: '申請中' },
  { value: 'approved',  label: '承認済' },
  { value: 'rejected',  label: '却下' },
  { value: 'settled',   label: '精算済' },
  { value: 'withdrawn', label: '取下げ' },
]

const PROJECT_TYPE_OPTS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'spot',      label: 'スポット' },
  { value: 'recurring', label: '定期' },
  { value: 'hotel',     label: 'ホテル' },
]

const PROJECT_STATUS_OPTS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'active',              label: '稼働中' },
  { value: 'paused',              label: '一時停止' },
  { value: 'completed',           label: '完了' },
  { value: 'cancelled',           label: 'キャンセル' },
  { value: 'scheduled_pending',   label: '予定未確定' },
  { value: 'scheduled_confirmed', label: '予定確定' },
  { value: 'in_progress',         label: '作業中' },
  { value: 'reclean_requested',   label: '再清掃要請' },
  { value: 'reclean_completed',   label: '再清掃完了' },
  { value: 'billing_pending',     label: '請求保留' },
]

const ASSIGNEE_TYPE_OPTS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'employee', label: '従業員' },
  { value: 'partner',  label: '協力業者' },
]

const SHIFT_STATUS_OPTS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'scheduled',   label: '予定' },
  { value: 'confirmed',   label: '確定' },
  { value: 'in_progress', label: '作業中' },
  { value: 'completed',   label: '完了' },
  { value: 'cancelled',   label: 'キャンセル' },
]

const EMPLOYEE_STATUS_OPTS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'active',    label: '在籍中' },
  { value: 'on_leave',  label: '休職中' },
  { value: 'resigned',  label: '退職' },
  { value: 'suspended', label: '停止中' },
]

const GENDER_OPTS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'male',   label: '男性' },
  { value: 'female', label: '女性' },
  { value: 'other',  label: 'その他' },
]

const BOOLEAN_OPTS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'true',  label: 'はい' },
  { value: 'false', label: 'いいえ' },
]

// ---- Per-entity editable fields ----

const CLIENT_FIELDS: ReadonlyArray<EditableField> = [
  { key: 'name',         label: '会社名',      type: 'text' },
  { key: 'code',         label: '顧客コード',  type: 'text' },
  { key: 'contact_name', label: '担当者名',    type: 'text' },
  { key: 'phone',        label: '電話番号',    type: 'text' },
  { key: 'email',        label: 'メールアドレス', type: 'text' },
  { key: 'address',      label: '住所',        type: 'text' },
  { key: 'notes',        label: '備考',        type: 'text' },
]

const STORE_FIELDS: ReadonlyArray<EditableField> = [
  { key: 'name',              label: '店舗名',       type: 'text' },
  { key: 'code',              label: '店舗コード',   type: 'text' },
  { key: 'client_id',         label: '顧客',         type: 'reference', referenceType: 'client', help: '顧客一覧から選択' },
  { key: 'address',           label: '住所',         type: 'text' },
  { key: 'phone',             label: '電話番号',     type: 'text' },
  { key: 'business_hours',    label: '営業時間',     type: 'text' },
  { key: 'manager_name',      label: '店長名',       type: 'text' },
  { key: 'emergency_contact', label: '緊急連絡先',   type: 'text' },
  { key: 'contract_info',     label: '契約情報',     type: 'text' },
  { key: 'notes',             label: '備考',         type: 'text' },
]

const EMPLOYEE_FIELDS: ReadonlyArray<EditableField> = [
  { key: 'name',              label: '氏名',         type: 'text' },
  { key: 'name_kana',         label: 'フリガナ',     type: 'text' },
  { key: 'employee_number',   label: '社員番号',     type: 'text' },
  { key: 'email',             label: 'メールアドレス', type: 'text' },
  { key: 'phone',             label: '電話番号',     type: 'text' },
  { key: 'birth_date',        label: '生年月日',     type: 'date' },
  { key: 'gender',            label: '性別',         type: 'enum', enumOptions: GENDER_OPTS },
  { key: 'address',           label: '住所',         type: 'text' },
  { key: 'emergency_contact', label: '緊急連絡先',   type: 'text' },
  { key: 'hire_date',         label: '入社日',       type: 'date' },
  { key: 'department',        label: '部署',         type: 'text' },
  { key: 'position',          label: '役職',         type: 'text' },
  { key: 'status',            label: '在籍状況',     type: 'enum', enumOptions: EMPLOYEE_STATUS_OPTS },
  { key: 'notes',             label: '備考',         type: 'text' },
]

const PROJECT_FIELDS: ReadonlyArray<EditableField> = [
  { key: 'name',              label: '案件名',        type: 'text' },
  { key: 'code',              label: '案件コード',    type: 'text' },
  { key: 'project_type',      label: '案件種別',      type: 'enum', enumOptions: PROJECT_TYPE_OPTS },
  { key: 'status',            label: 'ステータス',    type: 'enum', enumOptions: PROJECT_STATUS_OPTS },
  { key: 'client_id',         label: '顧客',         type: 'reference', referenceType: 'client' },
  { key: 'store_id',          label: '店舗',         type: 'reference', referenceType: 'store' },
  { key: 'start_date',        label: '開始日',        type: 'date' },
  { key: 'end_date',          label: '終了日',        type: 'date' },
  { key: 'contract_info',     label: '契約情報',      type: 'text' },
  { key: 'address',           label: '住所',          type: 'text' },
  { key: 'phone',             label: '電話番号',      type: 'text' },
  { key: 'emergency_contact', label: '緊急連絡先',    type: 'text' },
  { key: 'business_hours',    label: '営業時間',      type: 'text' },
  { key: 'assigned_to',       label: '担当者',        type: 'text' },
  { key: 'location_name',     label: '作業場所',      type: 'text' },
  { key: 'work_start_time',   label: '作業開始時刻',  type: 'time' },
  { key: 'work_end_time',     label: '作業終了時刻',  type: 'time' },
  { key: 'entry_route',       label: '入館経路',      type: 'text' },
  { key: 'key_borrowing',     label: '鍵貸出',        type: 'boolean', enumOptions: BOOLEAN_OPTS },
  { key: 'notes',             label: '備考',          type: 'text' },
]

const EXPENSE_FIELDS: ReadonlyArray<EditableField> = [
  { key: 'expense_date',   label: '発生日',        type: 'date' },
  { key: 'employee_id',    label: '申請者 (従業員)', type: 'reference', referenceType: 'employee', help: 'auth 済み従業員のみ選択可能' },
  { key: 'project_id',     label: '関連案件',      type: 'reference', referenceType: 'project' },
  { key: 'category',       label: 'カテゴリ',      type: 'enum', enumOptions: EXPENSE_CATEGORY_OPTS },
  { key: 'amount',         label: '金額',          type: 'money' },
  { key: 'description',    label: '内容',          type: 'text' },
  { key: 'status',         label: 'ステータス',    type: 'enum', enumOptions: EXPENSE_STATUS_OPTS },
  { key: 'assignee_type',  label: '申請者種別',    type: 'enum', enumOptions: ASSIGNEE_TYPE_OPTS },
  { key: 'note',           label: '備考',          type: 'text' },
]

const ATTENDANCE_FIELDS: ReadonlyArray<EditableField> = [
  { key: 'employee_id',   label: '従業員',       type: 'reference', referenceType: 'employee', help: 'auth 済み従業員のみ選択可能' },
  { key: 'work_date',     label: '勤務日',       type: 'date' },
  { key: 'clock_in',      label: '出勤時刻',     type: 'datetime', help: 'ISO 8601 (2026-03-15T09:00:00+09:00)' },
  { key: 'clock_out',     label: '退勤時刻',     type: 'datetime' },
  { key: 'break_start',   label: '休憩開始',     type: 'datetime' },
  { key: 'break_end',     label: '休憩終了',     type: 'datetime' },
  { key: 'break_minutes', label: '休憩(分)',     type: 'integer' },
  { key: 'work_minutes',  label: '勤務(分)',     type: 'integer' },
  { key: 'hourly_rate',   label: '時給',         type: 'integer' },
  { key: 'daily_pay',     label: '日給',         type: 'integer' },
  { key: 'notes',         label: '備考',         type: 'text' },
]

const SHIFT_FIELDS: ReadonlyArray<EditableField> = [
  { key: 'project_id',    label: '案件',       type: 'reference', referenceType: 'project' },
  { key: 'assignee_type', label: '担当者種別', type: 'enum', enumOptions: ASSIGNEE_TYPE_OPTS },
  { key: 'employee_id',   label: '従業員',     type: 'reference', referenceType: 'employee', help: 'assignee_type=employee の時のみ' },
  { key: 'partner_id',    label: '協力業者',   type: 'reference', referenceType: 'partner', help: 'assignee_type=partner の時のみ' },
  { key: 'shift_date',    label: 'シフト日',   type: 'date' },
  { key: 'start_time',    label: '開始時刻',   type: 'time' },
  { key: 'end_time',      label: '終了時刻',   type: 'time' },
  { key: 'status',        label: 'ステータス', type: 'enum', enumOptions: SHIFT_STATUS_OPTS },
  { key: 'notes',         label: '備考',       type: 'text' },
]

// ---- Registry ----

export const EDITABLE_FIELDS: Readonly<Record<ImportEntityType, ReadonlyArray<EditableField>>> = {
  client:     CLIENT_FIELDS,
  store:      STORE_FIELDS,
  employee:   EMPLOYEE_FIELDS,
  project:    PROJECT_FIELDS,
  expense:    EXPENSE_FIELDS,
  attendance: ATTENDANCE_FIELDS,
  shift:      SHIFT_FIELDS,
  // 未実装 entity は空配列 (invoice 等、SUPPORTED_COMMIT_ENTITIES 外)
  invoice:    [],
} as const

/** 指定 entity で編集可能な field 一覧を返す (順序は UI 表示順として意味を持つ) */
export function getEditableFields(entityType: ImportEntityType): ReadonlyArray<EditableField> {
  return EDITABLE_FIELDS[entityType] ?? []
}

/** 指定 entity + field が編集許可されているか */
export function isEditableField(entityType: ImportEntityType, field: string): boolean {
  return getEditableFields(entityType).some(f => f.key === field)
}

/** 指定 entity + field の metadata を返す (未登録なら undefined) */
export function getFieldMeta(entityType: ImportEntityType, field: string): EditableField | undefined {
  return getEditableFields(entityType).find(f => f.key === field)
}

// ---- Internal UUID / ownership fields (Server 側 patch 絶対禁止) ----
//
// クライアントがこれらを body に混入させても、server 側は無条件で reject する
// (defense in depth)。EDITABLE_FIELDS allowlist で正当な reference field
// (`client_id` / `store_id` / `employee_id` / `project_id` / `partner_id`) は
// EditableField(type=reference) 経由で明示的に取り扱う。ここに列挙されている
// 内部 workflow 系 UUID は、Review UI からは編集不可。

export const PATCH_FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
  'id',
  'session_id',
  'company_id',
  'file_id',
  'row_index',
  'raw_data',
  'normalized_data',
  'validation_status',
  'validation_errors',
  'review_status',
  'created_at',
  'updated_at',
  'created_by',
  'approved_by',
  'settled_by',
  'worker_id',           // employee.auth_user_id 経由でのみ resolve される (client 直接指定禁止)
  'worker_fk_status',
  'client_fk_status',
  'store_fk_status',
  'project_fk_status',
  'employee_fk_status',
  'partner_fk_status',
  'shift_id',
  'job_id',
  'submitted_at',
  'approved_at',
  'settled_at',
  'withdrawn_at',
  'reject_reason',
])
