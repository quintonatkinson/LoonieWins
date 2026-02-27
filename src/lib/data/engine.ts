/**
 * Data Aggregation Engine: round-robin fetch (rss2json → corsproxy → safety net).
 * Returns JSON-friendly data with offline fallback.
 * enrichContest runs Deep Scrape + Smart Valuation for expiry/value enrichment.
 */

import { toExpiryEndOfDay } from '../utils/expiryDate'
import { MASTER_SOURCES } from './sources'
import type { Contest, RawFeedItem, Rss2JsonItem } from './normalizer'
import { normalizeJsonItem, normalizeXmlItem } from './normalizer'
import { deepScrape } from './linkResolver'
import { estimatePrizeValue } from './valuationDictionary'

const RSS2JSON_URL = 'https://api.rss2json.com/v1/api.json'
const CORSPROXY_URL = 'https://corsproxy.io/?'

type FetchResult =
  | { strategy: 'A'; data: { status: string; items: Rss2JsonItem[] } }
  | { strategy: 'B'; data: string }
  | { strategy: 'C' }

const RSS2JSON_COUNT = 50

/**
 * Try Strategy B (corsproxy XML) first for full feeds, then A (rss2json), then C (no data).
 * rss2json returns only 10 items by default; corsproxy fetches raw XML with all items.
 */
async function fetchWithFallback(feedUrl: string): Promise<FetchResult> {
  const encodedUrl = encodeURIComponent(feedUrl)
  const cacheBust = '&t=' + Date.now()
  const apiKey = import.meta.env.VITE_RSS2JSON_API_KEY
  const rss2jsonParams = apiKey
    ? `rss_url=${encodedUrl}&api_key=${apiKey}&count=${RSS2JSON_COUNT}${cacheBust}`
    : `rss_url=${encodedUrl}${cacheBust}`

  try {
    const resB = await fetch(CORSPROXY_URL + encodedUrl)
    const xml = await resB.text()
    const rawItems = parseFeedXml(xml)
    if (rawItems.length >= 5) {
      console.log('Strategy B (corsproxy)', rawItems.length, 'items')
      return { strategy: 'B', data: xml }
    }
  } catch (_) {
    /* fall through */
  }

  try {
    const resA = await fetch(`${RSS2JSON_URL}?${rss2jsonParams}`)
    const json = (await resA.json()) as { status?: string; items?: Rss2JsonItem[] }
    if (json.status === 'ok' && Array.isArray(json.items) && json.items.length > 0) {
      console.log('Success using Strategy A')
      return { strategy: 'A', data: json as { status: string; items: Rss2JsonItem[] } }
    }
  } catch (_) {
    /* fall through */
  }

  return { strategy: 'C' }
}

function parseFeedXml(xml: string): RawFeedItem[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'text/xml')
  const items = doc.querySelectorAll('item')
  const entries: RawFeedItem[] = []

  items.forEach((item) => {
    const title = item.querySelector('title')?.textContent?.trim() ?? ''
    let link =
      item.querySelector('link')?.textContent?.trim() ??
      item.querySelector('link')?.nextSibling?.textContent?.trim() ??
      ''
    if (!link && item.querySelector('link')) {
      const el = item.querySelector('link')
      link = el?.getAttribute('href') ?? el?.textContent?.trim() ?? ''
    }
    const description = item.querySelector('description')?.textContent?.trim()
    const pubDate =
      item.querySelector('pubDate')?.textContent?.trim() ??
      item.querySelector('published')?.textContent?.trim()
    const enc = item.querySelector('enclosure')
    const enclosure = enc?.getAttribute('url') ?? undefined
    const mediaContent =
      item.querySelector('media\\:content')?.getAttribute('url') ??
      item.querySelector('content')?.getAttribute('url') ??
      undefined
    const contentEncoded = item.querySelector('content\\:encoded')?.textContent?.trim()
    let content = item.querySelector('content')?.textContent?.trim()
    if (!content && item.getElementsByTagName('content').length > 0) {
      content = item.getElementsByTagName('content')[0]?.textContent?.trim() ?? undefined
    }
    if (!content) {
      const atomContent = item.getElementsByTagNameNS('http://www.w3.org/2005/Atom', 'content')[0]
      content = atomContent?.textContent?.trim() ?? undefined
    }

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
async function fetchOneSource(
  source: (typeof MASTER_SOURCES)[0],
  results: Contest[]
): Promise<void> {
  console.log('Fetching source:', source.name)
  try {
    const result = await fetchWithFallback(source.url)
    if (result.strategy === 'A') {
      result.data.items.forEach((item, i) => {
        results.push(normalizeJsonItem(item, source, i))
      })
    } else if (result.strategy === 'B') {
      const rawItems = parseFeedXml(result.data)
      rawItems.forEach((item, i) => {
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

  const settled = await Promise.allSettled(
    MASTER_SOURCES.map(async (source) => {
      await fetchOneSource(source, results)
    })
  )

  const failedIndices: number[] = []
  settled.forEach((outcome, i) => {
    if (outcome.status === 'rejected') failedIndices.push(i)
  })

  if (failedIndices.length > 0) {
    for (const i of failedIndices) {
      const source = MASTER_SOURCES[i]
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
    let list = [...byUrl.values()]
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

  const settled = await Promise.allSettled(
    MASTER_SOURCES.map(async (source) => {
      await fetchOneSource(source, results)
    })
  )

  const failedIndices: number[] = []
  settled.forEach((outcome, i) => {
    if (outcome.status === 'rejected') failedIndices.push(i)
  })

  if (failedIndices.length > 0) {
    for (const i of failedIndices) {
      const source = MASTER_SOURCES[i]
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
  let list = [...byUrl.values()]
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

  const eligibility = result.scrapedEligibility ?? contest.eligibility
  const eligibilityUnverified = result.scrapedEligibilityUnverified ?? contest.eligibilityUnverified
  const requirements = result.scrapedRequirements ?? contest.requirements ?? []

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
    ...(result.status != null && (result.status < 200 || result.status >= 300) && { linkStatus: result.status }),
    ...(result.isLocked === true && { isLocked: true }),
  }
}

export type { Contest }
