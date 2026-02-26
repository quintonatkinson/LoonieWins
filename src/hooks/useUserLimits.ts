import { useMemo } from 'react'
import { useUserEarn } from '../contexts/UserEarnContext'

export const ENTRY_COST_PTS = 200

function isToday(iso: string | null): boolean {
  if (!iso) return false
  const d = new Date(iso)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

export function useUserLimits() {
  const {
    balance,
    lastDailyEntryAt,
    subscriptionTier,
    spendPointsForEntry,
    useFreeEntry,
  } = useUserEarn()

  const userIsFree = subscriptionTier === 'free'
  const entriesUsedToday = useMemo(
    () => isToday(lastDailyEntryAt),
    [lastDailyEntryAt]
  )
  const dailyLimitReached = userIsFree && entriesUsedToday
  const canEnterFree = userIsFree && !entriesUsedToday

  const spendForEntry = useMemo(
    () => () => spendPointsForEntry(ENTRY_COST_PTS),
    [spendPointsForEntry]
  )

  return {
    balance,
    dailyLimitReached,
    userIsFree,
    entriesUsedToday,
    canEnterFree,
    entryCostPts: ENTRY_COST_PTS,
    spendPointsForEntry: spendForEntry,
    useFreeEntry,
    hasUnlimitedEntries: subscriptionTier === 'weekly' || subscriptionTier === 'monthly',
  }
}
