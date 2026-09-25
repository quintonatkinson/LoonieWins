import { describe, expect, it } from 'vitest'
import type { Contest } from '../src/lib/rssFetcher'
import {
  buildEnterNextQueue,
  contestPassesFeedFilters,
  matchesSearch,
  sortByBestOdds,
  type FeedFilterOptions,
} from '../src/lib/feed/filters'

const day = 24 * 60 * 60 * 1000
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString()

function contest(id: string, extra: Partial<Contest> = {}): Contest {
  return { id, title: `Contest ${id}`, url: `https://example.com/${id}`, source: 'Test', tags: [], restrictions: [], ...extra }
}

const base: FeedFilterOptions = { geoFilter: 'CA', quebecSafe: false, hidePurchaseRequired: false, hideAdult: false }

describe('contestPassesFeedFilters', () => {
  it('applies geo: CA hides US-only, US hides CA-only, ANY shows all', () => {
    const us = contest('us', { eligibility: 'US' })
    const ca = contest('ca', { eligibility: 'CA' })
    expect(contestPassesFeedFilters(us, base)).toBe(false)
    expect(contestPassesFeedFilters(ca, { ...base, geoFilter: 'US' })).toBe(false)
    expect(contestPassesFeedFilters(us, { ...base, geoFilter: 'ANY' })).toBe(true)
    expect(contestPassesFeedFilters(contest('na', { eligibility: 'NA' }), base)).toBe(true)
  })

  it('respects Quebec-safe, purchase and adult toggles', () => {
    const qc = contest('qc', { restrictions: ['no_quebec'] })
    const buy = contest('buy', { requirements: ['Purchase Required'] })
    const adult = contest('adult', { tags: ['18+'] })
    expect(contestPassesFeedFilters(qc, { ...base, quebecSafe: true })).toBe(false)
    expect(contestPassesFeedFilters(buy, { ...base, hidePurchaseRequired: true })).toBe(false)
    expect(contestPassesFeedFilters(adult, { ...base, hideAdult: true })).toBe(false)
    expect(contestPassesFeedFilters(qc, base)).toBe(true)
  })

  it('hides expired and proven-dead links but keeps proxy-blocked (403) ones', () => {
    expect(contestPassesFeedFilters(contest('old', { expiryDate: iso(-3) }), base)).toBe(false)
    expect(contestPassesFeedFilters(contest('404', { linkStatus: 404 }), base)).toBe(false)
    expect(contestPassesFeedFilters(contest('403', { linkStatus: 403 }), base)).toBe(true)
    expect(contestPassesFeedFilters(contest('503', { linkStatus: 503 }), base)).toBe(true)
  })

  it('hides entered contests only when asked', () => {
    const c = contest('e1')
    const opts = { ...base, hideEntered: true, enteredIds: new Set(['e1']) }
    expect(contestPassesFeedFilters(c, opts)).toBe(false)
    expect(contestPassesFeedFilters(c, opts, { ignoreEntered: true })).toBe(true)
  })

  it('tag filters match any selected chip', () => {
    const daily = contest('d', { tags: ['Daily'] })
    expect(contestPassesFeedFilters(daily, { ...base, tagFilters: new Set(['daily']) })).toBe(true)
    expect(contestPassesFeedFilters(daily, { ...base, tagFilters: new Set(['instant']) })).toBe(false)
  })
})

describe('matchesSearch', () => {
  it('matches accents, tags and multiple words in any order', () => {
    const c = contest('s', { title: 'Gagnez un voyage au Québec', source: 'RFD', tags: ['Daily'] })
    expect(matchesSearch(c, 'quebec voyage')).toBe(true)
    expect(matchesSearch(c, 'daily rfd')).toBe(true)
    expect(matchesSearch(c, 'cruise')).toBe(false)
  })
})

describe('buildEnterNextQueue', () => {
  it('skips entered, hidden-by-pref and expired contests; soonest first', () => {
    const list = [
      contest('later', { expiryDate: iso(10) }),
      contest('soon', { expiryDate: iso(1) }),
      contest('entered', { expiryDate: iso(1) }),
      contest('adult', { expiryDate: iso(1), tags: ['18+'] }),
      contest('expired', { expiryDate: iso(-1) }),
      contest('__offline_alert__'),
    ]
    const queue = buildEnterNextQueue(list, { ...base, hideAdult: true, enteredIds: new Set(['entered']) })
    expect(queue.map((c) => c.id)).toEqual(['soon', 'later'])
  })
})

describe('sortByBestOdds', () => {
  it('ranks CA-only / creative / low-popularity above popular US mega-prizes', () => {
    const mega = contest('mega', { eligibility: 'US', prizeValue: 100000 })
    const niche = contest('niche', { eligibility: 'CA', requirements: ['Creative Submission'], prizeValue: 200 })
    const pop = (id: string) => (id === 'mega' ? 500 : 0)
    expect(sortByBestOdds([mega, niche], pop).map((c) => c.id)).toEqual(['niche', 'mega'])
  })
})
