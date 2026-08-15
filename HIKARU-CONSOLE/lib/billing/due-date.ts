/**
 * due-date.ts — 支払期限（due_date）計算ユーティリティ
 *
 * 設計方針:
 *   - project_type に依存しない汎用関数（spot/recurring/日常 共通）
 *   - payment_terms テキストの解析は行わない（金銭リスクのため禁止）
 *   - closing_day は「請求締め日」のメタデータとして受け取るが、
 *     due_date 計算には使用しない。
 *     理由: HIKARU の月次請求は常に完全な暦月単位であるため、
 *     「締日前後で対象サイクルが変わる」曖昧さが発生しない。
 *     スポット請求でも管理者が明示的に invoice を生成した時点が
 *     請求意思であり、自動的な cycle bumping は危険なため行わない。
 *   - 管理者が draft 段階で due_date を修正できる設計を前提とする。
 *     本関数は「初期推奨値」を返すにすぎない。
 *
 * fallback ルール:
 *   paymentMonthOffset または paymentDay が NULL の場合は
 *   issueDate + 30 日 を返す（既存動作を完全維持）。
 *
 * 月末処理:
 *   paymentDay = 31 → 支払月の末日
 *   paymentDay = N (1-30) → 支払月に N 日が存在しない場合は月末に丸める
 *   例: paymentDay=30, 支払月=2月 → 2月末
 *
 * 年跨ぎ:
 *   JavaScript の Date(year, month, day) で自然に処理する。
 *   例: 12月 + offset=1 → 翌年1月
 */

export interface CalcDueDateParams {
  /** 請求書発行日 YYYY-MM-DD。fallback 計算の基準日。 */
  issueDate: string
  /**
   * 請求対象期間の終了日 YYYY-MM-DD（月次請求で使用）。
   * 指定された場合、この日付の月を基準月として使用する。
   * null/undefined の場合は issueDate の月を使用。
   */
  billingPeriodTo?: string | null
  /**
   * 締日（clients.closing_day）。
   * 現バージョンでは due_date 計算に使用しない。
   * 将来の拡張のために引数として受け取る。
   */
  closingDay?: number | null
  /**
   * 支払月オフセット（clients.payment_month_offset）。
   * 0=基準月、1=翌月、2=翌々月 ... 最大6。
   * null の場合は fallback（issueDate + 30日）。
   */
  paymentMonthOffset?: number | null
  /**
   * 支払日（clients.payment_day）。
   * 1〜30 = 指定日（その月に存在しない場合は月末に丸める）。
   * 31 = 常に月末。
   * null の場合は fallback（issueDate + 30日）。
   */
  paymentDay?: number | null
}

/**
 * 支払期限を計算して YYYY-MM-DD 文字列で返す。
 *
 * @param params CalcDueDateParams
 * @returns YYYY-MM-DD 形式の支払期限
 */
export function calcDueDate(params: CalcDueDateParams): string {
  const {
    issueDate,
    billingPeriodTo,
    paymentMonthOffset,
    paymentDay,
  } = params

  // ── fallback: 支払条件が未設定の場合は issueDate + 30 日 ──────────
  if (paymentMonthOffset == null || paymentDay == null) {
    return addDays(issueDate, 30)
  }

  // ── 基準日の決定 ──────────────────────────────────────────────────
  // billingPeriodTo がある場合は月次請求。その月末が基準月。
  // ない場合は issueDate の月を基準月にする。
  const referenceDate = (billingPeriodTo && billingPeriodTo.length === 10)
    ? billingPeriodTo
    : issueDate

  const [refYear, refMonth] = parseDateYYYYMM(referenceDate)

  // ── 支払月の算出 ──────────────────────────────────────────────────
  // JavaScript の Date は month が 0-indexed なので +1 して offset を加算
  // 例: refMonth=8 (8月), offset=1 → 9月
  const paymentMonthZeroIndexed = (refMonth - 1) + paymentMonthOffset
  const paymentYear  = refYear + Math.floor(paymentMonthZeroIndexed / 12)
  const paymentMonth = (paymentMonthZeroIndexed % 12) + 1  // 1-indexed

  // ── 支払日の算出（月末丸め込み含む） ──────────────────────────────
  const lastDay = lastDayOfMonth(paymentYear, paymentMonth)
  const day     = paymentDay === 31 ? lastDay : Math.min(paymentDay, lastDay)

  return formatDate(paymentYear, paymentMonth, day)
}

// ============================================================
// ユーティリティ（内部使用・外部export可）
// ============================================================

/**
 * 対象月の末日を返す（UTC依存なし）。
 * @param year  4桁年
 * @param month 1-indexed 月（1-12）
 * @returns その月の末日（1-31）
 */
export function lastDayOfMonth(year: number, month: number): number {
  // Date(year, month, 0) → month-1 の最終日（JavaScript の 0日トリック）
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * YYYY-MM-DD 文字列を [year, month] のタプルに変換（1-indexed）。
 * timezone に依存しない文字列パース。
 */
function parseDateYYYYMM(dateStr: string): [number, number] {
  const parts = dateStr.split('-')
  return [parseInt(parts[0], 10), parseInt(parts[1], 10)]
}

/**
 * 年・月・日から YYYY-MM-DD 文字列を生成（timezone 非依存）。
 */
function formatDate(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

/**
 * YYYY-MM-DD 文字列に N 日加算（UTC 基準、timezone 非依存）。
 * issueDate + 30日 fallback 用。
 */
export function addDaysToDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return formatDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

/** addDaysToDate の alias（既存 addDays と区別するため別名で export） */
function addDays(dateStr: string, days: number): string {
  return addDaysToDate(dateStr, days)
}

// ============================================================
// 検証用（テスト基盤なし → 手動確認用スナップショット）
// ============================================================

/**
 * 開発・デバッグ用の簡易テスト関数。
 * テストフレームワークが未導入のため、
 * 各ケースを Node で実行して確認する用途。
 *
 * 実行方法（ローカル）:
 *   node -e "import('./due-date.ts').then(m => m.runDueDateTests())"
 *
 * または ts-node で:
 *   npx ts-node --skip-project lib/billing/due-date.ts
 */
export function runDueDateTests(): void {
  const cases: Array<{ label: string; params: CalcDueDateParams; expected: string }> = [
    {
      label: '1. 通常月: 翌月末払い（8月基準 → 9月末）',
      params: { issueDate: '2026-08-01', paymentMonthOffset: 1, paymentDay: 31 },
      expected: '2026-09-30',
    },
    {
      label: '2. closing_day=31（月末締め）: 計算には影響しない',
      params: { issueDate: '2026-08-31', closingDay: 31, paymentMonthOffset: 1, paymentDay: 31 },
      expected: '2026-09-30',
    },
    {
      label: '3. payment_day=31（常に月末）: 支払月が2月でも月末',
      params: { issueDate: '2026-01-15', paymentMonthOffset: 1, paymentDay: 31 },
      expected: '2026-02-28',
    },
    {
      label: '4. 2月28日（2026年）',
      params: { issueDate: '2026-01-01', paymentMonthOffset: 1, paymentDay: 28 },
      expected: '2026-02-28',
    },
    {
      label: '5. うるう年2月29日（2028年）',
      params: { issueDate: '2028-01-01', paymentMonthOffset: 1, paymentDay: 31 },
      expected: '2028-02-29',
    },
    {
      label: '6. closing_day=30 + 2月: 計算は基準月のみ依存',
      params: { issueDate: '2026-01-01', closingDay: 30, paymentMonthOffset: 1, paymentDay: 30 },
      expected: '2026-02-28',  // 2月に30日は存在しないため月末に丸める
    },
    {
      label: '7. payment_day=30 + 支払月=2月: 月末に丸める',
      params: { issueDate: '2026-01-01', paymentMonthOffset: 1, paymentDay: 30 },
      expected: '2026-02-28',
    },
    {
      label: '8. 12月 → 翌年1月（年跨ぎ）',
      params: { issueDate: '2026-12-15', paymentMonthOffset: 1, paymentDay: 31 },
      expected: '2027-01-31',
    },
    {
      label: '9. payment_month_offset=2（翌々月末）',
      params: { issueDate: '2026-08-01', paymentMonthOffset: 2, paymentDay: 31 },
      expected: '2026-10-31',
    },
    {
      label: '10. NULL fallback（paymentMonthOffset=null）',
      params: { issueDate: '2026-08-01', paymentMonthOffset: null, paymentDay: 31 },
      expected: '2026-08-31',  // 2026-08-01 + 30日
    },
    {
      label: '11. 締日前（issueDate が closing_day より前）: 計算に影響しない',
      params: { issueDate: '2026-08-15', closingDay: 20, paymentMonthOffset: 1, paymentDay: 31 },
      expected: '2026-09-30',  // closing_day は使わない
    },
    {
      label: '12. 締日当日（issueDate が closing_day と同日）: 計算に影響しない',
      params: { issueDate: '2026-08-20', closingDay: 20, paymentMonthOffset: 1, paymentDay: 31 },
      expected: '2026-09-30',
    },
    {
      label: '13. 締日後（issueDate が closing_day より後）: 計算に影響しない',
      params: { issueDate: '2026-08-25', closingDay: 20, paymentMonthOffset: 1, paymentDay: 31 },
      expected: '2026-09-30',  // cycle bumping しない（管理者判断）
    },
    {
      label: '14. billingPeriodTo 使用（月次請求）: billingPeriodTo の月が基準',
      params: {
        issueDate:       '2026-09-05',  // 発行日は9月
        billingPeriodTo: '2026-08-31',  // 請求対象は8月
        paymentMonthOffset: 1,
        paymentDay: 31,
      },
      expected: '2026-09-30',  // 8月 + 1 = 9月末
    },
    {
      label: '15. 当月払い（payment_month_offset=0）',
      params: { issueDate: '2026-08-01', paymentMonthOffset: 0, paymentDay: 31 },
      expected: '2026-08-31',
    },
    {
      label: '16. payment_day=10（翌月10日払い）',
      params: { issueDate: '2026-08-01', paymentMonthOffset: 1, paymentDay: 10 },
      expected: '2026-09-10',
    },
  ]

  let passed = 0
  let failed = 0

  for (const tc of cases) {
    const result = calcDueDate(tc.params)
    const ok = result === tc.expected
    if (ok) {
      passed++
      console.log(`✓ ${tc.label} → ${result}`)
    } else {
      failed++
      console.error(`✗ ${tc.label}`)
      console.error(`  expected: ${tc.expected}`)
      console.error(`  got:      ${result}`)
    }
  }

  console.log(`\n${passed}/${passed + failed} tests passed`)
  if (failed > 0) throw new Error(`${failed} test(s) failed`)
}
