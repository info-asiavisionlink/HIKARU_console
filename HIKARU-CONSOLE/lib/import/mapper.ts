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
]

// ---- Required Fields ----

const CLIENT_REQUIRED: ReadonlySet<string> = new Set(['name'])
const STORE_REQUIRED:  ReadonlySet<string> = new Set(['name'])

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
  if (entityType === 'client')   return CLIENT_ALIASES
  if (entityType === 'store')    return STORE_ALIASES
  // Other entity types: return empty (unmapped phase — future)
  return []
}

function getRequired(entityType: ImportEntityType): ReadonlySet<string> {
  if (entityType === 'client') return CLIENT_REQUIRED
  if (entityType === 'store')  return STORE_REQUIRED
  return new Set()
}
