import { useMemo } from 'react'
import { useUserEarn } from '../contexts/UserEarnContext'
import { useAuth } from '../contexts/AuthContext'
import {
  ENTRY_COST_PTS,
  FREE_WEEKLY_ENTRY_CAP,
  hasFeature,
  isProTier,
  normalizeWeeklyUsage,
  weeklyEntryCap,
} from '../lib/monetization/tiers'

export { ENTRY_COST_PTS }

export function useUserLimits() {
  const {
    balance,
    lastDailyEntryAt,
    subscriptionTier,
    weeklyEntriesUsed,
    weeklyEntryCapValue,
    spendPointsForEntry,
    useFreeEntry,
  } = useUserEarn()
  const { profile } = useAuth()

  const userIsFree = !isProTier(subscriptionTier, profile?.is_premium)
  const flags = profile?.feature_flags
  const unlimited =
    !userIsFree ||
    hasFeature(flags, 'unlimited_entries', {
      tier: subscriptionTier,
      isPremium: profile?.is_premium,
    })

  const cap =
    weeklyEntryCapValue ??
    weeklyEntryCap(flags, { tier: subscriptionTier, isPremium: profile?.is_premium }) ??
    FREE_WEEKLY_ENTRY_CAP

  const weeklyUsed = useMemo(
    () => normalizeWeeklyUsage(weeklyEntriesUsed, profile?.weekly_entries_reset_at ?? null),
    [weeklyEntriesUsed, profile?.weekly_entries_reset_at]
  )

  const weeklyLimitReached = userIsFree && !unlimited && weeklyUsed >= (cap as number)
  const canEnterFree = unlimited || (userIsFree && !weeklyLimitReached)

  const smartFillsRemaining = profile?.smart_fills_remaining ?? 0
  const smartFillsUnlimited =
    unlimited ||
    hasFeature(flags, 'unlimited_smart_fills', {
      tier: subscriptionTier,
      isPremium: profile?.is_premium,
    }) ||
    hasFeature(flags, 'extra_smart_fills', {
      tier: subscriptionTier,
      isPremium: profile?.is_premium,
    })
  const smartFillsBlocked = !smartFillsUnlimited && smartFillsRemaining <= 0

  const hasNewEndingRails =
    !userIsFree ||
    hasFeature(flags, 'new_ending_rails', {
      tier: subscriptionTier,
      isPremium: profile?.is_premium,
    }) ||
    hasFeature(flags, 'priority_sources', {
      tier: subscriptionTier,
      isPremium: profile?.is_premium,
    })

  const spendForEntry = useMemo(
    () => () => spendPointsForEntry(ENTRY_COST_PTS),
    [spendPointsForEntry]
  )

  return {
    balance,
    dailyLimitReached: weeklyLimitReached,
    weeklyLimitReached,
    weeklyEntriesUsed: weeklyUsed,
    weeklyEntryCap: unlimited ? null : (cap as number),
    userIsFree,
    entriesUsedToday: Boolean(lastDailyEntryAt),
    canEnterFree,
    entryCostPts: ENTRY_COST_PTS,
    spendPointsForEntry: spendForEntry,
    useFreeEntry,
    hasUnlimitedEntries: unlimited,
    smartFillsRemaining,
    smartFillsUnlimited,
    smartFillsBlocked,
    hasNewEndingRails,
  }
}
