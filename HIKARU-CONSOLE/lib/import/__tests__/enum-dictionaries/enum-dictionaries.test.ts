import { describe, it, expect } from 'vitest'
import { normalizeExpenseCategory, EXPENSE_CATEGORY_CANONICAL } from '../../enum-dictionaries/expense-category'
import { normalizeExpenseStatus,   EXPENSE_STATUS_CANONICAL   } from '../../enum-dictionaries/expense-status'
import { normalizeProjectType,     PROJECT_TYPE_CANONICAL     } from '../../enum-dictionaries/project-type'
import { normalizeProjectStatus,   PROJECT_STATUS_CANONICAL   } from '../../enum-dictionaries/project-status'
import { normalizeAssigneeType,    ASSIGNEE_TYPE_CANONICAL    } from '../../enum-dictionaries/assignee-type'

describe('Expense Category dictionary', () => {
  it('canonical passthrough', () => {
    for (const v of EXPENSE_CATEGORY_CANONICAL) {
      expect(normalizeExpenseCategory(v)).toBe(v)
    }
  })
  it('日本語マッピング', () => {
    expect(normalizeExpenseCategory('交通費')).toBe('transport')
    expect(normalizeExpenseCategory('駐車料')).toBe('parking')
    expect(normalizeExpenseCategory('駐車場')).toBe('parking')
    expect(normalizeExpenseCategory('備品')).toBe('supplies')
    expect(normalizeExpenseCategory('備品費')).toBe('supplies')
    expect(normalizeExpenseCategory('消耗品')).toBe('consumables')
    expect(normalizeExpenseCategory('消耗品費')).toBe('consumables')
    expect(normalizeExpenseCategory('その他')).toBe('other')
    expect(normalizeExpenseCategory('雑費')).toBe('other')
  })
  it('trim + case-insensitive', () => {
    expect(normalizeExpenseCategory('  Transport  ')).toBe('transport')
    expect(normalizeExpenseCategory('　交通費　')).toBe('transport')
    expect(normalizeExpenseCategory('SUPPLIES')).toBe('supplies')
  })
  it('未知は null (推測しない)', () => {
    expect(normalizeExpenseCategory('事務用品費')).toBeNull()  // supplies / consumables 曖昧
    expect(normalizeExpenseCategory('unknown')).toBeNull()
    expect(normalizeExpenseCategory('')).toBeNull()
    expect(normalizeExpenseCategory(null)).toBeNull()
  })
})

describe('Expense Status dictionary', () => {
  it('canonical passthrough', () => {
    for (const v of EXPENSE_STATUS_CANONICAL) {
      expect(normalizeExpenseStatus(v)).toBe(v)
    }
  })
  it('日本語マッピング', () => {
    expect(normalizeExpenseStatus('下書き')).toBe('draft')
    expect(normalizeExpenseStatus('下書')).toBe('draft')
    expect(normalizeExpenseStatus('未申請')).toBe('draft')
    expect(normalizeExpenseStatus('申請済')).toBe('submitted')
    expect(normalizeExpenseStatus('申請中')).toBe('submitted')
    expect(normalizeExpenseStatus('承認済')).toBe('approved')
    expect(normalizeExpenseStatus('承認')).toBe('approved')
    expect(normalizeExpenseStatus('却下')).toBe('rejected')
    expect(normalizeExpenseStatus('精算済')).toBe('settled')
    expect(normalizeExpenseStatus('取下げ')).toBe('withdrawn')
    expect(normalizeExpenseStatus('取り下げ')).toBe('withdrawn')
  })
  it('未知は null', () => {
    expect(normalizeExpenseStatus('保留')).toBeNull()  // どの status か曖昧
    expect(normalizeExpenseStatus('unknown')).toBeNull()
  })
})

describe('Project Type dictionary', () => {
  it('canonical passthrough', () => {
    for (const v of PROJECT_TYPE_CANONICAL) {
      expect(normalizeProjectType(v)).toBe(v)
    }
  })
  it('日本語マッピング', () => {
    expect(normalizeProjectType('スポット')).toBe('spot')
    expect(normalizeProjectType('単発')).toBe('spot')
    expect(normalizeProjectType('単発案件')).toBe('spot')
    expect(normalizeProjectType('定期')).toBe('recurring')
    expect(normalizeProjectType('定期案件')).toBe('recurring')
    expect(normalizeProjectType('ホテル')).toBe('hotel')
    expect(normalizeProjectType('ホテル案件')).toBe('hotel')
  })
})

describe('Project Status dictionary', () => {
  it('canonical passthrough (10 values)', () => {
    for (const v of PROJECT_STATUS_CANONICAL) {
      expect(normalizeProjectStatus(v)).toBe(v)
    }
    expect(PROJECT_STATUS_CANONICAL.length).toBe(10)
  })
  it('日本語マッピング (代表 4 status)', () => {
    expect(normalizeProjectStatus('稼働中')).toBe('active')
    expect(normalizeProjectStatus('一時停止')).toBe('paused')
    expect(normalizeProjectStatus('完了')).toBe('completed')
    expect(normalizeProjectStatus('キャンセル')).toBe('cancelled')
    expect(normalizeProjectStatus('中止')).toBe('cancelled')
    // 業務固有 (再清掃 / 予定確定 等)
    expect(normalizeProjectStatus('予定確定')).toBe('scheduled_confirmed')
    expect(normalizeProjectStatus('再清掃要請')).toBe('reclean_requested')
    expect(normalizeProjectStatus('請求保留')).toBe('billing_pending')
  })
})

describe('Assignee Type dictionary', () => {
  it('canonical passthrough', () => {
    for (const v of ASSIGNEE_TYPE_CANONICAL) {
      expect(normalizeAssigneeType(v)).toBe(v)
    }
  })
  it('日本語マッピング', () => {
    expect(normalizeAssigneeType('従業員')).toBe('employee')
    expect(normalizeAssigneeType('社員')).toBe('employee')
    expect(normalizeAssigneeType('スタッフ')).toBe('employee')
    expect(normalizeAssigneeType('協力会社')).toBe('partner')
    expect(normalizeAssigneeType('協力業者')).toBe('partner')
    expect(normalizeAssigneeType('パートナー')).toBe('partner')
    expect(normalizeAssigneeType('外部業者')).toBe('partner')
  })
})
