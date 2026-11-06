/**
 * Points economy — maps Quinton's publisher USD → in-app points (mobile).
 * Keep in sync with web `src/lib/monetization/pointsEconomy.ts`.
 */

export const POINTS_PER_USD = 1000

export const DESIGN_REWARD_PTS = {
  rewardedVideo: 20,
  quickPoll: 50,
  shortSurvey: 150,
  midSurvey: 400,
  typicalCpi: 1500,
  strongCpi: 2500,
} as const

export function pointsFromUsd(usd: number): number {
  if (!Number.isFinite(usd) || usd <= 0) return 0
  return Math.max(1, Math.round(usd * POINTS_PER_USD))
}
