// ============================================================
// HIKARU Import — Foreign Key Resolver
//
// 目的:
//   CSV 上の人間向け識別子 (顧客コード / 顧客名 等) を
//   HIKARU 内部 UUID へ安全に変換する。
//
// 共通ルール:
//   - company_id scope 必須。cross-company data を絶対に返さない。
//   - 呼び出し側で company_id 済 pre-loaded の候補配列を渡す。
//   - resolver 内部で DB query しない (N+1 完全防止)。
//
// 優先順序:
//   1. code exact (case-insensitive) — Store: client_code, Employee: (無し)
//   2. name exact (case-insensitive, trim, NFC) — 最終手段
//
// 判定:
//   0 件 → NOT_FOUND
//   複数 → AMBIGUOUS  (auto-pick 禁止、Review 送り)
//   1 件 → RESOLVED
//
// AI 推測禁止、fuzzy match 禁止。
// ============================================================

export type FkResolutionStatus = 'resolved' | 'not_found' | 'ambiguous'

export interface FkResolutionResult {
  status:      FkResolutionStatus
  id:          string | null
  candidates:  string[]  // AMBIGUOUS 時に一致した候補 ID 一覧 (Review UI で表示可)
}

/**
 * FK 候補プールに対する lookup 用 index。
 * 呼び出し側で pre-load して build する。
 */
export interface FkIndex<T> {
  byCode: Map<string, T[]>
  byName: Map<string, T[]>
}

/**
 * candidates 配列から byCode / byName Map を構築する。
 * key normalization: trim + NFC + toLowerCase。
 */
export function buildFkIndex<T extends { id: string; code?: string | null; name?: string | null }>(
  candidates: readonly T[],
): FkIndex<T> {
  const byCode = new Map<string, T[]>()
  const byName = new Map<string, T[]>()

  for (const c of candidates) {
    const codeKey = normalizeKey(c.code)
    if (codeKey) {
      const bucket = byCode.get(codeKey) ?? []
      bucket.push(c)
      byCode.set(codeKey, bucket)
    }
    const nameKey = normalizeKey(c.name)
    if (nameKey) {
      const bucket = byName.get(nameKey) ?? []
      bucket.push(c)
      byName.set(nameKey, bucket)
    }
  }

  return { byCode, byName }
}

/**
 * code / name いずれかで一意解決を試みる。
 * code 優先。code 未指定でも name で試行。
 */
export function resolveFk<T extends { id: string }>(
  index: FkIndex<T>,
  input: { code?: string | null; name?: string | null },
): FkResolutionResult {
  const codeKey = normalizeKey(input.code)
  const nameKey = normalizeKey(input.name)

  // (1) code 優先
  if (codeKey) {
    const matches = index.byCode.get(codeKey) ?? []
    if (matches.length === 1) {
      return { status: 'resolved', id: matches[0].id, candidates: [matches[0].id] }
    }
    if (matches.length > 1) {
      return { status: 'ambiguous', id: null, candidates: matches.map(m => m.id) }
    }
    // code 指定あるが未発見 → name も試さず NOT_FOUND
    // (code 明示は「この code の record を指定」意図、名前 fallback で誤 resolve しない)
    return { status: 'not_found', id: null, candidates: [] }
  }

  // (2) code なし → name で試行
  if (nameKey) {
    const matches = index.byName.get(nameKey) ?? []
    if (matches.length === 1) {
      return { status: 'resolved', id: matches[0].id, candidates: [matches[0].id] }
    }
    if (matches.length > 1) {
      return { status: 'ambiguous', id: null, candidates: matches.map(m => m.id) }
    }
    return { status: 'not_found', id: null, candidates: [] }
  }

  // どちらも指定なし
  return { status: 'not_found', id: null, candidates: [] }
}

/** key normalize: trim + NFC + toLowerCase (空文字/null は null 返却) */
function normalizeKey(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null
  const s = String(raw).trim().normalize('NFC').toLowerCase()
  return s.length > 0 ? s : null
}
