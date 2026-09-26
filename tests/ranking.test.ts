import { describe, expect, it } from 'vitest'
import { mergeRankDedupe, totalPrizeValue } from '../src/lib/feed/ranking'
import { contestIdForUrl, decodeHtmlEntities } from '../src/lib/data/normalizer'
import type { Contest } from '../src/lib/rssFetcher'

const c = (id: string, title: string, url: string, extra: Partial<Contest> = {}): Contest => ({
  id, title, url, source: 's', tags: [], restrictions: [], ...extra,
})

describe('mergeRankDedupe', () => {
  it('collapses the same prize posted by several blogs, keeping the better copy', () => {
    const out = mergeRankDedupe([
      c('a', 'Win a $500 Tim Hortons Gift Card!', 'https://blog-a.com/tims', { requirements: ['Newsletter Signup'] }),
      c('b', 'Win a $500 Tim Hortons Gift Card (Contest)', 'https://blog-b.com/tims-500'),
      c('d', 'Win a $500 Walmart Gift Card', 'https://blog-a.com/walmart'),
    ])
    expect(out.map((x) => x.id).sort()).toEqual(['b', 'd'])
  })

  it('later lists win on the same URL and 2,000 items rank fast', () => {
    const big = Array.from({ length: 2000 }, (_, i) => c(`x${i}`, `Win prize ${i} from brand ${i}`, `https://e.com/${i}`))
    const t = performance.now()
    const out = mergeRankDedupe(big, [c('new', 'Updated', 'https://e.com/5/')])
    expect(performance.now() - t).toBeLessThan(250)
    expect(out.find((x) => x.url === 'https://e.com/5/')?.id).toBe('new')
    expect(out.length).toBe(2000)
  })

  it('sums prize values for the headline', () => {
    expect(totalPrizeValue([c('a', 't', 'u', { prizeValue: 500 }), c('b', 't', 'v', { prizeValue: 25 })])).toBe(525)
  })
})

describe('normalizer ids and entities', () => {
  it('gives one stable id per contest URL, ignoring tracking params and www', () => {
    expect(contestIdForUrl('https://www.site.com/contest/?utm_source=rss')).toBe(contestIdForUrl('https://site.com/contest'))
    expect(contestIdForUrl('https://site.com/a')).not.toBe(contestIdForUrl('https://site.com/b'))
    expect(contestIdForUrl('https://site.com/a')).toMatch(/^c_[0-9a-f]{16}$/)
  })

  it('decodes WordPress entities without a DOM', () => {
    expect(decodeHtmlEntities('Win a &#8216;Dream&#8217; Trip &amp; $500 &#x2014; Qu&eacute;bec')).toBe('Win a ‘Dream’ Trip & $500 — Québec')
  })
})
