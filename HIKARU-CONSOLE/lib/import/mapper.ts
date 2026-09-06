// ============================================================
// HIKARU Import — Deterministic Header Mapping
//
// 設計方針:
//   - AI推測禁止。明示的な alias map のみ。
//   - Header Mappingはファイル単位で1回だけ決定 → 全Rowに適用 (N×推測禁止)
//   - 未認識HeaderはCLIENTS/STORESのいずれでも unmapped として残す
//   - raw_data / normalized_data を変更しない
//   - mapped_data のみを生成 (key = HIKARU canonical field name)
//   - OpenAI calls: 0
//
// 対象Canonical Schema (Migration 002より):
//
//   clients: id, company_id, name*, code, email, phone, address,
//            contact_name, notes, is_active
//
//   stores: id, client_id, company_id, name*, code, address, phone,
//           business_hours, manager_name, emergency_contact, contract_info,
//           notes, is_active
//
//   (*) = NOT NULL (required for commit)
// ============================================================

import type { ImportEntityType } from '@/types/import'

// ---- Alias Maps ----
// key = normalized header (lowercase for comparison), value = canonical field name
// Multiple source headers can map to the same canonical field (first match wins)

const CLIENT_ALIASES: ReadonlyArray<[string, string]> = [
  // name (required)
  ['会社名',      'name'],
  ['顧客名',      'name'],
  ['法人名',      'name'],
  ['取引先名',    'name'],
  ['取引先',      'name'],
  ['name',        'name'],
  ['client_name', 'name'],
  ['company',     'name'],
  ['company_name','name'],
  ['client',      'name'],

  // code
  ['顧客コード',  'code'],
  ['取引先コード','code'],
  ['顧客no',      'code'],
  ['code',        'code'],
  ['client_code', 'code'],
  ['no',          'code'],

  // email
  ['メール',          'email'],
  ['メールアドレス',  'email'],
  ['email',           'email'],
  ['e-mail',          'email'],
  ['e_mail',          'email'],
  ['mail',            'email'],

  // phone
  ['電話',            'phone'],
  ['電話番号',        'phone'],
  ['tel',             'phone'],
  ['phone',           'phone'],
  ['連絡先電話番号',  'phone'],
  ['電話no',          'phone'],

  // address
  ['住所',   'address'],
  ['所在地', 'address'],
  ['address','address'],
  ['住所1',  'address'],

  // contact_name
  ['担当者',      'contact_name'],
  ['担当者名',    'contact_name'],
  ['担当',        'contact_name'],
  ['窓口',        'contact_name'],
  ['contact',     'contact_name'],
  ['contact_name','contact_name'],

  // notes
  ['備考',   'notes'],
  ['メモ',   'notes'],
  ['notes',  'notes'],
  ['note',   'notes'],
  ['備考欄', 'notes'],
]

const STORE_ALIASES: ReadonlyArray<[string, string]> = [
  // name (required)
  ['店舗名',    'name'],
  ['店名',      'name'],
  ['拠点名',    'name'],
  ['施設名',    'name'],
  ['施設',      'name'],
  ['name',      'name'],
  ['store_name','name'],
  ['branch',    'name'],

  // code
  ['店舗コード','code'],
  ['店舗no',    'code'],
  ['code',      'code'],
  ['store_code','code'],

  // address
  ['住所',      'address'],
  ['所在地',    'address'],
  ['address',   'address'],
  ['店舗住所',  'address'],

  // phone
  ['電話',      'phone'],
  ['電話番号',  'phone'],
  ['tel',       'phone'],
  ['phone',     'phone'],
  ['店舗電話',  'phone'],

  // business_hours
  ['営業時間',      'business_hours'],
  ['営業',          'business_hours'],
  ['business_hours','business_hours'],

  // manager_name (NOTE: '担当者' maps to contact_name in client, manager_name in store)
  ['店長',        'manager_name'],
  ['店長名',      'manager_name'],
  ['manager',     'manager_name'],
  ['manager_name','manager_name'],
  ['担当者',      'manager_name'],

  // emergency_contact
  ['緊急連絡先',      'emergency_contact'],
  ['緊急',            'emergency_contact'],
  ['emergency',       'emergency_contact'],
  ['emergency_contact','emergency_contact'],

  // contract_info
  ['契約情報',   'contract_info'],
  ['contract_info','contract_info'],
  ['契約',       'contract_info'],

  // notes
  ['備考',   'notes'],
  ['メモ',   'notes'],
  ['notes',  'notes'],
  ['note',   'notes'],
  ['備考欄', 'notes'],

  // client FK reference (Map phase で client_id に resolve される)
  ['顧客コード',   'client_code'],
  ['取引先コード', 'client_code'],
  ['client_code',  'client_code'],
  ['顧客名',       'client_name'],
  ['取引先名',     'client_name'],
  ['取引先',       'client_name'],
  ['client_name',  'client_name'],
  ['client',       'client_name'],
]

// ---- Employee Aliases ----
// Backing schema: public.employees (migration 011)
// Import 対象 columns (allowlist, auth_user_id は必ず NULL / employee_number は trigger auto-generate 可):
//   employee_number, name, name_kana, birth_date, gender, phone, email, address,
//   emergency_contact, hire_date, department, position, notes, status
// Not imported: qualifications[] (複雑)、auth_user_id (auth 招待は import では発生禁止)

const EMPLOYEE_ALIASES: ReadonlyArray<[string, string]> = [
  // name (required)
  ['氏名',        'name'],
  ['名前',        'name'],
  ['従業員名',    'name'],
  ['employee_name','name'],
  ['name',        'name'],
  ['full_name',   'name'],

  // name_kana
  ['フリガナ',     'name_kana'],
  ['ふりがな',     'name_kana'],
  ['カナ',         'name_kana'],
  ['name_kana',    'name_kana'],
  ['kana',         'name_kana'],

  // employee_number (UNIQUE)
  ['社員番号',       'employee_number'],
  ['従業員番号',     'employee_number'],
  ['従業員コード',   'employee_number'],
  ['employee_no',    'employee_number'],
  ['employee_number','employee_number'],
  ['employee_code',  'employee_number'],
  ['emp_no',         'employee_number'],

  // email
  ['メール',         'email'],
  ['メールアドレス', 'email'],
  ['email',          'email'],
  ['e-mail',         'email'],
  ['e_mail',         'email'],
  ['mail',           'email'],

  // phone
  ['電話',        'phone'],
  ['電話番号',    'phone'],
  ['tel',         'phone'],
  ['phone',       'phone'],
  ['連絡先',      'phone'],

  // birth_date
  ['生年月日',   'birth_date'],
  ['誕生日',     'birth_date'],
  ['birth_date', 'birth_date'],
  ['birthday',   'birth_date'],
  ['dob',        'birth_date'],

  // gender (enum: 'male' | 'female' | 'other')
  ['性別',   'gender'],
  ['gender', 'gender'],
  ['sex',    'gender'],

  // address
  ['住所',    'address'],
  ['所在地',  'address'],
  ['address', 'address'],

  // emergency_contact
  ['緊急連絡先',         'emergency_contact'],
  ['緊急',               'emergency_contact'],
  ['emergency_contact',  'emergency_contact'],
  ['emergency',          'emergency_contact'],

  // hire_date
  ['入社日',     'hire_date'],
  ['雇用開始日', 'hire_date'],
  ['hire_date',  'hire_date'],
  ['start_date', 'hire_date'],
  ['join_date',  'hire_date'],

  // department
  ['所属部署', 'department'],
  ['部署',     'department'],
  ['所属',     'department'],
  ['department','department'],

  // position
  ['役職',     'position'],
  ['ポジション','position'],
  ['position', 'position'],
  ['title',    'position'],

  // status (enum: active|on_leave|resigned|suspended|deleted)
  ['ステータス', 'status'],
  ['在籍状況',   'status'],
  ['status',     'status'],

  // notes
  ['備考',   'notes'],
  ['メモ',   'notes'],
  ['notes',  'notes'],
  ['note',   'notes'],
  ['備考欄', 'notes'],
]

// ---- Project Aliases ----
// Backing schema: public.projects (migration 002 + 008 + 013 + 018 + 020 + 021 + 022)
// Import 対象 columns (Migration 057 allowlist と一致):
//   name, code, project_type, status, client_id (resolved), store_id (resolved),
//   start_date, end_date, contract_info, notes, address, phone, emergency_contact,
//   business_hours, assigned_to, location_name, work_start_time, work_end_time,
//   entry_route, key_borrowing

const PROJECT_ALIASES: ReadonlyArray<[string, string]> = [
  // name (required)
  ['案件名',    'name'],
  ['プロジェクト名', 'name'],
  ['project_name','name'],
  ['name',      'name'],

  // code
  ['案件コード','code'],
  ['プロジェクトコード', 'code'],
  ['project_code','code'],
  ['code',      'code'],

  // project_type (spot/recurring/hotel)
  ['案件種別',   'project_type'],
  ['種別',       'project_type'],
  ['project_type','project_type'],
  ['type',       'project_type'],

  // status
  ['ステータス', 'status'],
  ['状態',       'status'],
  ['status',     'status'],

  // client FK (Map phase で client_id に resolve)
  ['顧客コード',   'client_code'],
  ['取引先コード', 'client_code'],
  ['client_code',  'client_code'],
  ['顧客名',       'client_name'],
  ['取引先名',     'client_name'],
  ['取引先',       'client_name'],
  ['client_name',  'client_name'],
  ['client',       'client_name'],

  // store FK (Map phase で store_id に resolve)
  ['店舗コード', 'store_code'],
  ['店舗no',     'store_code'],
  ['store_code', 'store_code'],
  ['店舗名',     'store_name'],
  ['store_name', 'store_name'],
  ['store',      'store_name'],

  // start_date / end_date
  ['開始日',     'start_date'],
  ['start_date', 'start_date'],
  ['開始',       'start_date'],
  ['終了日',     'end_date'],
  ['end_date',   'end_date'],
  ['終了',       'end_date'],

  // contract_info
  ['契約情報',   'contract_info'],
  ['契約',       'contract_info'],
  ['contract_info','contract_info'],

  // address / phone / emergency_contact / business_hours
  ['住所',      'address'],
  ['所在地',    'address'],
  ['address',   'address'],
  ['電話',      'phone'],
  ['電話番号',  'phone'],
  ['phone',     'phone'],
  ['tel',       'phone'],
  ['緊急連絡先',    'emergency_contact'],
  ['emergency_contact','emergency_contact'],
  ['営業時間',      'business_hours'],
  ['business_hours','business_hours'],

  // assigned_to / location_name
  ['担当者',     'assigned_to'],
  ['assigned_to','assigned_to'],
  ['担当',       'assigned_to'],
  ['作業場所',   'location_name'],
  ['location_name','location_name'],

  // work_start_time / work_end_time (TIME)
  ['作業開始時刻', 'work_start_time'],
  ['作業開始',     'work_start_time'],
  ['work_start_time','work_start_time'],
  ['作業終了時刻', 'work_end_time'],
  ['作業終了',     'work_end_time'],
  ['work_end_time','work_end_time'],

  // entry_route
  ['入館経路',   'entry_route'],
  ['entry_route','entry_route'],

  // key_borrowing (boolean)
  ['鍵貸出',       'key_borrowing'],
  ['key_borrowing','key_borrowing'],

  // notes
  ['備考',   'notes'],
  ['メモ',   'notes'],
  ['notes',  'notes'],
  ['note',   'notes'],
]

// ---- Expense Aliases ----
// Backing schema: public.expenses (production audited)
// worker_id は Map phase で employee → auth_user_id resolve 済 (Import では既存 auth_user のみ許容)

const EXPENSE_ALIASES: ReadonlyArray<[string, string]> = [
  // worker (Map phase: employee → auth_user_id)
  ['社員番号',       'employee_number'],
  ['従業員番号',     'employee_number'],
  ['従業員コード',   'employee_number'],
  ['employee_number','employee_number'],
  ['emp_no',         'employee_number'],
  ['従業員',         'employee_name'],
  ['申請者',         'employee_name'],
  ['申請者名',       'employee_name'],
  ['employee_name',  'employee_name'],
  ['worker_name',    'employee_name'],

  // expense_date (required)
  ['発生日',      'expense_date'],
  ['支出日',      'expense_date'],
  ['expense_date','expense_date'],
  ['日付',        'expense_date'],
  ['date',        'expense_date'],

  // category (enum)
  ['カテゴリ',    'category'],
  ['カテゴリー',  'category'],
  ['category',    'category'],
  ['種別',        'category'],

  // amount (integer)
  ['金額',    'amount'],
  ['amount',  'amount'],

  // description
  ['内容',      'description'],
  ['description','description'],
  ['詳細',      'description'],

  // receipt_url
  ['領収書URL',  'receipt_url'],
  ['receipt_url','receipt_url'],
  ['receipt',    'receipt_url'],

  // status (enum)
  ['ステータス', 'status'],
  ['status',     'status'],
  ['状態',       'status'],

  // note
  ['備考',   'note'],
  ['メモ',   'note'],
  ['notes',  'note'],
  ['note',   'note'],
  ['備考欄', 'note'],

  // assignee_type (employee/partner)
  ['申請者種別', 'assignee_type'],
  ['assignee_type','assignee_type'],

  // project relation (Map phase で project_id に resolve)
  ['案件コード',   'project_code'],
  ['project_code', 'project_code'],
  ['案件名',       'project_name'],
  ['project_name', 'project_name'],

  // claim_month (支給月)
  ['対象月',     'claim_month'],
  ['請求月',     'claim_month'],
  ['claim_month','claim_month'],
  ['支給月',     'claim_month'],
]

// ---- Attendance Aliases ----
// Backing schema: public.attendance_records
// worker_id は Map phase で employee → auth_user_id resolve 済

const ATTENDANCE_ALIASES: ReadonlyArray<[string, string]> = [
  // worker (Map phase: employee → auth_user_id)
  ['社員番号',       'employee_number'],
  ['従業員番号',     'employee_number'],
  ['従業員コード',   'employee_number'],
  ['employee_number','employee_number'],
  ['emp_no',         'employee_number'],
  ['従業員',         'employee_name'],
  ['氏名',           'employee_name'],
  ['employee_name',  'employee_name'],
  ['worker_name',    'employee_name'],

  // work_date (required)
  ['勤務日',    'work_date'],
  ['work_date', 'work_date'],
  ['日付',      'work_date'],
  ['date',      'work_date'],

  // clock timestamps
  ['出勤時刻',  'clock_in'],
  ['出勤',      'clock_in'],
  ['clock_in',  'clock_in'],
  ['退勤時刻',  'clock_out'],
  ['退勤',      'clock_out'],
  ['clock_out', 'clock_out'],

  // break
  ['休憩開始',   'break_start'],
  ['break_start','break_start'],
  ['休憩終了',   'break_end'],
  ['break_end',  'break_end'],
  ['休憩分数',   'break_minutes'],
  ['休憩(分)',   'break_minutes'],
  ['break_minutes','break_minutes'],

  // work minutes
  ['勤務分数',    'work_minutes'],
  ['勤務(分)',    'work_minutes'],
  ['work_minutes','work_minutes'],

  // hourly rate / daily pay
  ['時給',         'hourly_rate'],
  ['hourly_rate',  'hourly_rate'],
  ['日給',         'daily_pay'],
  ['daily_pay',    'daily_pay'],

  // notes
  ['備考',   'notes'],
  ['メモ',   'notes'],
  ['notes',  'notes'],
  ['note',   'notes'],
]

// ---- Shift Aliases ----
// Backing schema: public.shifts (migration 026)
// project / employee / partner は Map phase で resolve

const SHIFT_ALIASES: ReadonlyArray<[string, string]> = [
  // project (Map phase で project_id に resolve)
  ['案件コード',   'project_code'],
  ['project_code', 'project_code'],
  ['案件名',       'project_name'],
  ['project_name', 'project_name'],
  ['案件',         'project_name'],

  // assignee_type
  ['担当者種別',  'assignee_type'],
  ['assignee_type','assignee_type'],

  // employee (Map phase で employee_id に resolve)
  ['社員番号',       'employee_number'],
  ['従業員番号',     'employee_number'],
  ['employee_number','employee_number'],
  ['emp_no',         'employee_number'],
  ['従業員',         'employee_name'],
  ['氏名',           'employee_name'],
  ['employee_name',  'employee_name'],

  // partner (Map phase で partner_id に resolve)
  ['協力業者コード', 'partner_code'],
  ['partner_code',   'partner_code'],
  ['協力業者名',     'partner_name'],
  ['partner_name',   'partner_name'],
  ['協力業者',       'partner_name'],

  // shift_date
  ['シフト日',   'shift_date'],
  ['勤務日',     'shift_date'],
  ['shift_date', 'shift_date'],
  ['日付',       'shift_date'],
  ['date',       'shift_date'],

  // start_time / end_time (TIME)
  ['開始時刻',  'start_time'],
  ['開始',      'start_time'],
  ['start_time','start_time'],
  ['終了時刻',  'end_time'],
  ['終了',      'end_time'],
  ['end_time',  'end_time'],

  // status (enum)
  ['ステータス', 'status'],
  ['status',     'status'],
  ['状態',       'status'],

  // notes
  ['備考',   'notes'],
  ['メモ',   'notes'],
  ['notes',  'notes'],
  ['note',   'notes'],
]

// ---- Required Fields ----
// Note: FK は Map route が resolve 後に inject する。
// 未 resolve (null) の場合は REQUIRED check で invalid になる。

const CLIENT_REQUIRED:     ReadonlySet<string> = new Set(['name'])
const STORE_REQUIRED:      ReadonlySet<string> = new Set(['name', 'client_id'])
const EMPLOYEE_REQUIRED:   ReadonlySet<string> = new Set(['name'])
// Project: name のみ必須。FK (client_id / store_id) は optional。project_type / status は DB default 有り。
const PROJECT_REQUIRED:    ReadonlySet<string> = new Set(['name'])
// Expense: worker_id (Map で解決) + expense_date が実運用上必須。category / amount は DB default で default 有りだが Import では明示要求。
const EXPENSE_REQUIRED:    ReadonlySet<string> = new Set(['worker_id', 'expense_date'])
// Attendance: worker_id (Map で解決) + work_date が UNIQUE 対象。
const ATTENDANCE_REQUIRED: ReadonlySet<string> = new Set(['worker_id', 'work_date'])
// Shift: project_id + assignee_type + shift_date + start_time + end_time は DB NOT NULL。
const SHIFT_REQUIRED:      ReadonlySet<string> = new Set([
  'project_id', 'assignee_type', 'shift_date', 'start_time', 'end_time',
])

// ---- Types ----

export type HeaderMapping = Record<string, string>  // normalizedHeader → canonicalField
export type MappedData    = Record<string, string | null>  // canonicalField → normalized value
export type UnmappedKeys  = string[]

export interface MappingResult {
  headerMapping:  HeaderMapping   // which normalized header → which canonical field
  unmappedHeaders: UnmappedKeys  // normalized headers with no mapping
}

export interface RowMappingResult {
  mappedData:      MappedData
  unmappedHeaders: UnmappedKeys
}

export interface RowValidationResult {
  isValid:         boolean
  status:          'valid' | 'warning' | 'invalid'
  missingRequired: string[]     // canonical field names that are required but missing/null
  invalidFields:   Array<{ field: string; reason: string }>
}

// ---- Build Header Mapping (once per file) ----
// AliasをlowercaseでmatchするためnormalizedHeaderをlowercase比較する。

export function buildHeaderMapping(
  normalizedHeaders: string[],
  entityType: ImportEntityType,
): MappingResult {
  const aliases = getAliases(entityType)

  // Pre-build a lookup: lowercase(alias) → canonicalField
  const aliasLookup = new Map<string, string>()
  for (const [alias, field] of aliases) {
    const key = alias.toLowerCase()
    if (!aliasLookup.has(key)) aliasLookup.set(key, field)  // first match wins
  }

  const headerMapping:   HeaderMapping = {}
  const unmappedHeaders: UnmappedKeys  = []
  const usedCanonical = new Set<string>()

  for (const header of normalizedHeaders) {
    if (!header || header.startsWith('_col') || header.startsWith('_raw_col')) continue

    const match = aliasLookup.get(header.toLowerCase())
    if (match && !usedCanonical.has(match)) {
      headerMapping[header] = match
      usedCanonical.add(match)
    } else if (!match) {
      unmappedHeaders.push(header)
    }
    // duplicate alias (same canonical field already mapped) → silently skip second header
  }

  return { headerMapping, unmappedHeaders }
}

// ---- Apply Mapping to one Row ----

export function applyRowMapping(
  normalizedData: Record<string, string | null>,
  mapping: MappingResult,
): RowMappingResult {
  const mappedData: MappedData = {}

  for (const [normHeader, canonicalField] of Object.entries(mapping.headerMapping)) {
    mappedData[canonicalField] = normalizedData[normHeader] ?? null
  }

  return {
    mappedData,
    unmappedHeaders: mapping.unmappedHeaders,
  }
}

// ---- Validate Mapped Row ----

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateMappedRow(
  mappedData: MappedData,
  entityType: ImportEntityType,
  unmappedHeaders: UnmappedKeys,
): RowValidationResult {
  const required       = getRequired(entityType)
  const missingRequired: string[]                              = []
  const invalidFields: Array<{ field: string; reason: string }> = []

  // Required field check
  for (const field of required) {
    const val = mappedData[field]
    if (val === null || val === undefined || val.trim() === '') {
      missingRequired.push(field)
    }
  }

  // Store の client_id FK resolution 状態を明示 error に反映
  if (entityType === 'store') {
    const fkStatus = mappedData['client_fk_status']
    if (fkStatus === 'ambiguous') {
      invalidFields.push({ field: 'client_id', reason: '顧客名が複数の顧客に一致しました。顧客コードで指定してください' })
    } else if (fkStatus === 'not_found') {
      invalidFields.push({ field: 'client_id', reason: '指定された顧客が見つかりませんでした (顧客コードまたは顧客名を確認してください)' })
    }
  }

  // Phase B: 4 entity の FK resolution 状態を明示 error に反映
  if (entityType === 'project') {
    // client_id は optional、store_id も optional。ambiguous/not_found はエラー、無指定は OK
    const clientFk = mappedData['client_fk_status']
    if (clientFk === 'ambiguous') invalidFields.push({ field: 'client_id', reason: '顧客名が複数一致しました。顧客コードで指定してください' })
    else if (clientFk === 'not_found') invalidFields.push({ field: 'client_id', reason: '指定された顧客が見つかりませんでした' })

    const storeFk = mappedData['store_fk_status']
    if (storeFk === 'ambiguous') invalidFields.push({ field: 'store_id', reason: '店舗名が複数一致しました。店舗コードで指定してください' })
    else if (storeFk === 'not_found') invalidFields.push({ field: 'store_id', reason: '指定された店舗が見つかりませんでした' })
  }

  if (entityType === 'expense') {
    const workerFk = mappedData['worker_fk_status']
    if (workerFk === 'ambiguous')       invalidFields.push({ field: 'worker_id', reason: '従業員名が複数一致しました。社員番号で指定してください' })
    else if (workerFk === 'not_found')  invalidFields.push({ field: 'worker_id', reason: '指定された従業員が見つかりませんでした' })
    else if (workerFk === 'missing_auth_user') invalidFields.push({ field: 'worker_id', reason: 'この従業員はまだログインアカウントが作成されていません。先にアカウント招待が必要です' })

    const projectFk = mappedData['project_fk_status']
    if (projectFk === 'ambiguous')      invalidFields.push({ field: 'project_id', reason: '案件名が複数一致しました。案件コードで指定してください' })
    else if (projectFk === 'not_found') invalidFields.push({ field: 'project_id', reason: '指定された案件が見つかりませんでした' })
  }

  if (entityType === 'attendance') {
    const workerFk = mappedData['worker_fk_status']
    if (workerFk === 'ambiguous')       invalidFields.push({ field: 'worker_id', reason: '従業員名が複数一致しました。社員番号で指定してください' })
    else if (workerFk === 'not_found')  invalidFields.push({ field: 'worker_id', reason: '指定された従業員が見つかりませんでした' })
    else if (workerFk === 'missing_auth_user') invalidFields.push({ field: 'worker_id', reason: 'この従業員はまだログインアカウントが作成されていません。勤怠履歴を移行するには先にアカウント招待が必要です' })
  }

  if (entityType === 'shift') {
    const projectFk = mappedData['project_fk_status']
    if (projectFk === 'ambiguous')      invalidFields.push({ field: 'project_id', reason: '案件名が複数一致しました。案件コードで指定してください' })
    else if (projectFk === 'not_found') invalidFields.push({ field: 'project_id', reason: '指定された案件が見つかりませんでした' })

    const assigneeType = mappedData['assignee_type']
    if (assigneeType === 'employee') {
      const employeeFk = mappedData['employee_fk_status']
      if (employeeFk === 'ambiguous')      invalidFields.push({ field: 'employee_id', reason: '従業員名が複数一致しました。社員番号で指定してください' })
      else if (employeeFk === 'not_found') invalidFields.push({ field: 'employee_id', reason: '指定された従業員が見つかりませんでした' })
    } else if (assigneeType === 'partner') {
      const partnerFk = mappedData['partner_fk_status']
      if (partnerFk === 'ambiguous')      invalidFields.push({ field: 'partner_id', reason: '協力業者名が複数一致しました。協力業者コードで指定してください' })
      else if (partnerFk === 'not_found') invalidFields.push({ field: 'partner_id', reason: '指定された協力業者が見つかりませんでした' })
    }
  }

  // Email format check
  if (mappedData['email'] !== null && mappedData['email'] !== undefined && mappedData['email'] !== '') {
    if (!EMAIL_RE.test(mappedData['email']!)) {
      invalidFields.push({ field: 'email', reason: 'メールアドレスの形式が正しくありません' })
    }
  }

  // String length sanity (PostgreSQL TEXT is unlimited, but catch extreme values)
  for (const [field, val] of Object.entries(mappedData)) {
    if (val && val.length > 5000) {
      invalidFields.push({ field, reason: `値が長すぎます (${val.length}文字)` })
    }
  }

  const isValid = missingRequired.length === 0 && invalidFields.length === 0

  let status: RowValidationResult['status']
  if (!isValid) {
    status = missingRequired.length > 0 ? 'invalid' : 'warning'
  } else if (unmappedHeaders.length > 0) {
    status = 'warning'
  } else {
    status = 'valid'
  }

  return { isValid, status, missingRequired, invalidFields }
}

// ---- Helpers ----

function getAliases(entityType: ImportEntityType): ReadonlyArray<[string, string]> {
  if (entityType === 'client')     return CLIENT_ALIASES
  if (entityType === 'store')      return STORE_ALIASES
  if (entityType === 'employee')   return EMPLOYEE_ALIASES
  if (entityType === 'project')    return PROJECT_ALIASES
  if (entityType === 'expense')    return EXPENSE_ALIASES
  if (entityType === 'attendance') return ATTENDANCE_ALIASES
  if (entityType === 'shift')      return SHIFT_ALIASES
  // Other entity types: return empty (unmapped phase — future)
  return []
}

function getRequired(entityType: ImportEntityType): ReadonlySet<string> {
  if (entityType === 'client')     return CLIENT_REQUIRED
  if (entityType === 'store')      return STORE_REQUIRED
  if (entityType === 'employee')   return EMPLOYEE_REQUIRED
  if (entityType === 'project')    return PROJECT_REQUIRED
  if (entityType === 'expense')    return EXPENSE_REQUIRED
  if (entityType === 'attendance') return ATTENDANCE_REQUIRED
  if (entityType === 'shift')      return SHIFT_REQUIRED
  return new Set()
}

// ---- Employee-specific validation helpers (for entity_type='employee') ----
// gender / status enum validation は commit RPC 側で行う (defense in depth)。
// validateMappedRow の generic 部 (required + email + length) で最低限をカバーし、
// enum の詳細 validation は staging 時ではなく commit 前の RPC check に委ねる。
