/**
 * Freemium tier rules + paywalled feature flags (mobile).
 */

export const ENTRY_COST_PTS = 200
export const FREE_WEEKLY_ENTRY_CAP = 7
export const FREE_SMART_FILLS_DEFAULT = 3
export const XP_ENTERED = 15
export const XP_SUBMITTED = 35
export const REFERRAL_CLICK_POINTS = 50
export const REFERRAL_SIGNUP_REFERRER_POINTS = 500
export const REFERRAL_SIGNUP_REFEREE_POINTS = 250
export const XP_PER_LEVEL = 100
export const COMEBACK_BONUS_XP = 50
export const COMEBACK_BONUS_POINTS = 100

export type SubscriptionTier = 'free' | 'weekly' | 'monthly'

export type PaywallFeatureFlag =
  | 'unlimited_entries'
  | 'higher_entry_caps'
  | 'extra_smart_fills'
  | 'unlimited_smart_fills'
  | 'priority_sources'
  | 'new_ending_rails'

export type FeatureFlags = Partial<Record<PaywallFeatureFlag, boolean>>

export function isProTier(
  tier: SubscriptionTier | string | null | undefined,
  isPremium?: boolean
): boolean {
  if (isPremium) return true
  return tier === 'weekly' || tier === 'monthly'
}

export function hasFeature(
  flags: FeatureFlags | null | undefined,
  flag: PaywallFeatureFlag,
  opts?: { tier?: SubscriptionTier | string | null; isPremium?: boolean }
): boolean {
  if (isProTier(opts?.tier, opts?.isPremium)) {
    if (
      flag === 'unlimited_entries' ||
      flag === 'extra_smart_fills' ||
      flag === 'unlimited_smart_fills' ||
      flag === 'higher_entry_caps' ||
      flag === 'priority_sources' ||
      flag === 'new_ending_rails'
    ) {
      return true
    }
  }
  return Boolean(flags?.[flag])
}

export function weeklyEntryCap(
  flags: FeatureFlags | null | undefined,
  opts?: { tier?: SubscriptionTier | string | null; isPremium?: boolean }
): number | null {
  if (hasFeature(flags, 'unlimited_entries', opts) || isProTier(opts?.tier, opts?.isPremium)) {
    return null
  }
  const base = FREE_WEEKLY_ENTRY_CAP
  return hasFeature(flags, 'higher_entry_caps', opts) ? base * 2 : base
}

export function startOfUtcWeek(d = new Date()): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = x.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setUTCDate(x.getUTCDate() + diff)
  x.setUTCHours(0, 0, 0, 0)
  return x
}

export function normalizeWeeklyUsage(
  used: number | null | undefined,
  resetAt: string | null | undefined,
  now = new Date()
): number {
  const weekStart = startOfUtcWeek(now)
  if (!resetAt) return 0
  const reset = new Date(resetAt)
  if (Number.isNaN(reset.getTime()) || reset < weekStart) return 0
  return Math.max(0, used ?? 0)
}

export function levelForXp(xp: number): number {
  return Math.max(1, Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1)
}

export const FREE_TIER_PERKS = [
  `${FREE_WEEKLY_ENTRY_CAP} free contest entries per week`,
  `Extra entries: ${ENTRY_COST_PTS} pts each`,
  `Earn points via offerwall & surveys`,
  `${FREE_SMART_FILLS_DEFAULT} Smart-Fills (then Pro)`,
  'Standard push alerts',
  'Main Opportunity feed only',
] as const

export const PRO_TIER_PERKS = [
  'Unlimited contest entries — no weekly cap, no points to enter',
  'Unlimited Smart-Fills',
  'Priority ending-tonight push alerts',
  'New & Ending Soon rails on Home',
  'Priority source prep flag',
  'Priority “ending tonight” push alerts',
  'New + Ending Tonight Pro feed rails',
  'Support LoonieWins development',
] as const
