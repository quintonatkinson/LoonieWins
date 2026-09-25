import { describe, expect, it } from 'vitest'
import { MASTER_SOURCES, countActiveSources, getActiveSources } from '../src/lib/data/sources'
import { getSeasonalPromos } from '../src/lib/data/seasonalPromos'

describe('giveaway source inventory', () => {
  it('has unique ids and valid https feed URLs', () => {
    const ids = new Set<string>()
    for (const s of MASTER_SOURCES) {
      expect(ids.has(s.id), `duplicate id ${s.id}`).toBe(false)
      ids.add(s.id)
      if (s.type === 'scaffold') continue
      expect(() => new URL(s.url), s.id).not.toThrow()
      expect(new URL(s.url).protocol, s.id).toBe('https:')
    }
  })

  it('never fetches the same feed URL twice', () => {
    const urls = getActiveSources().map((s) => s.url.replace(/\/+$/, '').toLowerCase())
    const dupes = urls.filter((u, i) => urls.indexOf(u) !== i)
    expect(dupes).toEqual([])
  })

  it('covers both markets with active sources', () => {
    const c = countActiveSources()
    expect(c.ca + c.both).toBeGreaterThanOrEqual(5)
    expect(c.us + c.both).toBeGreaterThanOrEqual(5)
    expect(getActiveSources().every((s) => s.enabled !== false && s.type !== 'scaffold')).toBe(true)
  })
})

describe('curated seasonal promos', () => {
  it('are well-formed contests with unique ids', () => {
    const promos = getSeasonalPromos()
    expect(promos.length).toBeGreaterThan(0)
    const ids = new Set(promos.map((p) => p.id))
    expect(ids.size).toBe(promos.length)
    for (const p of promos) {
      expect(p.title.length).toBeGreaterThan(3)
      expect(() => new URL(p.url), p.id).not.toThrow()
    }
  })
})
