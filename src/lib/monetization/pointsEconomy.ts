/**
 * Points economy — maps Quinton's publisher USD → in-app points.
 *
 * Canonical rate: 1000 pts per $1.00 USD payout (AdGem `payout` field).
 * Entry costs and sandbox rewards are calibrated from industry ranges
 * (rewarded video ~$0.02, typical CPI ~$1.50, strong CPI ~$2.50).
 * See store doc: docs/points-economy.md
 */

/** Pts credited per $1.00 of verified publisher payout. */
export const POINTS_PER_USD = 1000

/**
 * Design-center rewards for sandbox / UX copy.
 * Live AdGem credits use postback `payout * POINTS_PER_USD` (preferred).
 */
export const DESIGN_REWARD_PTS = {
  /** ~$0.02 rewarded video completion (CA/US planning center) */
  rewardedVideo: 20,
  /** ~$0.05 quick poll / micro survey */
  quickPoll: 50,
  /** ~$0.15 short opinion survey (~3 min) */
  shortSurvey: 150,
  /** ~$0.40 longer survey / light offer */
  midSurvey: 400,
  /** ~$1.50 typical US/CA CPI / CPE completion */
  typicalCpi: 1500,
  /** ~$2.50 strong CPI / multi-goal offer */
  strongCpi: 2500,
} as const

export function pointsFromUsd(usd: number): number {
  if (!Number.isFinite(usd) || usd <= 0) return 0
  return Math.max(1, Math.round(usd * POINTS_PER_USD))
}
