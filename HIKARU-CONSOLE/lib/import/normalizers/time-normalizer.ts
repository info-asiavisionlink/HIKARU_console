// ============================================================
// HIKARU Universal Import — Time Normalizer (Phase U1)
//
// 目的:
//   実世界の時刻表記を、Postgres ::TIME に安全に cast 可能な canonical
//   `HH:MM:SS` へ正規化する。
//
// 対応:
//   09:00        → 09:00:00
//   9:00         → 09:00:00
//   09:00:00     → 09:00:00
//   9時          → 09:00:00
//   9時30分      → 09:30:00
//   09時30分     → 09:30:00
//   9:30:15      → 09:30:15
//
// reject:
//   25:00, 12:99, 09時99分, 空文字, 曖昧な英字表記 (9 AM 等は Phase U2 以降)
//
// timezone 変換禁止:
//   TIME は時刻のみ、date や timezone を付加しない。
//
// 戻り値:
//   { ok: true, value: 'HH:MM:SS' } | { ok: false, reason: 'invalid_time' | 'empty' }
// ============================================================

export type TimeNormalizeResult =
  | { ok: true;  value: string }
  | { ok: false; reason: 'invalid_time' | 'empty' }

export function normalizeTime(raw: string | null | undefined): TimeNormalizeResult {
  if (raw === null || raw === undefined) return { ok: false, reason: 'empty' }
  if (typeof raw !== 'string') return { ok: false, reason: 'empty' }

  const s = raw.normalize('NFKC').trim()
  if (s.length === 0) return { ok: false, reason: 'empty' }

  // Pattern 1: HH:MM:SS
  let m = /^(\d{1,2}):(\d{1,2}):(\d{1,2})$/.exec(s)
  if (m) return finalize(+m[1], +m[2], +m[3])

  // Pattern 2: HH:MM (SS = 0)
  m = /^(\d{1,2}):(\d{1,2})$/.exec(s)
  if (m) return finalize(+m[1], +m[2], 0)

  // Pattern 3: H時M分 / HH時MM分
  m = /^(\d{1,2})\s*時\s*(\d{1,2})\s*分\s*$/.exec(s)
  if (m) return finalize(+m[1], +m[2], 0)

  // Pattern 4: H時 (M = 0)
  m = /^(\d{1,2})\s*時\s*$/.exec(s)
  if (m) return finalize(+m[1], 0, 0)

  return { ok: false, reason: 'invalid_time' }
}

// ---- Internal ----

function finalize(h: number, mi: number, se: number): TimeNormalizeResult {
  if (h  < 0 || h  > 23) return { ok: false, reason: 'invalid_time' }
  if (mi < 0 || mi > 59) return { ok: false, reason: 'invalid_time' }
  if (se < 0 || se > 59) return { ok: false, reason: 'invalid_time' }

  const hh = String(h).padStart(2,  '0')
  const mm = String(mi).padStart(2, '0')
  const ss = String(se).padStart(2, '0')
  return { ok: true, value: `${hh}:${mm}:${ss}` }
}
