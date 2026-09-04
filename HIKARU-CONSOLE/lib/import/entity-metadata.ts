// ============================================================
// HIKARU Import — Entity Metadata (UI display only)
//
// 目的:
//   Data Migration 画面での entity 説明・フィールド一覧・状態表示に
//   使う metadata を 1 箇所に集約する。
//
// 重要:
//   - Backend の schema や API は変更しない。表示専用。
//   - フィールド一覧は「Import 時に user が指定できる主要項目」を
//     実 DB schema から抽出したもの (推測禁止)。
//   - status は現在の実装状態に基づく:
//       'enabled'      = UI + Backend 両方稼働、実際に登録可能
//       'preview_only' = Backend 実装済だが UI enable gate 未通過、preview のみ
//       'coming_soon'  = Backend 未実装、preview のみで最終処理不可
// ============================================================

import {
  Building2, Store, Users, FolderOpen, Receipt, Clock, CalendarDays,
  type LucideIcon,
} from 'lucide-react'

export type EntityKey =
  | 'client'
  | 'store'
  | 'employee'
  | 'project'
  | 'expense'
  | 'attendance'
  | 'shift'

export type EntityStatus = 'enabled' | 'preview_only' | 'coming_soon'

export type EntityGroup = 'basic' | 'historical'

export interface EntityField {
  /** UI label (Japanese) */
  label:       string
  /** 説明 (optional、tooltip / help text 用) */
  description?: string
  /** 必須項目か */
  required?:   boolean
}

export interface EntityMetadata {
  key:         EntityKey
  group:       EntityGroup
  label:       string           // 表示名 「顧客」「店舗」等
  shortDesc:   string           // 1 行説明
  fullDesc:    string           // preview page 用の詳細説明
  icon:        LucideIcon
  status:      EntityStatus
  /** Import 時に取り扱う主要フィールド (UI 表示専用) */
  fields:      readonly EntityField[]
  /** Preview page で「移行を開始」button を有効化するか */
  actionEnabled: boolean
  /** enabled 時の実 Wizard 遷移 URL query (client のみ) */
  wizardEntityParam?: string
  /** preview_only / coming_soon 時の理由説明 */
  unavailableReason?: string
}

// ============================================================
// Basic Data (STEP 2: 業務開始の準備)
// ============================================================

const CLIENT: EntityMetadata = {
  key:       'client',
  group:     'basic',
  label:     '顧客',
  shortDesc: '取引先・契約先となる顧客情報',
  fullDesc:
    '取引先・契約先となる顧客企業の情報を、CSV または Excel ファイルから' +
    'まとめて登録できます。店舗登録や請求管理を始める前に必要な情報です。',
  icon:      Building2,
  status:    'enabled',
  fields: [
    { label: '顧客名 / 会社名', required: true, description: '例: 株式会社ABC' },
    { label: '顧客コード',       description: '例: CL-001 (社内管理番号、任意)' },
    { label: '担当者名',         description: '例: 山田 太郎' },
    { label: '電話番号',         description: '例: 03-1234-5678' },
    { label: 'メールアドレス',   description: '例: contact@example.com' },
    { label: '住所',             description: '例: 東京都渋谷区...' },
    { label: '備考',             description: 'その他の任意情報' },
  ],
  actionEnabled: true,
  wizardEntityParam: 'client',
}

const STORE: EntityMetadata = {
  key:       'store',
  group:     'basic',
  label:     '店舗',
  shortDesc: '顧客に紐づく店舗・施設情報',
  fullDesc:
    '顧客企業が運営する店舗・施設情報を CSV / Excel からまとめて登録できます。' +
    '各店舗は必ず既存顧客に紐付けられます。CSV 内で顧客コードまたは顧客名を指定してください。',
  icon:      Store,
  status:    'enabled',
  fields: [
    { label: '店舗名',           required: true, description: '例: 新宿本店' },
    { label: '店舗コード',       description: '例: ST-001' },
    { label: '顧客コード / 顧客名', required: true, description: '既存顧客との紐付け' },
    { label: '住所',             description: '例: 東京都新宿区...' },
    { label: '電話番号',         description: '例: 03-1234-5678' },
    { label: '営業時間',         description: '例: 10:00 - 20:00' },
    { label: '店長名',           description: '例: 佐藤 花子' },
    { label: '緊急連絡先',       description: '営業時間外の連絡先' },
    { label: '契約情報',         description: '契約内容メモ' },
    { label: '備考',             description: 'その他の任意情報' },
  ],
  actionEnabled: true,
  wizardEntityParam: 'store',
}

const EMPLOYEE: EntityMetadata = {
  key:       'employee',
  group:     'basic',
  label:     '従業員',
  shortDesc: '従業員の基本情報',
  fullDesc:
    '従業員の基本情報 (氏名・社員番号・連絡先など) を CSV / Excel からまとめて登録できます。' +
    'このデータ移行では従業員情報のみを登録します。' +
    'ログイン用アカウントの作成や招待メールの送信は行われません。',
  icon:      Users,
  status:    'enabled',
  fields: [
    { label: '氏名',             required: true, description: '例: 山田 太郎' },
    { label: '社員番号',         description: '例: EMP-0001 (未指定の場合は自動採番)' },
    { label: 'フリガナ',         description: '例: ヤマダ タロウ' },
    { label: '生年月日',         description: '例: 1990-04-15' },
    { label: '性別',             description: 'male / female / other' },
    { label: '電話番号',         description: '例: 090-1234-5678' },
    { label: 'メールアドレス',   description: '例: yamada@example.com' },
    { label: '住所',             description: '例: 東京都渋谷区...' },
    { label: '入社日',           description: '例: 2020-04-01' },
    { label: '部署',             description: '例: 清掃第1部' },
    { label: '役職',             description: '例: マネージャー' },
    { label: '在籍状況',         description: '在籍中 / 休職中 / 退職 など' },
    { label: '備考',             description: 'その他の任意情報' },
  ],
  actionEnabled: true,
  wizardEntityParam: 'employee',
}

const PROJECT: EntityMetadata = {
  key:       'project',
  group:     'basic',
  label:     '案件',
  shortDesc: '既存の案件・契約案件情報',
  fullDesc:
    '既存の案件・契約案件情報を CSV / Excel からまとめて登録できます。' +
    '各案件は店舗 (または住所) と紐付けられます。' +
    'CSV 内で店舗コードまたは店舗名を指定してください。',
  icon:      FolderOpen,
  status:    'coming_soon',
  fields: [
    { label: '案件名',           required: true, description: '例: 新宿本店 定期清掃' },
    { label: '案件コード',       description: '例: PJ-2026-001' },
    { label: '店舗コード / 店舗名', description: '既存店舗との紐付け (任意)' },
    { label: '開始日',           description: '例: 2026-04-01' },
    { label: '終了日',           description: '例: 2027-03-31' },
    { label: 'ステータス',       description: '稼働中 / 一時停止 / 完了 / キャンセル' },
    { label: '契約情報',         description: '契約条件のメモ' },
    { label: '備考',             description: 'その他の任意情報' },
  ],
  actionEnabled: false,
  unavailableReason:
    'このデータ移行機能は現在準備中です。' +
    '画面の確認までは行えますが、実際の登録処理はまだ利用できません。',
}

// ============================================================
// Historical Data (STEP 3: 過去データの移行【任意】)
// ============================================================

const EXPENSE: EntityMetadata = {
  key:       'expense',
  group:     'historical',
  label:     '経費履歴',
  shortDesc: '過去の経費・支払履歴',
  fullDesc:
    '過去の経費申請・支払履歴を CSV / Excel から HIKARU へ移行できます。' +
    'この処理は「履歴データの移行」です。新規申請通知や承認通知は発生しません。',
  icon:      Receipt,
  status:    'coming_soon',
  fields: [
    { label: '発生日',           required: true, description: '例: 2026-03-15' },
    { label: '申請者',           description: '社員番号または氏名で指定' },
    { label: 'カテゴリ',         description: '交通費 / 駐車料 / 備品費 / 消耗品費 / その他' },
    { label: '金額',             required: true, description: '例: 1200' },
    { label: '内容',             description: '例: 現場移動タクシー代' },
    { label: '関連案件',         description: '案件コードまたは案件名 (任意)' },
    { label: 'ステータス',       description: '下書き / 申請済み / 承認済み / 却下 / 精算済み' },
    { label: '備考',             description: 'その他の任意情報' },
  ],
  actionEnabled: false,
  unavailableReason:
    'このデータ移行機能は現在準備中です。' +
    '画面の確認までは行えますが、実際の履歴移行はまだ利用できません。',
}

const ATTENDANCE: EntityMetadata = {
  key:       'attendance',
  group:     'historical',
  label:     '勤怠履歴',
  shortDesc: '過去の出退勤・勤務履歴',
  fullDesc:
    '過去の出退勤・休憩時間・勤務時間などの勤怠履歴を CSV / Excel から' +
    'HIKARU へ移行できます。この処理は「履歴データの移行」です。' +
    '新規勤怠打刻や修正申請の通知は発生しません。',
  icon:      Clock,
  status:    'coming_soon',
  fields: [
    { label: '従業員',           required: true, description: '社員番号または氏名で指定' },
    { label: '勤務日',           required: true, description: '例: 2026-03-15' },
    { label: '出勤時刻',         description: '例: 09:00' },
    { label: '休憩開始',         description: '例: 12:00 (任意)' },
    { label: '休憩終了',         description: '例: 13:00 (任意)' },
    { label: '退勤時刻',         description: '例: 18:00' },
    { label: '備考',             description: 'その他の任意情報' },
  ],
  actionEnabled: false,
  unavailableReason:
    'このデータ移行機能は現在準備中です。' +
    '画面の確認までは行えますが、実際の履歴移行はまだ利用できません。',
}

const SHIFT: EntityMetadata = {
  key:       'shift',
  group:     'historical',
  label:     'シフト履歴',
  shortDesc: '過去の勤務予定・担当シフト',
  fullDesc:
    '過去の勤務予定・担当シフトを CSV / Excel から HIKARU へ移行できます。' +
    'この処理は「履歴データの移行」です。' +
    '新規シフト作成や変更通知は従業員へ送信されません。',
  icon:      CalendarDays,
  status:    'coming_soon',
  fields: [
    { label: '案件',             required: true, description: '案件コードまたは案件名で指定' },
    { label: '従業員',           required: true, description: '社員番号または氏名で指定' },
    { label: 'シフト日',         required: true, description: '例: 2026-03-15' },
    { label: '開始時刻',         required: true, description: '例: 09:00' },
    { label: '終了時刻',         required: true, description: '例: 18:00' },
    { label: 'ステータス',       description: '予定 / 確定 / 進行中 / 完了 / キャンセル' },
    { label: '備考',             description: 'その他の任意情報' },
  ],
  actionEnabled: false,
  unavailableReason:
    'このデータ移行機能は現在準備中です。' +
    '画面の確認までは行えますが、実際の履歴移行はまだ利用できません。',
}

// ============================================================
// Registry
// ============================================================

export const ENTITY_METADATA: Readonly<Record<EntityKey, EntityMetadata>> = {
  client:     CLIENT,
  store:      STORE,
  employee:   EMPLOYEE,
  project:    PROJECT,
  expense:    EXPENSE,
  attendance: ATTENDANCE,
  shift:      SHIFT,
} as const

export const BASIC_ENTITIES: readonly EntityMetadata[] = [
  CLIENT, STORE, EMPLOYEE, PROJECT,
] as const

export const HISTORICAL_ENTITIES: readonly EntityMetadata[] = [
  EXPENSE, ATTENDANCE, SHIFT,
] as const

export function isEntityKey(raw: string | null | undefined): raw is EntityKey {
  if (!raw) return false
  return raw in ENTITY_METADATA
}

/** Status → 日本語 badge label */
export function statusLabel(status: EntityStatus): string {
  switch (status) {
    case 'enabled':      return '利用可能'
    case 'preview_only': return '接続準備中'
    case 'coming_soon':  return '準備中'
  }
}
