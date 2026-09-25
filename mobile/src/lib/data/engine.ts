/**
 * Data Aggregation Engine: round-robin fetch (rss2json → corsproxy → safety net).
 * Returns JSON-friendly data with offline fallback.
 * enrichContest runs Deep Scrape + Smart Valuation for expiry/value enrichment.
 */

import { toExpiryEndOfDay } from '../utils/expiryDate'
import { getActiveSources, itemMatchesSourceFilter, type Source } from './sources'
import type { Contest, RawFeedItem, Rss2JsonItem } from './normalizer'
import { normalizeJsonItem, normalizeXmlItem } from './normalizer'
import { deepScrape } from './linkResolver'
import { estimatePrizeValue } from './valuationDictionary'
import { DOMParser as XmlDOMParser } from '@xmldom/xmldom'

const RSS2JSON_URL = 'https://api.rss2json.com/v1/api.json'
const CORSPROXY_URL = 'https://corsproxy.io/?'

type FetchResult =
  | { strategy: 'A'; data: { status: string; items: Rss2JsonItem[] } }
  | { strategy: 'B'; data: string }
  | { strategy: 'C' }

const RSS2JSON_COUNT = process.env.EXPO_PUBLIC_RSS2JSON_API_KEY ? 100 : 50

/**
 * Try Strategy B (corsproxy XML) first for full feeds, then A (rss2json), then C (no data).
 * For `rss2json_first` sources (Cloudflare-sensitive hosts), reverse the order.
 * Free rss2json ≈10 items; with `VITE_RSS2JSON_API_KEY` count rises to 50–100.
 */
async function fetchWithFallback(
  feedUrl: string,
  strategy: 'direct_first' | 'rss2json_first' = 'direct_first'
): Promise<FetchResult> {
  const encodedUrl = encodeURIComponent(feedUrl)
  const cacheBust = '&t=' + Date.now()
  const apiKey = process.env.EXPO_PUBLIC_RSS2JSON_API_KEY
  const rss2jsonParams = apiKey
    ? `rss_url=${encodedUrl}&api_key=${apiKey}&count=${RSS2JSON_COUNT}${cacheBust}`
    : `rss_url=${encodedUrl}${cacheBust}`

  const tryRss2Json = async (): Promise<FetchResult | null> => {
    try {
      const resA = await fetch(`${RSS2JSON_URL}?${rss2jsonParams}`)
      const json = (await resA.json()) as { status?: string; items?: Rss2JsonItem[] }
      if (json.status === 'ok' && Array.isArray(json.items) && json.items.length > 0) {
        console.log('Success using Strategy A (rss2json)', json.items.length, 'items')
        return { strategy: 'A', data: json as { status: string; items: Rss2JsonItem[] } }
      }
    } catch {
      /* fall through */
    }
    return null
  }

  const tryCorsProxy = async (): Promise<FetchResult | null> => {
    try {
      const resB = await fetch(CORSPROXY_URL + encodedUrl)
      const xml = await resB.text()
      const rawItems = parseFeedXml(xml)
      if (rawItems.length >= 1) {
        console.log('Strategy B (corsproxy)', rawItems.length, 'items')
        return { strategy: 'B', data: xml }
      }
    } catch {
      /* fall through */
    }
    return null
  }

  if (strategy === 'rss2json_first') {
    return (await tryRss2Json()) ?? (await tryCorsProxy()) ?? { strategy: 'C' }
  }
  return (await tryCorsProxy()) ?? (await tryRss2Json()) ?? { strategy: 'C' }
}

type XmlEl = {
  textContent: string | null
  getAttribute(name: string): string | null
  getElementsByTagName(name: string): { length: number; [i: number]: XmlEl }
}

/** First descendant matching any tag name (qualified names like `content:encoded` work in xmldom). */
function firstEl(root: XmlEl, ...names: string[]): XmlEl | undefined {
  for (const name of names) {
    const found = root.getElementsByTagName(name)
    if (found.length > 0) return found[0]
  }
  return undefined
}

function textOf(root: XmlEl, ...names: string[]): string | undefined {
  for (const name of names) {
    const t = firstEl(root, name)?.textContent?.trim()
    if (t) return t
  }
  return undefined
}

function listOf(root: XmlEl, name: string): XmlEl[] {
  const found = root.getElementsByTagName(name)
  const out: XmlEl[] = []
  for (let i = 0; i < found.length; i++) out.push(found[i])
  return out
}

/** React Native has no DOMParser/querySelector — parse RSS/Atom with xmldom. */
function parseFeedXml(xml: string): RawFeedItem[] {
  const parser = new XmlDOMParser({ errorHandler: { warning: () => {}, error: () => {} } })
  const doc = parser.parseFromString(xml, 'text/xml') as unknown as XmlEl
  const itemNodes = listOf(doc, 'item')
  const nodes = itemNodes.length ? itemNodes : listOf(doc, 'entry')
  const entries: RawFeedItem[] = []

  const feedLinkPattern = /\/(feed|rss)(\/|$)|atom\.xml$/i

  nodes.forEach((item) => {
    const title = textOf(item, 'title') ?? ''
    const linkEls = listOf(item, 'link')
    let link = ''
    for (const el of linkEls) {
      if (el.getAttribute('rel') === 'self') continue
      const href = (el.getAttribute('href') || el.textContent?.trim() || '').trim()
      if (!href) continue
      if (feedLinkPattern.test(href)) continue
      link = href
      break
    }
    if (!link && linkEls.length > 0) {
      const first = linkEls[0]
      link = (first.getAttribute('href') || first.textContent?.trim() || '').trim()
    }
    const description = textOf(item, 'description', 'summary')
    const pubDate = textOf(item, 'pubDate', 'published', 'updated', 'dc:date')
    const enclosure = firstEl(item, 'enclosure')?.getAttribute('url') || undefined
    const mediaContent =
      firstEl(item, 'media:content')?.getAttribute('url') ||
      firstEl(item, 'content')?.getAttribute('url') ||
      undefined
    const contentEncoded = textOf(item, 'content:encoded')
    const content = textOf(item, 'content', 'summary')

    if (title && link) {
      entries.push({
        title,
        link,
        description,
        pubDate,
        enclosure,
        mediaContent,
        contentEncoded,
        content,
      })
    }
  })

  return entries
}

function normalizeForDedupe(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

function isDuplicateTitle(a: string, b: string): boolean {
  const na = normalizeForDedupe(a)
  const nb = normalizeForDedupe(b)
  if (na === nb) return true
  if (na.length < 15 || nb.length < 15) return na === nb
  return na.includes(nb) || nb.includes(na)
}

const SAFETY_NET_CONTEST: Contest = {
  id: '__offline_alert__',
  title: 'Unable to connect to live feed. Check internet.',
  url: '#',
  source: 'System Alert',
  tags: [],
  restrictions: [],
  eligibility: 'CA',
  requirements: [],
  expiryDate: new Date().toISOString(),
  is_estimated_expiry: true,
}

/**
 * Fetch one source via fetchWithFallback and push normalized contests into results.
 */
async function fetchOneSource(source: Source, results: Contest[]): Promise<void> {
  console.log('Fetching source:', source.name, `(${source.country})`)
  try {
    const result = await fetchWithFallback(source.url, source.fetchStrategy ?? 'direct_first')
    if (result.strategy === 'A') {
      result.data.items.forEach((item, i) => {
        const body = [item.description ?? '', item.content ?? ''].join(' ')
        if (!itemMatchesSourceFilter(source, item.title, body)) return
        results.push(normalizeJsonItem(item, source, i))
      })
    } else if (result.strategy === 'B') {
      const rawItems = parseFeedXml(result.data)
      rawItems.forEach((item, i) => {
        const body = [item.description ?? '', item.contentEncoded ?? '', item.content ?? ''].join(' ')
        if (!itemMatchesSourceFilter(source, item.title, body)) return
        results.push(normalizeXmlItem(item, source, i))
      })
    }
    // C: add nothing
  } catch (error) {
    console.error('Failed source:', source.name, error)
    throw error
  }
}

/**
 * Fetch all contests. Returns contests and offlineMode (true when only safety net is returned).
 */
export async function fetchAllContests(): Promise<{
  contests: Contest[]
  offlineMode: boolean
}> {
  const results: Contest[] = []
  const sources = getActiveSources()

  const settled = await Promise.allSettled(
    sources.map(async (source) => {
      await fetchOneSource(source, results)
    })
  )

  const failedIndices: number[] = []
  settled.forEach((outcome, i) => {
    if (outcome.status === 'rejected') failedIndices.push(i)
  })

  if (failedIndices.length > 0) {
    for (const i of failedIndices) {
      const source = sources[i]
      if (!source) continue
      try {
        await fetchOneSource(source, results)
      } catch (error) {
        console.error('Retry failed for source:', source.name, error)
      }
    }
  }

  let contests: Contest[]
  let offlineMode: boolean

  if (results.length === 0) {
    contests = [SAFETY_NET_CONTEST]
    offlineMode = true
  } else {
    offlineMode = false
    const byUrl = new Map<string, Contest>()
    for (const c of results) {
      if (!byUrl.has(c.url)) byUrl.set(c.url, c)
    }
    const list = [...byUrl.values()]
    list.sort((a, b) => {
      const da = a.expiryDate ? new Date(a.expiryDate).getTime() : 0
      const db = b.expiryDate ? new Date(b.expiryDate).getTime() : 0
      return db - da
    })
    const deduped: Contest[] = []
    for (const c of list) {
      const isDup = deduped.some((r) => isDuplicateTitle(r.title, c.title))
      if (!isDup) deduped.push(c)
    }
    const live = deduped.filter((c) => {
      if (c.id === '__offline_alert__') return true
      if (!c.expiryDate) return true
      const end = toExpiryEndOfDay(c.expiryDate)
      if (Number.isNaN(end.getTime())) return true
      return end > new Date()
    })
    contests = live
  }

  return { contests, offlineMode }
}

/**
 * Fetch raw contests: same as fetchAllContests but without the expiry filter.
 * Used by the pipeline Phase 1 (The Net). Returns deduped list only.
 */
export async function fetchRawContests(): Promise<{
  contests: Contest[]
  offlineMode: boolean
}> {
  const results: Contest[] = []
  const sources = getActiveSources()

  const settled = await Promise.allSettled(
    sources.map(async (source) => {
      await fetchOneSource(source, results)
    })
  )

  const failedIndices: number[] = []
  settled.forEach((outcome, i) => {
    if (outcome.status === 'rejected') failedIndices.push(i)
  })

  if (failedIndices.length > 0) {
    for (const i of failedIndices) {
      const source = sources[i]
      if (!source) continue
      try {
        await fetchOneSource(source, results)
      } catch (error) {
        console.error('Retry failed for source:', source.name, error)
      }
    }
  }

  if (results.length === 0) {
    return { contests: [SAFETY_NET_CONTEST], offlineMode: true }
  }

  const byUrl = new Map<string, Contest>()
  for (const c of results) {
    if (!byUrl.has(c.url)) byUrl.set(c.url, c)
  }
  const list = [...byUrl.values()]
  list.sort((a, b) => {
    const da = a.expiryDate ? new Date(a.expiryDate).getTime() : 0
    const db = b.expiryDate ? new Date(b.expiryDate).getTime() : 0
    return db - da
  })
  const deduped: Contest[] = []
  for (const c of list) {
    const isDup = deduped.some((r) => isDuplicateTitle(r.title, c.title))
    if (!isDup) deduped.push(c)
  }

  return { contests: deduped, offlineMode: false }
}

/**
 * Enrich a contest in the background: Deep Scrape for expiry/value, then Smart Valuation.
 * Use scrapedExpiry when expiry is missing or estimated; use scrapedValue when prizeValue is missing.
 */
export async function enrichContest(contest: Contest): Promise<Contest> {
  if (contest.id === '__offline_alert__') return contest

  const rssContent = contest.contentSnippet ?? contest.description ?? ''
  const result = await deepScrape(contest.url, rssContent)
  let expiryDate = contest.expiryDate
  let is_estimated_expiry = contest.is_estimated_expiry
  let prizeValue = contest.prizeValue

  if (result.scrapedExpiry && (contest.is_estimated_expiry || !contest.expiryDate)) {
    expiryDate = result.scrapedExpiry
    is_estimated_expiry = false
  }

  if (result.scrapedValue != null && (prizeValue == null || prizeValue === 0)) {
    prizeValue = result.scrapedValue
  }

  // A page that doesn't restate eligibility (cookie wall, short post, blocked fetch) scans as
  // 'Unknown' — never let that erase the feed's own CA/US signal.
  const scrapedElig = result.scrapedEligibility
  const useScraped = scrapedElig != null && scrapedElig !== 'Unknown'
  const eligibility = useScraped ? scrapedElig : contest.eligibility
  const eligibilityUnverified = useScraped
    ? result.scrapedEligibilityUnverified
    : contest.eligibilityUnverified
  const requirements = [
    ...new Set([...(contest.requirements ?? []), ...(result.scrapedRequirements ?? [])]),
  ]
  const rssTags = contest.tags ?? []
  const rssRestrictions = contest.restrictions ?? []
  const scrapedTags = result.scrapedTags ?? []
  const scrapedRestrictions = result.scrapedRestrictions ?? []
  const tags = [...new Set([...rssTags, ...scrapedTags])]
  const restrictions = [...new Set([...rssRestrictions, ...scrapedRestrictions])]

  if (prizeValue == null || prizeValue === 0) {
    const estimated = estimatePrizeValue(contest.title, contest.description)
    if (estimated != null) prizeValue = estimated
  }

  return {
    ...contest,
    url: result.finalUrl,
    expiryDate,
    is_estimated_expiry,
    prizeValue,
    eligibility,
    eligibilityUnverified,
    requirements,
    tags,
    restrictions,
    ...(result.status != null && (result.status < 200 || result.status >= 300) && { linkStatus: result.status }),
    ...(result.isLocked === true && { isLocked: true }),
  }
}

export type { Contest }
