import type { Side } from '@/lib/types'

export interface ScorelineInput {
  predHome: number
  predAway: number
  actualHome: number
  actualAway: number
}

export function calcScale({ predHome, predAway, actualHome, actualAway }: ScorelineInput): number {
  if (predHome === actualHome && predAway === actualAway) return 10
  const actualDiff = actualHome - actualAway
  const predDiff = predHome - predAway
  if (actualDiff === 0) return predDiff === 0 ? 5 : 0
  if (Math.sign(predDiff) === Math.sign(actualDiff)) {
    return predDiff === actualDiff ? 7 : 5
  }
  return 0
}

export function calculatePoints({
  predHome, predAway, predAdvancer,
  actualHome, actualAway, penaltyWinner,
  isKnockout,
}: {
  predHome: number; predAway: number; predAdvancer: Side | null
  actualHome: number; actualAway: number; penaltyWinner: Side | null
  isKnockout: boolean
}): number {
  const scale = calcScale({ predHome, predAway, actualHome, actualAway })
  if (!isKnockout) return scale

  const actualDiff = actualHome - actualAway
  const actualAdvancer: Side = actualDiff > 0 ? 'home' : actualDiff < 0 ? 'away' : (penaltyWinner ?? 'home')
  const rightAdvancer = predAdvancer === actualAdvancer

  const base = rightAdvancer ? Math.max(scale, 3) : scale

  const predDiff = predHome - predAway
  const predictedDraw = predDiff === 0
  const actualDraw = actualDiff === 0
  const penaltyBonus = actualDraw && predictedDraw && predAdvancer === penaltyWinner ? 3 : 0

  return base + penaltyBonus
}
