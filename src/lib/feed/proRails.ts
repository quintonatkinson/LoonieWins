/**
 * Pro feed rails: New + Ending Tonight.
 * Free users see locked teasers; Pro (or priority_sources flag) unlocks full rails.
 */

import type { Contest } from '../rssFetcher'
import { toExpiryEndOfDay } from '../utils/expiryDate'
import { hasFeature, type FeatureFlags } from '../monetization/tiers'

const MS_DAY = 24 * 60 * 60 * 1000
const NEW_WINDOW_MS = 3 * MS_DAY
const ENDING_TONIGHT_HOURS = 24

export function canAccessProRails(
  flags: FeatureFlags | null | undefined,
  opts?: { tier?: string | null; isPremium?: boolean }
): boolean {
  return hasFeature(flags, 'priority_sources', opts)
}

function hoursUntilExpiry(c: Contest, now = Date.now()): number | null {
  if (!c.expiryDate) return null
  const end = toExpiryEndOfDay(c.expiryDate).getTime()
  if (Number.isNaN(end)) return null
  return (end - now) / (1000 * 60 * 60)
}

/** Contests ending within the next 24h (or by end of local calendar day if sooner). */
export function endingTonightContests(contests: Contest[], limit = 12): Contest[] {
  const now = Date.now()
  return contests
    .filter((c) => {
      const h = hoursUntilExpiry(c, now)
      return h != null && h >= 0 && h <= ENDING_TONIGHT_HOURS
    })
    .sort((a, b) => {
      const da = a.expiryDate ? toExpiryEndOfDay(a.expiryDate).getTime() : Infinity
      const db = b.expiryDate ? toExpiryEndOfDay(b.expiryDate).getTime() : Infinity
      return da - db
    })
    .slice(0, limit)
}

/**
 * Fresh finds: prefer postedAt within 3 days; else Daily / Instant Win not already ending tonight.
 */
export function newRailContests(contests: Contest[], limit = 12): Contest[] {
  const now = Date.now()
  const endingIds = new Set(endingTonightContests(contests, 50).map((c) => c.id))

  const withPosted = contests
    .filter((c) => {
      const posted = c.postedAt ? Date.parse(c.postedAt) : NaN
      return !Number.isNaN(posted) && now - posted <= NEW_WINDOW_MS && now - posted >= 0
    })
    .sort((a, b) => Date.parse(b.postedAt!) - Date.parse(a.postedAt!))

  if (withPosted.length > 0) {
    return withPosted.filter((c) => !endingIds.has(c.id)).slice(0, limit)
  }

  const tagged = contests.filter((c) => {
    if (endingIds.has(c.id)) return false
    const tags = c.tags ?? []
    return tags.includes('Daily') || tags.includes('Instant Win') || tags.includes('⚡ Easy Entry')
  })

  const pool = tagged.length > 0 ? tagged : contests.filter((c) => !endingIds.has(c.id))
  return [...pool]
    .sort((a, b) => (b.prizeValue ?? 0) - (a.prizeValue ?? 0))
    .slice(0, limit)
}
