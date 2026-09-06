// ============================================================
// editable-fields.ts unit tests (Phase U3)
//
// - 7 entity 全ての editable field 定義が空でないこと
// - PATCH_FORBIDDEN_KEYS が「絶対禁止」の内部フィールドを網羅
// - 各 EditableField の type / enumOptions / referenceType の整合性
// - EDITABLE_FIELDS と PATCH_FORBIDDEN_KEYS が同じ field を重複定義していないこと
//   (allowlist と forbid list の衝突が起きると常時 reject になり UI 死亡)
// ============================================================

import { describe, it, expect } from 'vitest'
import {
  EDITABLE_FIELDS, PATCH_FORBIDDEN_KEYS,
  getEditableFields, isEditableField, getFieldMeta,
  type FieldType,
} from '../editable-fields'
import type { ImportEntityType } from '@/types/import'

const CORE_ENTITIES: ImportEntityType[] = ['client', 'store', 'employee', 'project', 'expense', 'attendance', 'shift']

describe('EDITABLE_FIELDS — coverage', () => {
  it('7 core entity すべてに editable field が定義されている', () => {
    for (const ent of CORE_ENTITIES) {
      const fields = getEditableFields(ent)
      expect(fields.length).toBeGreaterThan(0)
    }
  })

  it('未実装 entity (invoice) は空配列', () => {
    expect(getEditableFields('invoice').length).toBe(0)
  })
})

describe('EditableField — type integrity', () => {
  const validTypes: FieldType[] = ['text', 'date', 'time', 'datetime', 'money', 'integer', 'boolean', 'enum', 'reference']

  for (const ent of CORE_ENTITIES) {
    it(`${ent}: 全 field の type が valid FieldType`, () => {
      for (const f of getEditableFields(ent)) {
        expect(validTypes).toContain(f.type)
      }
    })
    it(`${ent}: enum / boolean field は enumOptions が非空`, () => {
      for (const f of getEditableFields(ent)) {
        if (f.type === 'enum' || f.type === 'boolean') {
          expect(f.enumOptions).toBeDefined()
          expect(f.enumOptions!.length).toBeGreaterThan(0)
          for (const opt of f.enumOptions!) {
            expect(typeof opt.value).toBe('string')
            expect(opt.value.length).toBeGreaterThan(0)
            expect(typeof opt.label).toBe('string')
            expect(opt.label.length).toBeGreaterThan(0)
          }
        }
      }
    })
    it(`${ent}: reference field は referenceType が指定されている`, () => {
      for (const f of getEditableFields(ent)) {
        if (f.type === 'reference') {
          expect(f.referenceType).toBeDefined()
          expect(['client', 'store', 'employee', 'project', 'partner']).toContain(f.referenceType!)
        }
      }
    })
    it(`${ent}: field key の重複なし`, () => {
      const keys = getEditableFields(ent).map(f => f.key)
      expect(new Set(keys).size).toBe(keys.length)
    })
  }
})

describe('PATCH_FORBIDDEN_KEYS — coverage', () => {
  const mustForbid = [
    'id', 'session_id', 'company_id', 'file_id', 'row_index',
    'raw_data', 'normalized_data',
    'validation_status', 'validation_errors', 'review_status',
    'created_at', 'updated_at', 'created_by',
    'worker_id', 'worker_fk_status',
    'client_fk_status', 'store_fk_status', 'project_fk_status',
    'employee_fk_status', 'partner_fk_status',
    'approved_by', 'approved_at', 'settled_by', 'settled_at',
    'submitted_at', 'withdrawn_at', 'reject_reason',
    'shift_id', 'job_id',
  ]
  for (const k of mustForbid) {
    it(`禁止フィールド '${k}' が含まれる`, () => {
      expect(PATCH_FORBIDDEN_KEYS.has(k)).toBe(true)
    })
  }
})

describe('EDITABLE_FIELDS × PATCH_FORBIDDEN_KEYS — 衝突なし', () => {
  it('editable と forbidden で同じ key を持たない', () => {
    for (const ent of CORE_ENTITIES) {
      for (const f of getEditableFields(ent)) {
        expect(PATCH_FORBIDDEN_KEYS.has(f.key)).toBe(false)
      }
    }
  })
})

describe('helper functions', () => {
  it('isEditableField: editable は true, forbidden は false', () => {
    expect(isEditableField('client', 'name')).toBe(true)
    expect(isEditableField('client', 'company_id')).toBe(false)
    expect(isEditableField('expense', 'category')).toBe(true)
    expect(isEditableField('expense', 'submitted_at')).toBe(false)  // workflow field
  })
  it('getFieldMeta: 存在する field は meta を返す', () => {
    const m = getFieldMeta('expense', 'category')
    expect(m).toBeDefined()
    expect(m!.type).toBe('enum')
    expect(m!.enumOptions?.some(o => o.value === 'supplies')).toBe(true)
  })
  it('getFieldMeta: 存在しない field は undefined', () => {
    expect(getFieldMeta('expense', 'company_id')).toBeUndefined()
    expect(getFieldMeta('client', 'undefined_field')).toBeUndefined()
  })
})

// ---- Enum canonical alignment (with enum-dictionaries) ----

describe('enum canonical alignment', () => {
  it('expense.category options match dictionary canonical', () => {
    const opts = getFieldMeta('expense', 'category')!.enumOptions!
    expect(opts.map(o => o.value).sort())
      .toEqual(['consumables', 'other', 'parking', 'supplies', 'transport'])
  })
  it('expense.status options match dictionary canonical', () => {
    const opts = getFieldMeta('expense', 'status')!.enumOptions!
    expect(opts.map(o => o.value).sort())
      .toEqual(['approved', 'draft', 'rejected', 'settled', 'submitted', 'withdrawn'])
  })
  it('project.project_type options', () => {
    const opts = getFieldMeta('project', 'project_type')!.enumOptions!
    expect(opts.map(o => o.value).sort()).toEqual(['hotel', 'recurring', 'spot'])
  })
  it('shift.assignee_type options', () => {
    const opts = getFieldMeta('shift', 'assignee_type')!.enumOptions!
    expect(opts.map(o => o.value).sort()).toEqual(['employee', 'partner'])
  })
})

// ---- Reference field coverage (business-critical FK resolution surface) ----

describe('reference field coverage', () => {
  it('store: client_id は editable reference', () => {
    const m = getFieldMeta('store', 'client_id')
    expect(m?.type).toBe('reference')
    expect(m?.referenceType).toBe('client')
  })
  it('project: client_id と store_id が両方 editable', () => {
    expect(getFieldMeta('project', 'client_id')?.referenceType).toBe('client')
    expect(getFieldMeta('project', 'store_id')?.referenceType).toBe('store')
  })
  it('expense: employee_id と project_id が editable (worker_id は禁止)', () => {
    expect(getFieldMeta('expense', 'employee_id')?.referenceType).toBe('employee')
    expect(getFieldMeta('expense', 'project_id')?.referenceType).toBe('project')
    // worker_id は auth_user_id 経由でしか resolve されないため、直接編集禁止
    expect(getFieldMeta('expense', 'worker_id')).toBeUndefined()
    expect(PATCH_FORBIDDEN_KEYS.has('worker_id')).toBe(true)
  })
  it('shift: project_id / employee_id / partner_id が editable', () => {
    expect(getFieldMeta('shift', 'project_id')?.referenceType).toBe('project')
    expect(getFieldMeta('shift', 'employee_id')?.referenceType).toBe('employee')
    expect(getFieldMeta('shift', 'partner_id')?.referenceType).toBe('partner')
  })
})
