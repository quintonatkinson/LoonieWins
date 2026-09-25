/**
 * Pure feed filtering shared by the Dashboard feed, rails and the Enter-next queue,
 * so every surface honours the same user preferences (and it is unit-testable).
 */
import type { Contest } from '../rssFetcher'
import type { GeoFilterValue } from '../../components/CountryToggle'
import { compareExpiryAscending, isExpired } from '../utils/expiryDate'
import { isDeadLink } from '../utils/linkHealth'
import { isAdultContest, isPurchaseRequiredContest } from '../utils/userSettings'

export const OFFLINE_ALERT_ID = '__offline_alert__'

/** Filter by tag or requirement — matches contest.tags or contest.requirements */
export const TAG_REQ_FILTERS: { key: string; label: string; match: (c: Contest) => boolean }[] = [
  {
    key: 'easy',
    label: '⚡ Easy Entry',
    match: (c) => {
      const tags = c.tags ?? []
      const reqs = c.requirements ?? []
      if (tags.includes('⚡ Easy Entry')) return true
      if (reqs.length === 0 && !tags.includes('🧾 Purchase')) return true
      return false
    },
  },
  { key: 'purchase', label: 'Purchase Required', match: (c) => (c.requirements ?? []).includes('Purchase Required') },
  { key: 'app', label: 'App Download', match: (c) => (c.requirements ?? []).includes('App Download') },
  { key: 'social', label: 'Social Follow', match: (c) => (c.requirements ?? []).includes('Social Action') },
  { key: 'creative', label: 'Creative', match: (c) => (c.requirements ?? []).includes('Creative Submission') },
  { key: 'newsletter', label: 'Newsletter', match: (c) => (c.requirements ?? []).includes('Newsletter Signup') },
  { key: 'daily', label: 'Daily', match: (c) => (c.tags ?? []).includes('Daily') },
  { key: 'instant', label: 'Instant Win', match: (c) => (c.tags ?? []).includes('Instant Win') },
  { key: 'highvalue', label: 'High Value', match: (c) => (c.tags ?? []).includes('High Value') },
  { key: 'math', label: 'Math', match: (c) => (c.tags ?? []).includes('🧠 Math') },
  { key: '18plus', label: '18+', match: (c) => (c.tags ?? []).includes('18+') },
  { key: 'single', label: 'Single Entry', match: (c) => (c.tags ?? []).includes('1 Single Entry') },
  { key: 'weekly', label: 'Weekly', match: (c) => (c.tags ?? []).includes('Weekly') },
]

export function passesGeo(c: Contest, geoFilter: GeoFilterValue): boolean {
  const elig = c.eligibility ?? 'Unknown'
  if (geoFilter === 'CA' && elig === 'US') return false
  if (geoFilter === 'US' && elig === 'CA') return false
  return true
}

/** Case/accent-insensitive search across title, source, prize, tags and requirements. */
export function matchesSearch(c: Contest, query: string): boolean {
  const fold = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
  const terms = fold(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true
  const hay = fold(
    [c.title, c.source, c.category, ...(c.tags ?? []), ...(c.requirements ?? [])]
      .filter(Boolean)
      .join(' ')
  )
  return terms.every((t) => hay.includes(t))
}

export interface FeedFilterOptions {
  geoFilter: GeoFilterValue
  quebecSafe: boolean
  hidePurchaseRequired: boolean
  hideAdult: boolean
  /** Hide contests already in the user's entries (skip when ignoreEntered). */
  hideEntered?: boolean
  enteredIds?: ReadonlySet<string>
  search?: string
  tagFilters?: ReadonlySet<string>
  now?: Date
}

/** Preference filters every surface must respect (feed, rails, Enter-next). */
export function passesBaseFilters(c: Contest, opts: FeedFilterOptions): boolean {
  if (c.id === OFFLINE_ALERT_ID) return true
  if (isDeadLink(c)) return false
  if (isExpired(c.expiryDate, opts.now)) return false
  if (opts.quebecSafe && c.restrictions?.includes('no_quebec')) return false
  if (opts.hidePurchaseRequired && isPurchaseRequiredContest(c)) return false
  if (opts.hideAdult && isAdultContest(c)) return false
  return passesGeo(c, opts.geoFilter)
}

export function contestPassesFeedFilters(
  c: Contest,
  opts: FeedFilterOptions,
  flags?: { ignoreEntered?: boolean }
): boolean {
  if (!passesBaseFilters(c, opts)) return false
  if (!flags?.ignoreEntered && opts.hideEntered && opts.enteredIds?.has(c.id)) return false
  if (opts.search?.trim() && !matchesSearch(c, opts.search)) return false
  if (opts.tagFilters && opts.tagFilters.size > 0) {
    const tagFilters = opts.tagFilters
    if (!TAG_REQ_FILTERS.some((f) => tagFilters.has(f.key) && f.match(c))) return false
  }
  return true
}

/** Enter-next queue: not yet entered, preference-aware, ending soon first. */
export function buildEnterNextQueue(
  contests: Contest[],
  opts: FeedFilterOptions,
  limit = 25
): Contest[] {
  const entered = opts.enteredIds ?? new Set<string>()
  return contests
    .filter((c) => c.id !== OFFLINE_ALERT_ID && !entered.has(c.id) && passesBaseFilters(c, opts))
    .sort((a, b) => compareExpiryAscending(a.expiryDate, b.expiryDate))
    .slice(0, limit)
}

/**
 * "Best odds" heuristic — higher is better. We cannot see real entrant counts, so this favours
 * signals of a smaller pool: CA-only eligibility (vs US-wide), effortful entries most people skip
 * (creative/skill), instant-win / daily draws (many chances), modest prizes (less competition), and
 * low LoonieWins social-proof counts.
 */
export function oddsScore(c: Contest, popularity = 0): number {
  const tags = c.tags ?? []
  const reqs = c.requirements ?? []
  let score = 0
  if (c.eligibility === 'CA') score += 2
  else if (c.eligibility === 'US' || c.eligibility === 'NA') score -= 0.5
  if (reqs.includes('Creative Submission')) score += 3
  if (tags.includes('🧠 Math')) score += 0.5
  if (tags.includes('Instant Win')) score += 2
  if (tags.includes('Daily')) score += 1
  if (reqs.includes('Purchase Required')) score += 1
  if (c.restrictions?.includes('no_quebec')) score += 0.5
  const value = c.prizeValue ?? 0
  if (value > 0) score -= Math.min(3, Math.log10(value) / 1.5)
  score -= Math.min(3, Math.log2(1 + Math.max(0, popularity)) / 2)
  return score
}

export function sortByBestOdds(list: Contest[], popularity: (id: string) => number = () => 0): Contest[] {
  return [...list].sort(
    (a, b) =>
      oddsScore(b, popularity(b.id)) - oddsScore(a, popularity(a.id)) ||
      compareExpiryAscending(a.expiryDate, b.expiryDate)
  )
}
