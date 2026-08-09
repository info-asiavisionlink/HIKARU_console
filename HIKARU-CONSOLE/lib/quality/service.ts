// ============================================================
// HIKARU Quality Score 計算サービス
// AI品質スコアと顧客満足度の統合分析
// ============================================================

export interface QualityWeights {
  ai:       number  // 例: 0.60
  customer: number  // 例: 0.40
}

export const DEFAULT_WEIGHTS: QualityWeights = { ai: 0.60, customer: 0.40 }

/**
 * 顧客評価 (1-5) を 0-100 スケールに変換
 * 1→20, 2→40, 3→60, 4→80, 5→100
 */
export function ratingToScore(rating: number): number {
  return Math.round((rating / 5) * 100)
}

/**
 * HIKARU Quality Score 計算
 * aiScore: 0-100
 * customerRating: 1-5
 */
export function calculateHikaruQualityScore(
  aiScore: number | null | undefined,
  customerRating: number | null | undefined,
  weights: QualityWeights = DEFAULT_WEIGHTS
): number | null {
  if (aiScore == null && customerRating == null) return null
  if (aiScore == null) return customerRating ? ratingToScore(customerRating) : null
  if (customerRating == null) return aiScore

  const customerScore = ratingToScore(customerRating)
  const total = weights.ai + weights.customer
  const normalized = { ai: weights.ai / total, customer: weights.customer / total }

  return Math.round(aiScore * normalized.ai + customerScore * normalized.customer)
}

/**
 * 品質ギャップ計算
 * 正値: AI高 > 顧客満足低（AIが過大評価の可能性）
 * 負値: AI低 < 顧客満足高（顧客の体感が高い）
 */
export interface QualityGap {
  gap:       number   // aiScore - customerScore (-100〜100)
  level:     'large_positive' | 'moderate_positive' | 'small' | 'moderate_negative' | 'large_negative'
  message:   string
}

export function calculateQualityGap(
  aiScore: number | null | undefined,
  customerRating: number | null | undefined
): QualityGap | null {
  if (aiScore == null || customerRating == null) return null

  const customerScore = ratingToScore(customerRating)
  const gap = aiScore - customerScore

  if (gap >= 30) return {
    gap, level: 'large_positive',
    message: 'AI評価と顧客満足度に大きな乖離があります。顧客の体感が評価に反映されていない可能性があります。',
  }
  if (gap >= 15) return {
    gap, level: 'moderate_positive',
    message: 'AI評価より顧客満足度がやや低い傾向があります。顧客への対応・コミュニケーションの確認を推奨します。',
  }
  if (gap <= -30) return {
    gap, level: 'large_negative',
    message: '顧客満足度は高いものの、AI評価では改善余地がある可能性があります。作業プロセスの見直しを推奨します。',
  }
  if (gap <= -15) return {
    gap, level: 'moderate_negative',
    message: '顧客満足度はAI評価を上回っています。接客・対応面が品質評価を補完していると考えられます。',
  }
  return {
    gap, level: 'small',
    message: 'AI評価と顧客満足度はおおむね一致しています。',
  }
}

/**
 * 改善率計算
 * current, previous: 同一スケール (0-100) のスコア
 */
export function calculateImprovementRate(
  current: number | null,
  previous: number | null
): { rate: number; improved: boolean } | null {
  if (current == null || previous == null || previous === 0) return null
  const rate = ((current - previous) / previous) * 100
  return { rate: Math.round(rate * 10) / 10, improved: rate > 0 }
}

/**
 * 低評価判定
 * rating 1-2 は低評価アラート対象
 */
export function isLowRating(rating: number): boolean {
  return rating <= 2
}

/**
 * 高優先度アラート判定
 * AI低下 + 顧客低評価の重複
 */
export function isHighPriorityAlert(
  aiScore: number | null | undefined,
  customerRating: number | null | undefined,
  aiThreshold = 70,
  ratingThreshold = 2
): boolean {
  if (aiScore == null || customerRating == null) return false
  return aiScore < aiThreshold && customerRating <= ratingThreshold
}

/**
 * 評価分布集計
 */
export function calcRatingDistribution(ratings: number[]): Record<number, { count: number; percent: number }> {
  const dist: Record<number, { count: number; percent: number }> = {}
  for (let i = 1; i <= 5; i++) dist[i] = { count: 0, percent: 0 }
  for (const r of ratings) if (r >= 1 && r <= 5) dist[r].count++
  const total = ratings.length
  if (total > 0) {
    for (let i = 1; i <= 5; i++) {
      dist[i].percent = Math.round((dist[i].count / total) * 100)
    }
  }
  return dist
}

/**
 * 平均スコア計算
 */
export function calcAverage(scores: (number | null | undefined)[]): number | null {
  const valid = scores.filter((s): s is number => s != null)
  if (valid.length === 0) return null
  return Math.round((valid.reduce((s, n) => s + n, 0) / valid.length) * 10) / 10
}
