// ============================================================
// File Security Tests
// Run with: npx vitest (after: npm i -D vitest)
// or node --experimental-vm-modules node_modules/.bin/vitest
// ============================================================

import { describe, it, expect } from 'vitest'
import {
  validateImportFile,
  detectSpreadsheetFormulaRisk,
  scanRowsForFormulaRisk,
  sanitizeFilename,
  hasPathTraversal,
  isAllowedExtension,
  buildImportStoragePath,
  MAX_FILE_SIZE_BYTES,
} from '../file-security'

// ---- Test helpers ----

const XLSX_MAGIC = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
const PE_MAGIC   = new Uint8Array([0x4d, 0x5a, 0x90, 0x00])
const ELF_MAGIC  = new Uint8Array([0x7f, 0x45, 0x4c, 0x46])

function makeCsvFile(content: string, name = 'test.csv'): {
  name: string; size: number; type: string; arrayBuffer: () => Promise<ArrayBuffer>
} {
  const bytes = new TextEncoder().encode(content)
  return {
    name,
    size: bytes.byteLength,
    type: 'text/csv',
    arrayBuffer: async () => bytes.buffer as ArrayBuffer,
  }
}

function makeXlsxFile(bytes: Uint8Array, name = 'test.xlsx'): {
  name: string; size: number; type: string; arrayBuffer: () => Promise<ArrayBuffer>
} {
  return {
    name,
    size: bytes.byteLength,
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    arrayBuffer: async () => bytes.buffer as ArrayBuffer,
  }
}

function makeBytesFile(bytes: Uint8Array, name: string): {
  name: string; size: number; type: string; arrayBuffer: () => Promise<ArrayBuffer>
} {
  return {
    name,
    size: bytes.byteLength,
    type: 'application/octet-stream',
    arrayBuffer: async () => bytes.buffer as ArrayBuffer,
  }
}

// ---- File Validation ----

describe('validateImportFile', () => {

  // Empty file
  it('rejects empty CSV', async () => {
    const f = makeCsvFile('')
    const r = await validateImportFile({ ...f, size: 0 })
    expect(r.valid).toBe(false)
    expect(r.errors[0]).toMatch(/空/)
  })

  // Oversize
  it('rejects file over 10MB', async () => {
    const f = makeCsvFile('a,b\n1,2')
    const r = await validateImportFile({ ...f, size: MAX_FILE_SIZE_BYTES + 1 })
    expect(r.valid).toBe(false)
    expect(r.errors[0]).toMatch(/上限/)
  })

  // Valid CSV
  it('accepts valid CSV', async () => {
    const r = await validateImportFile(makeCsvFile('name,code\n山田,A001'))
    expect(r.valid).toBe(true)
    expect(r.errors).toHaveLength(0)
  })

  // Valid XLSX
  it('accepts valid XLSX (ZIP magic bytes)', async () => {
    const xlsx = new Uint8Array([...XLSX_MAGIC, ...new Array(100).fill(0)])
    const r = await validateImportFile(makeXlsxFile(xlsx))
    expect(r.valid).toBe(true)
  })

  // Forbidden: .xls
  it('rejects .xls extension', async () => {
    const r = await validateImportFile(makeCsvFile('a,b', 'file.xls'))
    expect(r.valid).toBe(false)
    expect(r.errors[0]).toMatch(/許可されていない/)
  })

  // Forbidden: .xlsm
  it('rejects .xlsm extension', async () => {
    const r = await validateImportFile(makeCsvFile('a,b', 'file.xlsm'))
    expect(r.valid).toBe(false)
  })

  // Forbidden: .exe renamed to .csv
  it('rejects EXE renamed to .csv', async () => {
    const r = await validateImportFile(makeBytesFile(ELF_MAGIC, 'legit.csv'))
    expect(r.valid).toBe(false)
    expect(r.errors[0]).toMatch(/ELF/)
  })

  it('rejects PE EXE renamed to .csv', async () => {
    const r = await validateImportFile(makeBytesFile(PE_MAGIC, 'data.csv'))
    expect(r.valid).toBe(false)
    expect(r.errors[0]).toMatch(/PE/)
  })

  // Fake CSV (ZIP content)
  it('rejects ZIP renamed to .csv', async () => {
    const r = await validateImportFile(makeBytesFile(XLSX_MAGIC, 'data.csv'))
    expect(r.valid).toBe(false)
    expect(r.errors[0]).toMatch(/ZIP/)
  })

  // XLSX without magic bytes
  it('rejects fake XLSX (no ZIP magic)', async () => {
    const buf = new Uint8Array([0x00, 0x01, 0x02, 0x03, ...new Array(96).fill(0)])
    const r = await validateImportFile(makeXlsxFile(buf))
    expect(r.valid).toBe(false)
    expect(r.errors[0]).toMatch(/ZIPヘッダー/)
  })

  // XLSM detection (vbaProject signature)
  it('rejects XLSM with vbaProject signature as .xlsx', async () => {
    const vba = new TextEncoder().encode('xl/vbaProject.bin')
    const buf = new Uint8Array([...XLSX_MAGIC, ...vba, ...new Array(50).fill(0)])
    const r = await validateImportFile(makeXlsxFile(buf, 'macro.xlsx'))
    expect(r.valid).toBe(false)
    expect(r.errors[0]).toMatch(/マクロ/)
  })

  // Path traversal
  it('rejects filename with path traversal ../', async () => {
    const r = await validateImportFile(makeCsvFile('a,b', '../etc/passwd'))
    expect(r.valid).toBe(false)
    expect(r.errors[0]).toMatch(/パス/)
  })

  it('rejects filename with backslash traversal', async () => {
    const r = await validateImportFile(makeCsvFile('a,b', 'foo\\..\\bar.csv'))
    expect(r.valid).toBe(false)
  })
})

// ---- Formula Detection ----

describe('detectSpreadsheetFormulaRisk', () => {
  it('detects = formula', () => {
    expect(detectSpreadsheetFormulaRisk('=HYPERLINK("http://evil.com")')).toBe(true)
  })
  it('detects + formula', () => {
    expect(detectSpreadsheetFormulaRisk('+CMD|"/C calc"!A0')).toBe(true)
  })
  it('detects - formula', () => {
    expect(detectSpreadsheetFormulaRisk('-2+3=CMD')).toBe(true)
  })
  it('detects @ formula', () => {
    expect(detectSpreadsheetFormulaRisk('@SUM(A1:A100)')).toBe(true)
  })
  it('passes normal text', () => {
    expect(detectSpreadsheetFormulaRisk('山田太郎')).toBe(false)
  })
  it('passes email address', () => {
    expect(detectSpreadsheetFormulaRisk('user@example.com')).toBe(false)
  })
  it('passes numeric string', () => {
    expect(detectSpreadsheetFormulaRisk('12345')).toBe(false)
  })
  it('passes empty string', () => {
    expect(detectSpreadsheetFormulaRisk('')).toBe(false)
  })
  it('passes non-string', () => {
    expect(detectSpreadsheetFormulaRisk(42)).toBe(false)
    expect(detectSpreadsheetFormulaRisk(null)).toBe(false)
  })
  it('detects leading space + formula', () => {
    // trimStart handles leading whitespace injection
    expect(detectSpreadsheetFormulaRisk('  =INDIRECT("A1")')).toBe(true)
  })
})

describe('scanRowsForFormulaRisk', () => {
  it('finds formula cells across rows', () => {
    const rows = [
      { name: '山田', amount: '=1+1' },
      { name: '+CMD', amount: '100' },
    ]
    const risks = scanRowsForFormulaRisk(rows)
    expect(risks).toHaveLength(2)
    expect(risks[0]).toMatchObject({ rowIndex: 1, columnKey: 'amount' })
    expect(risks[1]).toMatchObject({ rowIndex: 2, columnKey: 'name' })
  })

  it('returns empty array for clean data', () => {
    const rows = [{ name: '田中', amount: '500' }]
    expect(scanRowsForFormulaRisk(rows)).toHaveLength(0)
  })

  it('does not mutate input rows', () => {
    const rows = [{ name: '=EVIL', amount: '100' }]
    const original = JSON.stringify(rows)
    scanRowsForFormulaRisk(rows)
    expect(JSON.stringify(rows)).toBe(original)
  })
})

// ---- Filename Helpers ----

describe('sanitizeFilename', () => {
  it('removes path separators', () => {
    expect(sanitizeFilename('foo/bar.csv')).not.toContain('/')
    expect(sanitizeFilename('foo\\bar.csv')).not.toContain('\\')
  })
  it('removes double dot', () => {
    expect(sanitizeFilename('../../etc.csv')).not.toContain('..')
  })
  it('removes null bytes', () => {
    expect(sanitizeFilename('file\0name.csv')).not.toContain('\0')
  })
  it('truncates long names', () => {
    const long = 'a'.repeat(300) + '.csv'
    expect(sanitizeFilename(long).length).toBeLessThanOrEqual(255)
  })
})

describe('hasPathTraversal', () => {
  it('detects forward slash', () => expect(hasPathTraversal('a/b')).toBe(true))
  it('detects backslash',     () => expect(hasPathTraversal('a\\b')).toBe(true))
  it('detects double dot',    () => expect(hasPathTraversal('../x')).toBe(true))
  it('passes safe filename',  () => expect(hasPathTraversal('data.csv')).toBe(false))
})

describe('isAllowedExtension', () => {
  it('allows .csv',      () => expect(isAllowedExtension('file.csv')).toBe(true))
  it('allows .xlsx',     () => expect(isAllowedExtension('file.xlsx')).toBe(true))
  it('rejects .xls',     () => expect(isAllowedExtension('file.xls')).toBe(false))
  it('rejects .xlsm',    () => expect(isAllowedExtension('file.xlsm')).toBe(false))
  it('rejects .exe',     () => expect(isAllowedExtension('file.exe')).toBe(false))
  it('rejects .pdf',     () => expect(isAllowedExtension('file.pdf')).toBe(false))
  it('rejects .zip',     () => expect(isAllowedExtension('file.zip')).toBe(false))
  it('is case insensitive for .CSV', () => expect(isAllowedExtension('FILE.CSV')).toBe(true))
})

// ---- Storage Path ----

describe('buildImportStoragePath', () => {
  it('builds correct path structure', () => {
    const path = buildImportStoragePath(
      'company-uuid-123',
      'session-uuid-456',
      'file-uuid-789',
      'csv',
    )
    expect(path).toBe('company-uuid-123/session-uuid-456/file-uuid-789.csv')
  })

  it('uses uuid not original filename', () => {
    const path = buildImportStoragePath('c', 's', 'uuid', 'xlsx')
    expect(path).not.toContain('original')
    expect(path).toMatch(/^c\/s\/uuid\.xlsx$/)
  })
})

// ---- Tenant Isolation (logic-level) ----

describe('Tenant Isolation', () => {
  it('storage path starts with correct company_id', () => {
    const companyA = 'aaaaaaaa-0000-0000-0000-000000000000'
    const companyB = 'bbbbbbbb-0000-0000-0000-000000000000'
    const pathA = buildImportStoragePath(companyA, 'session-1', 'uuid-1', 'csv')
    const pathB = buildImportStoragePath(companyB, 'session-2', 'uuid-2', 'csv')
    expect(pathA.startsWith(companyA)).toBe(true)
    expect(pathB.startsWith(companyB)).toBe(true)
    // Company A path does not start with Company B
    expect(pathA.startsWith(companyB)).toBe(false)
  })
})
