import { describe, expect, it } from 'vitest'
import { ENTRY_COST_BY_TIER, entryPointCost, resolveEntryCostTier } from '../src/lib/monetization/entryPointCost'
import { localConsumeWeeklyEntry } from '../src/lib/monetization/progression'
import { FREE_WEEKLY_ENTRY_CAP } from '../src/lib/monetization/tiers'

describe('entry point costs', () => {
  it('stays inside the bounds the spend_points_for_entry RPC accepts (50–3000)', () => {
    for (const cost of Object.values(ENTRY_COST_BY_TIER)) {
      expect(cost).toBeGreaterThanOrEqual(50)
      expect(cost).toBeLessThanOrEqual(3000)
    }
  })

  it('prices by prize value and vehicle keywords', () => {
    expect(resolveEntryCostTier({ prizeValue: 25 })).toBe('micro')
    expect(resolveEntryCostTier({ prizeValue: 5000 })).toBe('high')
    expect(resolveEntryCostTier({ title: 'Win a 2026 Ford F-150 truck' })).toBe('mega')
    expect(entryPointCost({ prizeValue: 100 })).toBe(ENTRY_COST_BY_TIER.low)
  })
})

describe('free weekly cap (guest / offline fallback)', () => {
  it('allows exactly FREE_WEEKLY_ENTRY_CAP entries per week', () => {
    let used = 0
    let resetAt: string | null = null
    let ok = 0
    for (let i = 0; i < FREE_WEEKLY_ENTRY_CAP + 3; i++) {
      const r = localConsumeWeeklyEntry(used, resetAt, FREE_WEEKLY_ENTRY_CAP)
      if (!r.ok) continue
      ok++
      used = r.weekly_used
      resetAt = r.weekly_entries_reset_at
    }
    expect(ok).toBe(FREE_WEEKLY_ENTRY_CAP)
  })

  it('resets when the stored week is in the past', () => {
    const r = localConsumeWeeklyEntry(FREE_WEEKLY_ENTRY_CAP, '2020-01-06T00:00:00.000Z', FREE_WEEKLY_ENTRY_CAP)
    expect(r.ok).toBe(true)
    expect(r.weekly_used).toBe(1)
  })
})
