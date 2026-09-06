// ============================================================
// Phase B — Bulk Implementation Contract Tests
//   Project / Expense / Attendance / Shift
//
// Migration 056 (ENUM extend) + 057-060 (commit RPCs)
// Mapper 4 alias sets + REQUIRED + validation
// Route wiring (map / duplicates / commit)
// Wizard / entity-metadata enable
//
// Static contract 検証 (実 SQL 実行なし)。
// ============================================================

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { SUPPORTED_COMMIT_ENTITIES } from '../commit-eligibility'
import {
  buildHeaderMapping,
  applyRowMapping,
  validateMappedRow,
} from '../mapper'

const MIG_DIR = resolve(__dirname, '../../../../supabase/migrations')

function readMig(name: string): string {
  return readFileSync(resolve(MIG_DIR, name), 'utf8')
}

// ============================================================
// Migration 049-055 frozen (unchanged from Phase A)
// ============================================================

describe('Phase A migration files 049-055 frozen (Phase B は既存を変更しない)', () => {
  // Only assert existence — actual SHA256 frozen check lives in migration-055-contract.test.ts
  const files = [
    '049_secure_import_foundation.sql',
    '050_import_match_reasons.sql',
    '051_import_client_commit.sql',
    '052_import_commit_common_helper.sql',
    '053_import_store_commit.sql',
    '054_import_employee_commit.sql',
    '055_fix_import_commit_entity_type_comparison.sql',
  ]
  for (const f of files) {
    it(`${f} exists`, () => {
      expect(existsSync(resolve(MIG_DIR, f))).toBe(true)
    })
  }
})

// ============================================================
// Migration 056: ENUM extend (attendance + shift)
// ============================================================

describe('Migration 056 — import_entity_type ENUM extension', () => {
  const source = readMig('056_import_entity_type_add_attendance_shift.sql')

  it('exists as new migration', () => { expect(source.length).toBeGreaterThan(0) })

  it('adds attendance and shift with IF NOT EXISTS (idempotent)', () => {
    expect(source).toMatch(/ALTER\s+TYPE\s+public\.import_entity_type\s+ADD\s+VALUE\s+IF\s+NOT\s+EXISTS\s+'attendance'/)
    expect(source).toMatch(/ALTER\s+TYPE\s+public\.import_entity_type\s+ADD\s+VALUE\s+IF\s+NOT\s+EXISTS\s+'shift'/)
  })

  it('does NOT drop / recreate ENUM (safety, executable SQL only — comments allowed)', () => {
    const executable = source.split(/\r?\n/).map(l => l.replace(/--.*$/, '')).join('\n')
    expect(executable).not.toMatch(/DROP\s+TYPE/)
    expect(executable).not.toMatch(/CREATE\s+TYPE/)
  })
})

// ============================================================
// Migration 057-060 shared contract (SECURITY DEFINER, search_path, grants, helper reuse)
// ============================================================

const PHASE_B_MIGRATIONS: Array<{ file: string; rpc: string; targetTable: string; entityLiteral: string }> = [
  { file: '057_import_project_commit.sql',    rpc: 'commit_project_import_session',    targetTable: 'projects',            entityLiteral: 'project' },
  { file: '058_import_expense_commit.sql',    rpc: 'commit_expense_import_session',    targetTable: 'expenses',            entityLiteral: 'expense' },
  { file: '059_import_attendance_commit.sql', rpc: 'commit_attendance_import_session', targetTable: 'attendance_records',  entityLiteral: 'attendance' },
  { file: '060_import_shift_commit.sql',      rpc: 'commit_shift_import_session',      targetTable: 'shifts',              entityLiteral: 'shift' },
]

for (const m of PHASE_B_MIGRATIONS) {
  describe(`Phase B commit RPC contract — ${m.file}`, () => {
    const source = readMig(m.file)

    it('exists as new migration file', () => { expect(source.length).toBeGreaterThan(0) })

    it(`replaces exactly the entity RPC ${m.rpc} (no other functions touched)`, () => {
      const matches = source.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.([a-zA-Z_]+)/g) ?? []
      expect(matches.length).toBe(1)
      expect(source).toMatch(new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.${m.rpc}\\s*\\(`))
    })

    it('signature is (p_session_id UUID, p_company_id UUID, p_actor_id UUID) RETURNS TABLE (...)', () => {
      expect(source).toMatch(new RegExp(
        `FUNCTION\\s+public\\.${m.rpc}\\s*\\(\\s*p_session_id\\s+UUID\\s*,\\s*p_company_id\\s+UUID\\s*,\\s*p_actor_id\\s+UUID\\s*\\)[\\s\\S]{0,200}RETURNS\\s+TABLE`,
      ))
    })

    it('preserves SECURITY DEFINER + search_path = public, pg_temp', () => {
      expect(source).toMatch(/SECURITY\s+DEFINER/)
      expect(source).toMatch(/SET\s+search_path\s*=\s*public\s*,\s*pg_temp/)
    })

    it(`uses shared helper _import_commit_pre_check with entity literal '${m.entityLiteral}'`, () => {
      expect(source).toMatch(new RegExp(
        `PERFORM\\s+public\\._import_commit_pre_check\\s*\\(\\s*p_session_id\\s*,\\s*p_company_id\\s*,\\s*'${m.entityLiteral}'\\s*\\)`,
      ))
    })

    it('uses shared helper _import_commit_resolve_update_candidate for target table', () => {
      expect(source).toMatch(new RegExp(
        `_import_commit_resolve_update_candidate\\s*\\([\\s\\S]{0,200}'${m.targetTable}'`,
      ))
    })

    it('uses shared helper _import_commit_count_skipped and _import_commit_finalize', () => {
      expect(source).toMatch(/_import_commit_count_skipped\s*\(/)
      expect(source).toMatch(/_import_commit_finalize\s*\(/)
    })

    it('writes rollback snapshots for target table', () => {
      expect(source).toMatch(new RegExp(
        `INSERT\\s+INTO\\s+import_rollback_snapshots[\\s\\S]{0,400}'${m.targetTable}'`,
      ))
      // CREATE marker
      expect(source).toMatch(/jsonb_build_object\s*\(\s*'operation'\s*,\s*'INSERT'\s*\)/)
      // UPDATE full snapshot
      expect(source).toMatch(/to_jsonb\s*\(\s*v_existing/)
    })

    it('grants EXECUTE to service_role only (PUBLIC/anon/authenticated revoked)', () => {
      expect(source).toMatch(new RegExp(`REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+public\\.${m.rpc}[^;]*FROM\\s+PUBLIC`))
      expect(source).toMatch(new RegExp(`REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+public\\.${m.rpc}[^;]*FROM\\s+anon`))
      expect(source).toMatch(new RegExp(`REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+public\\.${m.rpc}[^;]*FROM\\s+authenticated`))
      expect(source).toMatch(new RegExp(`GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${m.rpc}[^;]*TO\\s+service_role`))
    })

    it('does NOT contain destructive DDL / other DDL', () => {
      const executable = source.split(/\r?\n/).map(l => l.replace(/--.*$/, '')).join('\n')
      expect(executable).not.toMatch(/CREATE\s+TABLE/)
      expect(executable).not.toMatch(/ALTER\s+TABLE/)
      expect(executable).not.toMatch(/DROP\s+TABLE/)
      expect(executable).not.toMatch(/CREATE\s+POLICY/)
      expect(executable).not.toMatch(/ALTER\s+POLICY/)
      expect(executable).not.toMatch(/DROP\s+POLICY/)
      expect(executable).not.toMatch(/CREATE\s+TYPE/)
      expect(executable).not.toMatch(/ALTER\s+TYPE/)
      expect(executable).not.toMatch(/DROP\s+TYPE/)
      expect(executable).not.toMatch(/TRUNCATE/)
    })

    it('does NOT contain notification / LINE / email / workflow trigger side effects (executable)', () => {
      const executable = source.split(/\r?\n/).map(l => l.replace(/--.*$/, '')).join('\n')
      expect(executable).not.toMatch(/notifications\s+VALUES/i)
      expect(executable).not.toMatch(/line_notification/i)
      expect(executable).not.toMatch(/http_post/i)
      expect(executable).not.toMatch(/pg_notify\s*\(/)
    })
  })
}

// ============================================================
// 057 Project — specifics
// ============================================================

describe('Migration 057 Project — column allowlist + FK company scope', () => {
  const source = readMig('057_import_project_commit.sql')

  it('verifies client_id / store_id are same company (cross-company FK rejected)', () => {
    expect(source).toMatch(/client_not_found_in_company/)
    expect(source).toMatch(/store_not_found_in_company/)
  })

  it('enum validation for project_type (spot/recurring/hotel) and project status', () => {
    expect(source).toMatch(/'spot'[\s\S]{0,80}'recurring'[\s\S]{0,80}'hotel'/)
    expect(source).toMatch(/'active'[\s\S]{0,200}'reclean_scheduled_unconfirmed'/)
  })

  it('does NOT touch acquired_by / keys_info / company_id in UPDATE', () => {
    const executable = source.split(/\r?\n/).map(l => l.replace(/--.*$/, '')).join('\n')
    // UPDATE 節に acquired_by / keys_info / company_id SET が存在しない
    // (grep で SET 行を探し、これらが含まれないことを確認)
    const updateBlock = executable.match(/UPDATE\s+projects\s+SET[\s\S]+?WHERE/)
    expect(updateBlock).not.toBeNull()
    const upd = updateBlock![0]
    expect(upd).not.toMatch(/acquired_by\s*=/)
    expect(upd).not.toMatch(/keys_info\s*=/)
    expect(upd).not.toMatch(/company_id\s*=/)
  })
})

// ============================================================
// 058 Expense — historical, no workflow trigger
// ============================================================

describe('Migration 058 Expense — historical safety', () => {
  const source = readMig('058_import_expense_commit.sql')

  it('verifies FK company scope for worker/employee/partner/project', () => {
    expect(source).toMatch(/worker_not_found_in_company/)
    expect(source).toMatch(/employee_not_found_in_company/)
    expect(source).toMatch(/partner_not_found_in_company/)
    expect(source).toMatch(/project_not_found_in_company/)
  })

  it('does NOT auto-fill workflow timestamps (submitted_at / approved_at / settled_at) — CSV explicit only', () => {
    const executable = source.split(/\r?\n/).map(l => l.replace(/--.*$/, '')).join('\n')
    // v_submitted_at 系は NULLIF から取るのみ、NOW() 自動セットは無い
    expect(executable).not.toMatch(/submitted_at\s*=\s*NOW\(\)/)
    expect(executable).not.toMatch(/approved_at\s*=\s*NOW\(\)/)
    expect(executable).not.toMatch(/settled_at\s*=\s*NOW\(\)/)
  })

  it('category enum: transport/parking/supplies/consumables/other', () => {
    expect(source).toMatch(/'transport'[\s\S]{0,120}'other'/)
  })

  it('status enum: draft/submitted/approved/rejected/settled/withdrawn', () => {
    expect(source).toMatch(/'draft'[\s\S]{0,120}'withdrawn'/)
  })
})

// ============================================================
// 059 Attendance — auth_user_id 契約
// ============================================================

describe('Migration 059 Attendance — auth_user_id / UNIQUE contract', () => {
  const source = readMig('059_import_attendance_commit.sql')

  it('does NOT create auth.users / profiles (auth isolation)', () => {
    const executable = source.split(/\r?\n/).map(l => l.replace(/--.*$/, '')).join('\n')
    expect(executable).not.toMatch(/INSERT\s+INTO\s+auth\.users/)
    expect(executable).not.toMatch(/INSERT\s+INTO\s+profiles/)
  })

  it('verifies worker_id via profiles.company_id (auth.users has no company_id)', () => {
    expect(source).toMatch(/FROM\s+profiles[\s\S]{0,60}WHERE\s+id\s*=\s*v_worker_id\s+AND\s+company_id\s*=\s*p_company_id/)
    expect(source).toMatch(/worker_not_found_in_company/)
  })

  it('UPDATE does NOT change worker_id / company_id / work_date (UNIQUE safety)', () => {
    const executable = source.split(/\r?\n/).map(l => l.replace(/--.*$/, '')).join('\n')
    const updateBlock = executable.match(/UPDATE\s+attendance_records\s+SET[\s\S]+?WHERE/)
    expect(updateBlock).not.toBeNull()
    const upd = updateBlock![0]
    expect(upd).not.toMatch(/worker_id\s*=/)
    expect(upd).not.toMatch(/company_id\s*=/)
    expect(upd).not.toMatch(/work_date\s*=/)
  })
})

// ============================================================
// 060 Shift — assignee exclusivity + time semantics
// ============================================================

describe('Migration 060 Shift — assignee CHECK + JST time', () => {
  const source = readMig('060_import_shift_commit.sql')

  it('enforces assignee_type exclusivity (employee ↔ partner)', () => {
    expect(source).toMatch(/missing_employee_id_for_row/)
    expect(source).toMatch(/missing_partner_id_for_row/)
    expect(source).toMatch(/unexpected_partner_id_for_employee_row/)
    expect(source).toMatch(/unexpected_employee_id_for_partner_row/)
  })

  it('start_time < end_time は必ず check', () => {
    expect(source).toMatch(/invalid_time_range_for_row/)
  })

  it('status enum: scheduled/confirmed/in_progress/completed/cancelled', () => {
    expect(source).toMatch(/'scheduled'[\s\S]{0,120}'cancelled'/)
  })

  it('does NOT change company_id / created_by on UPDATE', () => {
    const executable = source.split(/\r?\n/).map(l => l.replace(/--.*$/, '')).join('\n')
    const updateBlock = executable.match(/UPDATE\s+shifts\s+SET[\s\S]+?WHERE/)
    expect(updateBlock).not.toBeNull()
    const upd = updateBlock![0]
    expect(upd).not.toMatch(/company_id\s*=/)
    expect(upd).not.toMatch(/created_by\s*=/)
  })
})

// ============================================================
// Mapper — 4 entity headers → canonical fields
// ============================================================

describe('Mapper — Phase B aliases + required + validation', () => {
  it('Project: 案件名 → name, 案件コード → code, 顧客コード → client_code', () => {
    const { headerMapping } = buildHeaderMapping(['案件名', '案件コード', '顧客コード', '店舗名', '案件種別'], 'project')
    expect(headerMapping['案件名']).toBe('name')
    expect(headerMapping['案件コード']).toBe('code')
    expect(headerMapping['顧客コード']).toBe('client_code')
    expect(headerMapping['店舗名']).toBe('store_name')
    expect(headerMapping['案件種別']).toBe('project_type')
  })

  it('Expense: 発生日 → expense_date, 金額 → amount, カテゴリ → category', () => {
    const { headerMapping } = buildHeaderMapping(['発生日', '金額', 'カテゴリ', '社員番号', '案件コード'], 'expense')
    expect(headerMapping['発生日']).toBe('expense_date')
    expect(headerMapping['金額']).toBe('amount')
    expect(headerMapping['カテゴリ']).toBe('category')
    expect(headerMapping['社員番号']).toBe('employee_number')
    expect(headerMapping['案件コード']).toBe('project_code')
  })

  it('Attendance: 従業員 → employee_name, 勤務日 → work_date, 出勤時刻 → clock_in', () => {
    const { headerMapping } = buildHeaderMapping(['社員番号', '勤務日', '出勤時刻', '退勤時刻', '休憩開始'], 'attendance')
    expect(headerMapping['社員番号']).toBe('employee_number')
    expect(headerMapping['勤務日']).toBe('work_date')
    expect(headerMapping['出勤時刻']).toBe('clock_in')
    expect(headerMapping['退勤時刻']).toBe('clock_out')
    expect(headerMapping['休憩開始']).toBe('break_start')
  })

  it('Shift: 案件コード → project_code, シフト日 → shift_date, 開始時刻 → start_time', () => {
    const { headerMapping } = buildHeaderMapping(['案件コード', '担当者種別', 'シフト日', '開始時刻', '終了時刻'], 'shift')
    expect(headerMapping['案件コード']).toBe('project_code')
    expect(headerMapping['担当者種別']).toBe('assignee_type')
    expect(headerMapping['シフト日']).toBe('shift_date')
    expect(headerMapping['開始時刻']).toBe('start_time')
    expect(headerMapping['終了時刻']).toBe('end_time')
  })

  it('Project: name missing → invalid', () => {
    const mapping = buildHeaderMapping(['案件コード'], 'project')
    const { mappedData, unmappedHeaders } = applyRowMapping({ '案件コード': 'PJ-001' }, mapping)
    const v = validateMappedRow(mappedData, 'project', unmappedHeaders)
    expect(v.status).toBe('invalid')
    expect(v.missingRequired).toContain('name')
  })

  it('Expense: worker_id + expense_date missing → invalid', () => {
    const mapping = buildHeaderMapping(['金額'], 'expense')
    const { mappedData, unmappedHeaders } = applyRowMapping({ '金額': '1200' }, mapping)
    const v = validateMappedRow(mappedData, 'expense', unmappedHeaders)
    expect(v.status).toBe('invalid')
    expect(v.missingRequired).toContain('worker_id')
    expect(v.missingRequired).toContain('expense_date')
  })

  it('Attendance: worker_id + work_date missing → invalid', () => {
    const mapping = buildHeaderMapping(['備考'], 'attendance')
    const { mappedData, unmappedHeaders } = applyRowMapping({ '備考': 'x' }, mapping)
    const v = validateMappedRow(mappedData, 'attendance', unmappedHeaders)
    expect(v.status).toBe('invalid')
    expect(v.missingRequired).toContain('worker_id')
    expect(v.missingRequired).toContain('work_date')
  })

  it('Attendance: FK worker missing_auth_user → invalid with clear reason', () => {
    // simulate mapper output after FK resolver marked missing_auth_user
    const mapped = {
      worker_id: null,
      worker_fk_status: 'missing_auth_user',
      work_date: '2026-03-15',
    } as unknown as Record<string, string | null>
    const v = validateMappedRow(mapped, 'attendance', [])
    expect(v.status).toBe('invalid')
    const worker = v.invalidFields.find(f => f.field === 'worker_id')
    expect(worker).toBeTruthy()
    expect(worker!.reason).toMatch(/ログインアカウント/)
  })

  it('Shift: FK project ambiguous → invalid with clear reason', () => {
    const mapped = {
      project_id: null,
      project_fk_status: 'ambiguous',
      assignee_type: 'employee',
      employee_id: 'e-1',
      employee_fk_status: 'resolved',
      shift_date: '2026-03-15',
      start_time: '09:00',
      end_time: '18:00',
    } as unknown as Record<string, string | null>
    const v = validateMappedRow(mapped, 'shift', [])
    expect(v.status).toBe('invalid')
    const proj = v.invalidFields.find(f => f.field === 'project_id')
    expect(proj).toBeTruthy()
    expect(proj!.reason).toMatch(/複数一致/)
  })
})

// ============================================================
// SUPPORTED_COMMIT_ENTITIES — 7 entities wired
// ============================================================

describe('SUPPORTED_COMMIT_ENTITIES — Phase B expanded', () => {
  it('includes all 7 wired entities', () => {
    for (const et of ['client', 'store', 'employee', 'project', 'expense', 'attendance', 'shift']) {
      expect(SUPPORTED_COMMIT_ENTITIES).toContain(et)
    }
  })
  it('does NOT include invoice (未対応)', () => {
    expect(SUPPORTED_COMMIT_ENTITIES).not.toContain('invoice')
  })
})

// ============================================================
// Route wiring — commit dispatch table + duplicates historical branch + map FK preload
// ============================================================

describe('Route wiring — commit / duplicates / map', () => {
  const COMMIT_PATH  = resolve(__dirname, '../../../app/api/import/sessions/[id]/commit/route.ts')
  const DUP_PATH     = resolve(__dirname, '../../../app/api/import/sessions/[id]/duplicates/route.ts')
  const MAP_PATH     = resolve(__dirname, '../../../app/api/import/sessions/[id]/map/route.ts')
  const commitSrc = readFileSync(COMMIT_PATH, 'utf8')
  const dupSrc    = readFileSync(DUP_PATH,    'utf8')
  const mapSrc    = readFileSync(MAP_PATH,    'utf8')

  it('commit route dispatches all 7 entity RPCs', () => {
    expect(commitSrc).toMatch(/client:\s*'commit_client_import_session'/)
    expect(commitSrc).toMatch(/store:\s*'commit_store_import_session'/)
    expect(commitSrc).toMatch(/employee:\s*'commit_employee_import_session'/)
    expect(commitSrc).toMatch(/project:\s*'commit_project_import_session'/)
    expect(commitSrc).toMatch(/expense:\s*'commit_expense_import_session'/)
    expect(commitSrc).toMatch(/attendance:\s*'commit_attendance_import_session'/)
    expect(commitSrc).toMatch(/shift:\s*'commit_shift_import_session'/)
  })

  it('duplicates route SKIPS auto-scan for Phase B historical entities (safety: no auto UPDATE candidates)', () => {
    expect(dupSrc).toMatch(/HISTORICAL_NO_DUP_SCAN[\s\S]{0,120}'project'[\s\S]{0,60}'expense'[\s\S]{0,60}'attendance'[\s\S]{0,60}'shift'/)
    expect(dupSrc).toMatch(/duplicate_scan\.skipped_historical/)
  })

  it('map route pre-loads FK indexes for Phase B (projects, employees, partners) with company scope', () => {
    expect(mapSrc).toMatch(/from\s*\(\s*'projects'\s*\)[\s\S]{0,120}\.eq\s*\(\s*'company_id'/)
    expect(mapSrc).toMatch(/from\s*\(\s*'employees'\s*\)[\s\S]{0,200}\.eq\s*\(\s*'company_id'/)
    expect(mapSrc).toMatch(/from\s*\(\s*'partners'\s*\)[\s\S]{0,200}\.eq\s*\(\s*'company_id'/)
  })

  it('map route resolves attendance/expense worker via employees.auth_user_id (missing_auth_user branch)', () => {
    expect(mapSrc).toMatch(/missing_auth_user/)
    expect(mapSrc).toMatch(/auth_user_id/)
  })
})

// ============================================================
// Wizard + entity-metadata — Phase B enable
// ============================================================

describe('Wizard + entity-metadata — Phase B enable', () => {
  const WIZ_PATH = resolve(__dirname, '../../../app/(console)/settings/import/new/page.tsx')
  const META_PATH = resolve(__dirname, '../entity-metadata.ts')
  const wiz = readFileSync(WIZ_PATH, 'utf8')
  const meta = readFileSync(META_PATH, 'utf8')

  it('Wizard VALID_ENTITY_TYPES includes 4 Phase B entities', () => {
    for (const et of ['project', 'expense', 'attendance', 'shift']) {
      expect(wiz).toMatch(new RegExp(`VALID_ENTITY_TYPES[\\s\\S]{0,400}'${et}'`))
    }
  })

  it('Wizard EntityType type includes 4 Phase B entities', () => {
    expect(wiz).toMatch(/type\s+EntityType\s*=\s*[\s\S]{0,120}'project'[\s\S]{0,120}'shift'/)
  })

  it('entity-metadata 4 Phase B entities status = enabled + wizardEntityParam set', () => {
    for (const key of ['project', 'expense', 'attendance', 'shift']) {
      expect(meta).toMatch(new RegExp(`key:\\s*'${key}'[\\s\\S]{0,800}status:\\s*'enabled'`))
      expect(meta).toMatch(new RegExp(`key:\\s*'${key}'[\\s\\S]{0,2000}wizardEntityParam:\\s*'${key}'`))
    }
  })
})
