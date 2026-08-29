// ============================================================
// HIKARU Import — File Security
//
// MVP許可: CSV / XLSX のみ
// 禁止: .xls .xlsm .xlsb .pdf .doc .docx .zip .exe その他
//
// 検証順序:
//   1. Empty file
//   2. File size limit (10MB)
//   3. Path traversal in filename (security first)
//   4. Extension allowlist
//   5. MIME type check (XLSX: warning only)
//   6. Magic bytes (XLSX = ZIP PK header, CSV = no binary header)
//   7. XLSM detection (vbaProject in ZIP contents)
//   8. Executable header detection (MZ / ELF)
//
// Formula detection (detectSpreadsheetFormulaRisk):
//   = + - @ で始まる値を flagging する。
//   '-1000' 等の負数も検出対象になるが、
//   この関数はブロックではなく audit/warning 専用。
//   raw value は変更しない。
//   CSV/Excel parser は formula を evaluate しない前提。
// ============================================================

import type { ImportFileValidationResult, FormulaRiskResult } from '@/types/import'

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  // 10MB

export const ALLOWED_EXTENSIONS = ['csv', 'xlsx'] as const
export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number]

export const ALLOWED_MIME_TYPES = [
  'text/csv',
  'application/csv',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const

// ZIP (XLSX) magic bytes: PK\x03\x04
const XLSX_MAGIC = [0x50, 0x4b, 0x03, 0x04] as const

// Windows PE executable
const PE_MAGIC = [0x4d, 0x5a] as const  // MZ

// ELF executable
const ELF_MAGIC = [0x7f, 0x45, 0x4c, 0x46] as const  // \x7fELF

// ---- Filename Helpers ----

export function getExtension(filename: string): string {
  const parts = filename.split('.')
  if (parts.length < 2) return ''
  return parts[parts.length - 1].toLowerCase()
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\0/g, '')                         // null byte
    .replace(/[/\\]/g, '_')                     // path separator
    .replace(/\.\./g, '_')                      // double-dot
    .replace(/[^\w\s\-_.]/g, '_')               // non-safe chars
    .replace(/^\./, '_')                        // leading dot
    .slice(0, 255)                              // max length
}

export function hasPathTraversal(filename: string): boolean {
  return /[/\\]/.test(filename) || /\.\./.test(filename)
}

export function isAllowedExtension(filename: string): boolean {
  const ext = getExtension(filename)
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext)
}

// ---- Magic Byte Helpers ----

function hasXlsxMagic(buf: Uint8Array): boolean {
  return (
    buf.length >= 4 &&
    buf[0] === XLSX_MAGIC[0] &&
    buf[1] === XLSX_MAGIC[1] &&
    buf[2] === XLSX_MAGIC[2] &&
    buf[3] === XLSX_MAGIC[3]
  )
}

function hasPeMagic(buf: Uint8Array): boolean {
  return buf.length >= 2 && buf[0] === PE_MAGIC[0] && buf[1] === PE_MAGIC[1]
}

function hasElfMagic(buf: Uint8Array): boolean {
  return (
    buf.length >= 4 &&
    buf[0] === ELF_MAGIC[0] &&
    buf[1] === ELF_MAGIC[1] &&
    buf[2] === ELF_MAGIC[2] &&
    buf[3] === ELF_MAGIC[3]
  )
}

// XLSM detection: vbaProject.bin is present in the ZIP central directory
function containsMacroSignature(buf: Uint8Array): boolean {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buf)
  return text.includes('vbaProject') || text.includes('xl/vbaProject')
}

// ---- Formula Injection Detection ----

// CSV formula injection: cell value starts with = + - @
// raw value is NOT modified — detection only for audit/warning purposes.
export function detectSpreadsheetFormulaRisk(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const trimmed = value.trimStart()
  if (trimmed.length === 0) return false
  return trimmed[0] === '=' || trimmed[0] === '+' || trimmed[0] === '-' || trimmed[0] === '@'
}

// Scan all cells in parsed rows for formula injection risks.
// Returns list of risky cells. Does NOT mutate data.
export function scanRowsForFormulaRisk(
  rows: Record<string, unknown>[],
): FormulaRiskResult[] {
  const risks: FormulaRiskResult[] = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    for (const [key, value] of Object.entries(row)) {
      if (detectSpreadsheetFormulaRisk(value)) {
        risks.push({ rowIndex: i + 1, columnKey: key, value: String(value) })
      }
    }
  }
  return risks
}

// ---- Main File Validation ----

export interface FileInput {
  name: string
  size: number
  type: string
  arrayBuffer(): Promise<ArrayBuffer>
}

export async function validateImportFile(
  file: FileInput,
  options: { maxBytes?: number } = {},
): Promise<ImportFileValidationResult> {
  const maxBytes = options.maxBytes ?? MAX_FILE_SIZE_BYTES
  const errors: string[] = []
  const warnings: string[] = []

  // 1. Empty file
  if (file.size === 0) {
    errors.push('ファイルが空です')
    return { valid: false, errors, warnings }
  }

  // 2. File size
  if (file.size > maxBytes) {
    const limitMB = Math.floor(maxBytes / 1024 / 1024)
    errors.push(`ファイルサイズが上限を超えています (上限: ${limitMB}MB)`)
    return { valid: false, errors, warnings }
  }

  // 3. Path traversal in filename (before extension check — security first)
  if (hasPathTraversal(file.name)) {
    errors.push('ファイル名に不正なパス文字が含まれています')
    return { valid: false, errors, warnings }
  }

  // 4. Extension allowlist
  if (!isAllowedExtension(file.name)) {
    const ext = getExtension(file.name) || '(不明)'
    errors.push(
      `許可されていないファイル形式です (.${ext})。CSV または XLSX のみアップロード可能です`,
    )
    return { valid: false, errors, warnings }
  }

  const ext = getExtension(file.name) as AllowedExtension
  const buf = new Uint8Array(await file.arrayBuffer())

  if (ext === 'xlsx') {
    // 5. MIME type (warning only — browsers/OS may report varying values)
    if (file.type && !(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
      warnings.push(`MIMEタイプが標準外の値です: ${file.type}`)
    }

    // 6. Magic bytes: XLSX must be a ZIP archive
    if (!hasXlsxMagic(buf)) {
      errors.push('XLSXファイルの構造が不正です (ZIPヘッダーが見つかりません)')
      return { valid: false, errors, warnings }
    }

    // 7. XLSM detection: macro-enabled Excel is forbidden
    if (containsMacroSignature(buf)) {
      errors.push('マクロ有効Excelファイル (.xlsm) はセキュリティ上の理由により許可されていません')
      return { valid: false, errors, warnings }
    }
  } else {
    // ext === 'csv'

    // 6. CSV with ZIP header = disguised XLSX or archive
    if (hasXlsxMagic(buf)) {
      errors.push('CSVファイルにZIPバイナリコンテンツが含まれています (不正なファイルです)')
      return { valid: false, errors, warnings }
    }

    // 7. Executable headers
    if (hasPeMagic(buf)) {
      errors.push('実行ファイル (Windows PE) はアップロードできません')
      return { valid: false, errors, warnings }
    }
    if (hasElfMagic(buf)) {
      errors.push('実行ファイル (ELF) はアップロードできません')
      return { valid: false, errors, warnings }
    }
  }

  return { valid: true, errors, warnings }
}

// ---- Storage Path Builder ----

export function buildImportStoragePath(
  companyId: string,
  sessionId: string,
  fileUuid: string,
  ext: AllowedExtension,
): string {
  // Path: {company_id}/{session_id}/{uuid}.{ext}
  // Never trust original filename for storage — always use a UUID
  return `${companyId}/${sessionId}/${fileUuid}.${ext}`
}
