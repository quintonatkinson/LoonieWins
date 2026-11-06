/**
 * Current vs all-time scope for My Giveaways / Applied Contests.
 */

import { isExpired } from './expiryDate'

export type EntryStatusLike = 'entered' | 'submitted' | 'won' | 'lost' | 'expired'

export interface EntryScopeLike {
  status: EntryStatusLike
  expires_at?: string | null
}

/** Active tracking statuses (still “in” the contest). */
export function isOpenEntryStatus(status: EntryStatusLike): boolean {
  return status === 'entered' || status === 'submitted'
}

/**
 * Current / Active: entered or submitted, and not yet ended.
 * Unknown expiry stays in Current until Won / Lost / Expired / Removed.
 */
export function isCurrentContestEntry(entry: EntryScopeLike): boolean {
  if (!isOpenEntryStatus(entry.status)) return false
  if (isExpired(entry.expires_at)) return false
  return true
}

/** Flip open entries past expires_at to expired (local reconcile). */
export function reconcileExpiredEntries<T extends EntryScopeLike>(entries: T[]): {
  entries: T[]
  changed: boolean
} {
  let changed = false
  const next = entries.map((e) => {
    if (isOpenEntryStatus(e.status) && isExpired(e.expires_at)) {
      changed = true
      return { ...e, status: 'expired' as const }
    }
    return e
  })
  return { entries: next, changed }
}
