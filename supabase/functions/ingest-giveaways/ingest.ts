/** Pure ingest logic (fetch → parse → normalize → rows); index.ts wires it to Supabase. */
import { getActiveSources, itemMatchesSourceFilter, type Source } from '../_shared/feed/sources.ts'
import { normalizeXmlItem, type Contest, type RawFeedItem } from '../_shared/feed/normalizer.ts'
import { estimatePrizeValue } from '../_shared/feed/valuationDictionary.ts'

export { getActiveSources }
export type { Source }

export const DAY_MS = 24 * 60 * 60 * 1000
/** Pages to walk on WordPress feeds (`/feed/?paged=N`, ~10 posts each). */
export const MAX_WP_PAGES = 6
/** Ignore posts older than this unless they state a future end date. */
export const MAX_POST_AGE_DAYS = 60
/** Posts without a stated end date are assumed to run this long after posting. */
export const ASSUMED_RUN_DAYS = 30
export const SOURCE_CONCURRENCY = 6
export const FETCH_TIMEOUT_MS = 12_000

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; LoonieWinsIngest/2.0; +https://github.com/quintonatkinson/LoonieWins)',
  Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
}

// ---------------------------------------------------------------------------
// Feed parsing (Deno has no DOMParser — tolerant regex parser for RSS 2.0 + Atom)
// ---------------------------------------------------------------------------
const unwrap = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
const tag = (block: string, name: string) =>
  unwrap(block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'))?.[1] ?? '')
const attr = (block: string, name: string, attribute: string) =>
  block.match(new RegExp(`<${name}\\b[^>]*\\b${attribute}=["']([^"']+)["']`, 'i'))?.[1]

export function parseFeed(xml: string): RawFeedItem[] {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) ?? []
  const items: RawFeedItem[] = []
  for (const block of blocks) {
    const title = tag(block, 'title')
    let link = ''
    for (const m of block.matchAll(/<link\b([^>]*)\/?>(?:([\s\S]*?)<\/link>)?/gi)) {
      const attrs = m[1] ?? ''
      if (/rel=["']self["']/i.test(attrs)) continue
      const href = attrs.match(/href=["']([^"']+)["']/i)?.[1] ?? unwrap(m[2] ?? '')
      if (href && !/\/(feed|rss)(\/|$)|atom\.xml$/i.test(href)) {
        link = href.trim()
        break
      }
    }
    if (!link) link = tag(block, 'guid')
    if (!title || !/^https?:\/\//i.test(link)) continue
    items.push({
      title,
      link,
      description: tag(block, 'description') || tag(block, 'summary'),
      contentEncoded: tag(block, 'content:encoded'),
      content: tag(block, 'content'),
      pubDate: tag(block, 'pubDate') || tag(block, 'published') || tag(block, 'updated') || tag(block, 'dc:date'),
      enclosure: attr(block, 'enclosure', 'url'),
      mediaContent: attr(block, 'media:content', 'url') ?? attr(block, 'media:thumbnail', 'url'),
    })
  }
  return items
}

export function pageUrl(source: Source, page: number): string | null {
  const u = new URL(source.url)
  if (u.host.endsWith('reddit.com')) {
    if (page > 1) return null
    u.searchParams.set('limit', '100')
    return u.toString()
  }
  if (page === 1) return source.url
  // WordPress feeds (…/feed/) support ?paged=N for older posts.
  if (!/\/feed\/?$/.test(u.pathname)) return null
  u.searchParams.set('paged', String(page))
  return u.toString()
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

async function fetchViaRss2Json(url: string): Promise<RawFeedItem[]> {
  const apiKey = Deno.env.get('RSS2JSON_API_KEY')
  const params = new URLSearchParams({ rss_url: url })
  if (apiKey) {
    params.set('api_key', apiKey)
    params.set('count', '100')
  }
  try {
    const res = await fetch(`https://api.rss2json.com/v1/api.json?${params}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    const json = await res.json()
    if (json.status !== 'ok' || !Array.isArray(json.items)) return []
    return json.items
      .filter((i: { title?: string; link?: string }) => i.title && i.link)
      .map((i: { title: string; link: string; description?: string; content?: string; pubDate?: string; thumbnail?: string }) => ({
        title: i.title,
        link: i.link,
        description: i.description,
        content: i.content,
        pubDate: i.pubDate,
        enclosure: i.thumbnail,
      }))
  } catch {
    return []
  }
}

export async function fetchPage(source: Source, url: string, page: number): Promise<RawFeedItem[]> {
  const direct = async () => {
    const xml = await fetchText(url)
    return xml ? parseFeed(xml) : []
  }
  if (source.fetchStrategy === 'rss2json_first' && page === 1) {
    const viaApi = await fetchViaRss2Json(url)
    return viaApi.length ? viaApi : direct()
  }
  const items = await direct()
  if (items.length || page > 1) return items
  return fetchViaRss2Json(url)
}

// ---------------------------------------------------------------------------
// Normalization → rows
// ---------------------------------------------------------------------------
export interface ContestRow {
  id: string
  title: string
  url: string
  source: string
  expiry_date: string | null
  is_estimated_expiry: boolean
  prize_value: number | null
  eligibility: string | null
  tags: string[]
  requirements: string[]
  updated_at: string
}

export function toRow(c: Contest, now: number): ContestRow | null {
  const posted = c.postedAt ? Date.parse(c.postedAt) : NaN
  let expiry = c.expiryDate ? Date.parse(c.expiryDate) : NaN
  let estimated = Boolean(c.is_estimated_expiry)
  if (!Number.isFinite(expiry) && Number.isFinite(posted)) {
    expiry = posted + ASSUMED_RUN_DAYS * DAY_MS
    estimated = true
  }
  if (Number.isFinite(expiry) && expiry < now) return null
  if (!c.expiryDate && Number.isFinite(posted) && now - posted > MAX_POST_AGE_DAYS * DAY_MS) return null

  return {
    id: c.id,
    title: c.title.slice(0, 500),
    url: c.url,
    source: c.source,
    expiry_date: Number.isFinite(expiry) ? new Date(expiry).toISOString() : null,
    is_estimated_expiry: estimated || !Number.isFinite(expiry),
    prize_value: c.prizeValue ?? estimatePrizeValue(c.title, c.description) ?? null,
    eligibility: c.eligibility ?? null,
    tags: c.tags ?? [],
    requirements: c.requirements ?? [],
    updated_at: new Date(now).toISOString(),
  }
}

export interface SourceReport {
  country: string
  pages: number
  items: number
  kept: number
}

export async function ingestSource(source: Source, now: number): Promise<{ rows: ContestRow[]; report: SourceReport }> {
  const report: SourceReport = { country: source.country, pages: 0, items: 0, kept: 0 }
  const rows: ContestRow[] = []
  const seen = new Set<string>()
  for (let page = 1; page <= MAX_WP_PAGES; page++) {
    const url = pageUrl(source, page)
    if (!url) break
    const items = await fetchPage(source, url, page)
    if (!items.length) break
    report.pages = page
    report.items += items.length
    let fresh = 0
    let recent = 0
    for (const item of items) {
      if (!itemMatchesSourceFilter(source, item.title, `${item.description ?? ''} ${item.contentEncoded ?? ''}`)) continue
      const contest = normalizeXmlItem(item, source)
      if (seen.has(contest.id)) continue
      seen.add(contest.id)
      fresh++
      const row = toRow(contest, now)
      if (!row) continue
      recent++
      rows.push(row)
    }
    // Stop walking back once a page adds nothing new or is entirely stale.
    if (fresh === 0 || recent === 0) break
  }
  report.kept = rows.length
  return { rows, report }
}

export async function mapPool<T, R>(list: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(list.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, list.length) }, async () => {
      while (next < list.length) {
        const i = next++
        out[i] = await fn(list[i])
      }
    })
  )
  return out
}

