// ============================================================
// HIKARU Universal Import — Header Normalizer (Phase U1)
//
// 目的:
//   CSV/XLSX header の表記揺れ (trailing space / 全角英数字 /
//   大文字小文字 / separator 差) を吸収して、L1 header matching を可能にする。
//   意味変換 (`スタッフNo → 社員番号` 等) は Phase U2 の synonym dictionary
//   で行う。本 module は「意味を変えない範囲の書式吸収」のみ。
//
// 設計:
//   Pure deterministic function、AI 呼び出し 0、外部依存 0。
//   同じ input には常に同じ output を返す (test 可能性 + キャッシュ可能性)。
//
// 順序 (重要):
//   1) NFKC normalize (Unicode 標準):
//       - NFC + 全角英数字/半角カナ → 半角
//       - `Ａ` → `A`, `１` → `1`, `　` → 半角空白, `℡` → `TEL`, `㈱` → `(株)` 等
//   2) trim (前後の空白除去)
//   3) toLowerCase (英字のみ小文字化、日本語には影響なし)
//   4) separator normalize:
//       `_ - . # + ~ = : ; / \ ( ) [ ] { } < > "` および連続空白 → 単一 `_`
//   5) leading / trailing `_` 除去
//
// 意味変換禁止:
//   - `スタッフ` → `社員` の synonym 変換なし (Phase U2)
//   - 記号を意味ある文字に変換しない (`℡` → `TEL` は NFKC 標準変換のみ、辞書引きなし)
//   - Kanji / Hiragana / Katakana 変換なし
//
// 例:
//   "  社員番号  "       → "社員番号"
//   "社員No."             → "社員no"
//   "社員 No."            → "社員_no"
//   "Employee_Number"     → "employee_number"
//   "EMPLOYEE NUMBER"     → "employee_number"
//   "employee-number"     → "employee_number"
//   "Ｅｍｐｌｏｙｅｅ  Ｎｕｍｂｅｒ" → "employee_number"
//   "社員　番号"          → "社員_番号"
//   ""                    → ""
// ============================================================

/**
 * Header 文字列を L1 マッチング用の canonical 形式に正規化する。
 * 意味は変えない。表記揺れだけを吸収する。
 */
export function normalizeHeader(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return ''
  if (typeof raw !== 'string') return ''

  return raw
    // (1) NFKC: NFC + 全角英数字/半角カナ → 半角統一 (Unicode 標準)
    .normalize('NFKC')
    // (2) trim
    .trim()
    // (3) 英字 lowercase (日本語は影響なし)
    .toLowerCase()
    // (4) separator 統一: 各種記号 + 連続空白 → 単一 '_'
    //    許容記号: whitespace, _, -, ., #, +, ~, =, :, ;, /, \, (, ), [, ], {, }, <, >, "
    .replace(/[\s_\-.#+~=:;/\\()\[\]{}<>"]+/g, '_')
    // (5) leading/trailing '_' 除去
    .replace(/^_+|_+$/g, '')
}

/**
 * 2 header が normalize 後に一致するか判定する pure 関数。
 * L1 matching で使用される想定。
 */
export function headersEqualNormalized(a: string, b: string): boolean {
  const na = normalizeHeader(a)
  const nb = normalizeHeader(b)
  return na.length > 0 && na === nb
}
