// ============================================================
// HIKARU Universal Import — Header Synonyms (Phase U2)
//
// 目的:
//   L2 tier で「意味は同じだが名前が違う」CSV/XLSX header を
//   canonical field へ deterministic に変換する。
//
//   例:
//     スタッフNo. / 従業員コード / 社員ID  → employee_number
//     購入日     / 利用日       / 経費日   → expense_date
//     支払額     / 税込金額     / 合計金額 → amount
//     費目       / 経費区分     / 支出区分 → category
//
// 設計原則:
//   - Entity-aware:
//       各 entity で独立した dictionary。global dictionary は cross-entity
//       誤 mapping (例: client.contact_name vs. employee.name の「名前」)
//       の原因になるため禁止。
//
//   - Deterministic:
//       明示的 alias 追加のみ。
//       Levenshtein / AI / embedding / fuzzy 一切使わない。
//       未知 header は synonym で「似ているから」自動 mapping しない。
//
//   - Anti-ambiguity:
//       同じ normalized synonym が 1 entity 内で複数の異なる canonical field
//       を指す場合、mapper が AMBIGUOUS 扱いで自動 mapping しない。
//       first-match-wins による silent 誤 mapping を防ぐ。
//
//   - Non-destructive to L0/L1:
//       既存 alias (L0 exact / L1 normalized) が hit する header はここで
//       上書きしない。mapper 側は L0 → L1 → L2 の順で fallback するため、
//       L1 と L2 が同じ normalized key で異なる canonical を指す場合は
//       mapper が cross-tier collision として L2 側を skip する (defensive)。
//
//   - Data-only (header 意味変換のみ):
//       L2 は「列名を canonical に読み替える」だけ。value 変換 (日付/金額/enum)
//       は Phase U1 の value normalizer が担当する。ここに value 変換ロジックを
//       混ぜない。
//
// Format:
//   `ReadonlyArray<[synonym, canonical_field]>` — 既存 ALIASES と同型。
//   これにより mapper 側で同じ construction ロジックを使い回せる。
// ============================================================

// ---- CLIENT ----
// canonical: name, code, contact_name, phone, email, address, notes

export const CLIENT_SYNONYMS: ReadonlyArray<[string, string]> = [
  // name
  ['お客様名',       'name'],

  // code (顧客/取引先 の別名 — 番号語尾)
  ['顧客番号',       'code'],
  ['取引先番号',     'code'],

  // contact_name (窓口担当 / 代表者)
  ['窓口担当',       'contact_name'],
  ['代表者',         'contact_name'],

  // address
  ['本社所在地',     'address'],
]

// ---- STORE ----
// canonical: name, code, address, phone, business_hours, manager_name,
//            emergency_contact, contract_info, notes, client_code, client_name

export const STORE_SYNONYMS: ReadonlyArray<[string, string]> = [
  // code (店舗/店/拠点 の別名)
  ['店舗番号',       'code'],
  ['店番号',         'code'],
  ['拠点コード',     'code'],

  // manager_name (責任者)
  ['責任者',         'manager_name'],
  ['責任者名',       'manager_name'],
]

// ---- EMPLOYEE ----
// canonical: employee_number, name, name_kana, birth_date, gender, phone, email,
//            address, emergency_contact, hire_date, department, position, status, notes

export const EMPLOYEE_SYNONYMS: ReadonlyArray<[string, string]> = [
  // employee_number (社員/スタッフ/従業員 の別名 + ID / No 語尾)
  ['社員No',         'employee_number'],
  ['社員No.',        'employee_number'],
  ['スタッフ番号',   'employee_number'],
  ['スタッフNo',     'employee_number'],
  ['スタッフNo.',    'employee_number'],
  ['社員ID',         'employee_number'],
  ['従業員ID',       'employee_number'],

  // name (スタッフ名 / 社員名)
  ['スタッフ名',     'name'],
  ['社員名',         'name'],

  // phone (携帯番号)
  ['携帯',           'phone'],
  ['携帯番号',       'phone'],

  // hire_date (採用日)
  ['採用日',         'hire_date'],

  // status (雇用状態)
  ['雇用状態',       'status'],
]

// ---- PROJECT ----
// canonical: name, code, project_type, status, client_code, client_name,
//            store_code, store_name, start_date, end_date, contract_info,
//            address, phone, emergency_contact, business_hours, assigned_to,
//            location_name, work_start_time, work_end_time, entry_route, key_borrowing, notes

export const PROJECT_SYNONYMS: ReadonlyArray<[string, string]> = [
  // name (清掃業界では「現場」「工事」「業務」が案件名として使われる)
  ['現場名',         'name'],
  ['現場',           'name'],
  ['工事名',         'name'],
  ['業務名',         'name'],

  // code
  ['案件番号',       'code'],
  ['現場コード',     'code'],
  ['現場番号',       'code'],

  // project_type (種別 / タイプ / 契約種別 / 作業種別)
  ['案件タイプ',     'project_type'],
  ['契約種別',       'project_type'],
  ['作業種別',       'project_type'],

  // status (状態 / 案件状態 / 進捗状況)
  ['案件状態',       'status'],
  ['進捗状況',       'status'],

  // start_date / end_date (契約 / 作業 期間)
  ['契約開始日',     'start_date'],
  ['作業開始日',     'start_date'],
  ['契約終了日',     'end_date'],
  ['作業終了日',     'end_date'],

  // store FK (施設 / 拠点 は店舗を指す別名として運用される)
  ['施設',           'store_name'],
  ['施設名',         'store_name'],
  ['拠点',           'store_name'],
]

// ---- EXPENSE ----
// canonical: employee_number, employee_name, expense_date, category, amount,
//            description, receipt_url, status, note, assignee_type,
//            project_code, project_name, claim_month

export const EXPENSE_SYNONYMS: ReadonlyArray<[string, string]> = [
  // employee_number
  ['スタッフ番号',   'employee_number'],
  ['スタッフNo',     'employee_number'],
  ['社員No',         'employee_number'],
  ['社員ID',         'employee_number'],

  // employee_name (従業員名 / 社員名 / スタッフ名)
  ['従業員名',       'employee_name'],
  ['社員名',         'employee_name'],
  ['スタッフ名',     'employee_name'],

  // expense_date (購入 / 利用 / 使用 / 経費 の別名)
  ['購入日',         'expense_date'],
  ['利用日',         'expense_date'],
  ['使用日',         'expense_date'],
  ['経費日',         'expense_date'],

  // category (費目 / 経費区分 / 支出区分)
  ['費目',           'category'],
  ['経費区分',       'category'],
  ['支出区分',       'category'],

  // amount (支払額 / 支払金額 / 合計金額 / 税込金額 / 経費金額)
  ['支払額',         'amount'],
  ['支払金額',       'amount'],
  ['合計金額',       'amount'],
  ['税込金額',       'amount'],
  ['経費金額',       'amount'],

  // description (摘要 / 用途 / 購入内容)
  ['摘要',           'description'],
  ['用途',           'description'],
  ['購入内容',       'description'],

  // status (申請状態)
  ['申請状態',       'status'],

  // note (コメント)
  ['コメント',       'note'],

  // project_name (現場 / 現場名 として project を参照)
  ['現場',           'project_name'],
  ['現場名',         'project_name'],
]

// ---- ATTENDANCE ----
// canonical: employee_number, employee_name, work_date, clock_in, clock_out,
//            break_start, break_end, break_minutes, work_minutes, hourly_rate,
//            daily_pay, notes

export const ATTENDANCE_SYNONYMS: ReadonlyArray<[string, string]> = [
  // employee_number
  ['スタッフ番号',   'employee_number'],
  ['スタッフNo',     'employee_number'],
  ['社員No',         'employee_number'],

  // employee_name
  ['社員名',         'employee_name'],
  ['スタッフ名',     'employee_name'],

  // work_date (出勤日 / 勤務年月日)
  ['出勤日',         'work_date'],
  ['勤務年月日',     'work_date'],

  // clock_in (始業)
  ['始業',           'clock_in'],
  ['始業時刻',       'clock_in'],

  // clock_out (終業)
  ['終業',           'clock_out'],
  ['終業時刻',       'clock_out'],

  // break_start / break_end (詳細語尾)
  ['休憩開始時刻',   'break_start'],
  ['休憩終了時刻',   'break_end'],

  // break_minutes (休憩時間 / 休憩分 / 休憩時間分)
  ['休憩時間',       'break_minutes'],
  ['休憩分',         'break_minutes'],
  ['休憩時間分',     'break_minutes'],

  // work_minutes (勤務時間 / 実働時間 / 勤務分 / 実働分)
  ['勤務時間',       'work_minutes'],
  ['実働時間',       'work_minutes'],
  ['勤務分',         'work_minutes'],
  ['実働分',         'work_minutes'],
]

// ---- SHIFT ----
// canonical: project_code, project_name, assignee_type, employee_number,
//            employee_name, partner_code, partner_name, shift_date,
//            start_time, end_time, status, notes

export const SHIFT_SYNONYMS: ReadonlyArray<[string, string]> = [
  // project_name (現場 / 現場名 として project を参照)
  ['現場',           'project_name'],
  ['現場名',         'project_name'],

  // employee_number (スタッフ番号 / スタッフNo / 従業員コード)
  ['スタッフ番号',   'employee_number'],
  ['スタッフNo',     'employee_number'],
  ['従業員コード',   'employee_number'],

  // employee_name (従業員名 / 社員名 / スタッフ名)
  ['従業員名',       'employee_name'],
  ['社員名',         'employee_name'],
  ['スタッフ名',     'employee_name'],

  // partner_name (パートナー)
  ['パートナー',     'partner_name'],

  // shift_date (作業日)
  ['作業日',         'shift_date'],

  // start_time (開始時間 / 出勤時刻 / 作業開始)
  ['開始時間',       'start_time'],
  ['出勤時刻',       'start_time'],
  ['作業開始',       'start_time'],

  // end_time (終了時間 / 退勤時刻 / 作業終了)
  ['終了時間',       'end_time'],
  ['退勤時刻',       'end_time'],
  ['作業終了',       'end_time'],
]

// ---- Registry ----

/**
 * 指定 entity の synonym 一覧を返す。未知 entity は空。
 * mapper.ts の buildHeaderMapping から呼ばれる。
 */
export function getSynonyms(entityType: string): ReadonlyArray<[string, string]> {
  switch (entityType) {
    case 'client':     return CLIENT_SYNONYMS
    case 'store':      return STORE_SYNONYMS
    case 'employee':   return EMPLOYEE_SYNONYMS
    case 'project':    return PROJECT_SYNONYMS
    case 'expense':    return EXPENSE_SYNONYMS
    case 'attendance': return ATTENDANCE_SYNONYMS
    case 'shift':      return SHIFT_SYNONYMS
    default:           return []
  }
}
