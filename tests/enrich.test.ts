import { afterEach, describe, expect, it, vi } from 'vitest'
import { enrichContest } from '../src/lib/data/engine'
import type { Contest } from '../src/lib/rssFetcher'

afterEach(() => vi.unstubAllGlobals())

function contest(extra: Partial<Contest>): Contest {
  return {
    id: 'x', title: 'Win $10,000 cash', url: 'https://agg.example.com/post-1', source: 'Agg',
    tags: [], restrictions: [], eligibility: 'US', requirements: ['Purchase Required'], ...extra,
  }
}

describe('enrichContest', () => {
  it('keeps feed eligibility/requirements when the scraped page is silent', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html><body><p>Cookies, please.</p></body></html>', { status: 200 })))
    const out = await enrichContest(contest({ url: 'https://agg.example.com/silent' }))
    expect(out.eligibility).toBe('US')
    expect(out.requirements).toContain('Purchase Required')
  })

  it('upgrades eligibility when the page states it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html><body><article>Open to legal residents of Canada. ' + 'x'.repeat(300) + '</article></body></html>', { status: 200 })))
    const out = await enrichContest(contest({ url: 'https://agg.example.com/explicit', eligibility: 'Unknown' }))
    expect(out.eligibility).toBe('CA')
  })

  it('does not mark a contest dead on a proxy 403', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('blocked', { status: 403 })))
    const out = await enrichContest(contest({ url: 'https://agg.example.com/blocked' }))
    const { isDeadLink } = await import('../src/lib/utils/linkHealth')
    expect(isDeadLink(out)).toBe(false)
  })
})
