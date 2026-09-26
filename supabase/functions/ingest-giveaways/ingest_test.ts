// deno test --allow-env supabase/functions/ingest-giveaways/ingest_test.ts
import { assert, assertEquals } from 'jsr:@std/assert@1'
import { DAY_MS, ingestSource, pageUrl, parseFeed, toRow } from './ingest.ts'
import type { Source } from './ingest.ts'

const now = Date.parse('2026-09-26T12:00:00Z')
const wp: Source = { id: 'cfs', name: 'CFS', url: 'https://www.example.ca/contests/feed/', type: 'rss_standard', country: 'CA', trustScore: 9 }

function feed(page: number, ageDays: number[], dated = true): string {
  const items = ageDays.map((age, i) => `
    <item><title><![CDATA[Win a &#8216;Dream&#8217; prize #${page}-${i}]]></title>
    <link>https://www.example.ca/contest-${page}-${i}/?utm_source=rss</link>
    <pubDate>${new Date(now - age * DAY_MS).toUTCString()}</pubDate>
    <description><![CDATA[Open to residents of Canada, excluding Québec.]]></description>
    ${dated ? `<content:encoded><![CDATA[<p>Contest ends ${new Date(now + 20 * DAY_MS).toISOString().slice(0, 10)}.</p>]]></content:encoded>` : ''}
    </item>`)
  return `<?xml version="1.0"?><rss><channel>${items.join('')}</channel></rss>`
}

Deno.test('pageUrl walks WordPress feeds, not forums; reddit gets limit=100', () => {
  assertEquals(pageUrl(wp, 3), 'https://www.example.ca/contests/feed/?paged=3')
  assertEquals(pageUrl({ ...wp, url: 'https://forums.redflagdeals.com/feed/forum/34' }, 2), null)
  assertEquals(pageUrl({ ...wp, url: 'https://www.reddit.com/r/x/.rss' }, 1), 'https://www.reddit.com/r/x/.rss?limit=100')
})

Deno.test('parseFeed reads RSS and Atom (skipping rel=self links)', () => {
  const atom = `<feed><entry><title>Atom win</title><link rel="self" href="https://f.com/feed"/><link href="https://f.com/post-1"/><updated>2026-09-20T00:00:00Z</updated></entry></feed>`
  const [a] = parseFeed(atom)
  assertEquals(a.link, 'https://f.com/post-1')
  const items = parseFeed(feed(1, [1, 2]))
  assertEquals(items.length, 2)
  assert(items[0].contentEncoded?.includes('Contest ends'))
})

Deno.test('ingestSource paginates, normalizes and stops at stale pages', async () => {
  const pages: Record<string, string> = {
    'https://www.example.ca/contests/feed/': feed(1, [1, 2, 3]),
    'https://www.example.ca/contests/feed/?paged=2': feed(2, [10, 20, 30]),
    'https://www.example.ca/contests/feed/?paged=3': feed(3, [90, 100], false), // old + undated → stale → stop
    'https://www.example.ca/contests/feed/?paged=4': feed(4, [1]), // must never be fetched
  }
  const requested: string[] = []
  const realFetch = globalThis.fetch
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input)
    requested.push(url)
    const body = pages[url]
    return Promise.resolve(body ? new Response(body, { status: 200 }) : new Response('', { status: 404 }))
  }) as typeof fetch
  try {
    const { rows, report } = await ingestSource(wp, now)
    assertEquals(report.pages, 3)
    assert(!requested.some((u) => u.endsWith('paged=4')), 'stops after a stale page')
    assertEquals(rows.length, 6)
    const r = rows[0]
    assert(r.id.startsWith('c_'))
    assertEquals(r.title, 'Win a ‘Dream’ prize #1-0')
    assertEquals(r.eligibility, 'CA')
    assert(!r.is_estimated_expiry)
  } finally {
    globalThis.fetch = realFetch
  }
})

Deno.test('toRow estimates a 30-day run for undated posts and drops old/expired ones', () => {
  const base = { id: 'c_1', title: 't', url: 'https://x', source: 's', tags: [], restrictions: [] }
  const undated = toRow({ ...base, postedAt: new Date(now - 5 * DAY_MS).toISOString() }, now)!
  assert(undated.is_estimated_expiry)
  assertEquals(Date.parse(undated.expiry_date!), now + 25 * DAY_MS)
  assertEquals(toRow({ ...base, postedAt: new Date(now - 40 * DAY_MS).toISOString() }, now), null)
  assertEquals(toRow({ ...base, expiryDate: new Date(now - DAY_MS).toISOString() }, now), null)
})
