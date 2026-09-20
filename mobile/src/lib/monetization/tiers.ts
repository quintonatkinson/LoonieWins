/**
 * Freemium tier rules + paywalled feature flags (mobile).
 * Extra entries after free weekly cap: prize-tiered via entryPointCost.ts.
 */

/** Default / standard-tier entry cost after free weekly cap. */
export const ENTRY_COST_PTS = 250
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

export const PRO_LOCKED_FEATURES = [
  {
    id: 'unlimited_entries',
    title: 'Unlimited contest entries',
    detail: 'No weekly free-entry cap — never grind points to enter',
  },
  {
    id: 'skip_point_grind',
    title: 'Skip the point grind',
    detail: 'Prize-tiered entry costs (50–3000 pts) do not apply to Pro',
  },
  {
    id: 'unlimited_smart_fills',
    title: 'Unlimited Smart-Fills',
    detail: 'No 3-fill free cap — autofill every contest',
  },
  {
    id: 'new_ending_rails',
    title: 'New + Ending Tonight rails',
    detail: 'Pro-only feed rails on Home for fresh drops and last-chance contests',
  },
  {
    id: 'priority_push',
    title: 'Priority ending-tonight push',
    detail: 'Higher-urgency alerts when contests expire tonight',
  },
  {
    id: 'hide_earn_ads',
    title: 'Ad-free Earn page',
    detail: 'Hide promotional slots on Earn — keep the offerwall when you want pts',
  },
  {
    id: 'export_csv',
    title: 'Export Applied Contests CSV',
    detail: 'Download your tracked entries as a spreadsheet-ready CSV',
  },
  {
    id: 'multi_device_sync',
    title: 'Priority multi-device sync',
    detail: 'Signed-in Pro keeps Applied Contests & prefs synced across devices first',
  },
] as const

export type SubscriptionTier = 'free' | 'weekly' | 'monthly'

export type PaywallFeatureFlag =
  | 'unlimited_entries'
  | 'higher_entry_caps'
  | 'extra_smart_fills'
  | 'unlimited_smart_fills'
  | 'priority_sources'
  | 'new_ending_rails'
  | 'hide_earn_ads'
  | 'export_csv'
  | 'multi_device_sync'

export type FeatureFlags = Partial<Record<PaywallFeatureFlag, boolean>>

const PRO_AUTO_FLAGS: PaywallFeatureFlag[] = [
  'unlimited_entries',
  'extra_smart_fills',
  'unlimited_smart_fills',
  'higher_entry_caps',
  'priority_sources',
  'new_ending_rails',
  'hide_earn_ads',
  'export_csv',
  'multi_device_sync',
]

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
  if (isProTier(opts?.tier, opts?.isPremium) && PRO_AUTO_FLAGS.includes(flag)) {
    return true
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
  'Extra entries: prize-tiered pts (50 Tims → 3000 vehicle)',
  `${FREE_SMART_FILLS_DEFAULT} Smart-Fills (then Pro)`,
  'Earn pts via AdGem offers / rewarded path',
  'Earn page may show promo slots',
  'Standard push alerts',
  'Main Opportunity feed only',
  'JSON account export (CSV of Applied Contests is Pro)',
] as const

export const PRO_TIER_PERKS = [
  ...PRO_LOCKED_FEATURES.map((f) => `${f.title} — ${f.detail}`),
  'Weekly or monthly subscription (not a one-time buy)',
  'Support LoonieWins development',
] as const
