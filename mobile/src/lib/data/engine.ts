/**
 * Data Aggregation Engine: round-robin fetch (rss2json → corsproxy).
 * enrichContest runs Deep Scrape + Smart Valuation.
 */

import { DOMParser } from '@xmldom/xmldom'
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

const apiKey = typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_RSS2JSON_API_KEY
const RSS2JSON_COUNT = apiKey ? 100 : 50

async function fetchWithFallback(feedUrl: string): Promise<FetchResult> {
  const encodedUrl = encodeURIComponent(feedUrl)
  const cacheBust = '&t=' + Date.now()
  const rss2jsonParams = apiKey
    ? `rss_url=${encodedUrl}&api_key=${apiKey}&count=${RSS2JSON_COUNT}${cacheBust}`
    : `rss_url=${encodedUrl}${cacheBust}`

  try {
    const resB = await fetch(CORSPROXY_URL + encodedUrl)
    const xml = await resB.text()
    const rawItems = parseFeedXml(xml)
    if (rawItems.length >= 5) {
      return { strategy: 'B', data: xml }
    }
  } catch (_) {}

  try {
    const resA = await fetch(`${RSS2JSON_URL}?${rss2jsonParams}`)
    const json = (await resA.json()) as { status?: string; items?: Rss2JsonItem[] }
    if (json.status === 'ok' && Array.isArray(json.items) && json.items.length > 0) {
      return { strategy: 'A', data: json as { status: string; items: Rss2JsonItem[] } }
    }
  } catch (_) {}

  return { strategy: 'C' }
}

function parseFeedXml(xml: string): RawFeedItem[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'text/xml')
  const itemNodes = doc.querySelectorAll('item')
  const atomNodes = doc.querySelectorAll('entry')
  const nodes = itemNodes.length ? itemNodes : atomNodes
  const entries: RawFeedItem[] = []
  const feedLinkPattern = /\/(feed|rss)(\/|$)|atom\.xml$/i

  nodes.forEach((item) => {
    const title = item.querySelector('title')?.textContent?.trim() ?? ''
    const linkEls = item.querySelectorAll('link')
    let link = ''
    for (const el of linkEls) {
      if (el.getAttribute('rel') === 'self') continue
      const href = (el.getAttribute('href') ?? el.textContent?.trim() ?? '').trim()
      if (!href || feedLinkPattern.test(href)) continue
      link = href
      break
    }
    if (!link && linkEls.length > 0) {
      link = (linkEls[0]?.getAttribute('href') ?? linkEls[0]?.textContent?.trim() ?? '').trim()
    }
    const description = item.querySelector('description')?.textContent?.trim() ?? item.querySelector('summary')?.textContent?.trim()
    const pubDate = item.querySelector('pubDate')?.textContent?.trim() ?? item.querySelector('published')?.textContent?.trim() ?? item.querySelector('updated')?.textContent?.trim()
    const enc = item.querySelector('enclosure')
    const enclosure = enc?.getAttribute('url') ?? undefined
    const mediaContent = item.querySelector('media\\:content')?.getAttribute('url') ?? item.querySelector('content')?.getAttribute('url') ?? undefined
    const contentEncoded = item.querySelector('content\\:encoded')?.textContent?.trim()
    let content = item.querySelector('content')?.textContent?.trim()
    if (!content && item.getElementsByTagName('content').length > 0) content = item.getElementsByTagName('content')[0]?.textContent?.trim() ?? undefined
    if (!content) content = item.getElementsByTagNameNS('http://www.w3.org/2005/Atom', 'content')[0]?.textContent?.trim() ?? undefined
    if (!content) content = item.querySelector('summary')?.textContent?.trim() ?? undefined

    if (title && link) entries.push({ title, link, description, pubDate, enclosure, mediaContent, contentEncoded, content })
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

async function fetchOneSource(source: (typeof MASTER_SOURCES)[0], results: Contest[]): Promise<void> {
  try {
    const result = await fetchWithFallback(source.url)
    if (result.strategy === 'A') result.data.items.forEach((item, i) => results.push(normalizeJsonItem(item, source, i)))
    else if (result.strategy === 'B') parseFeedXml(result.data).forEach((item, i) => results.push(normalizeXmlItem(item, source, i)))
  } catch (error) {
    console.error('Failed source:', source.name, error)
    throw error
  }
}

export async function fetchAllContests(): Promise<{ contests: Contest[]; offlineMode: boolean }> {
  const results: Contest[] = []
  const settled = await Promise.allSettled(MASTER_SOURCES.map((s) => fetchOneSource(s, results)))
  const failedIndices: number[] = []
  settled.forEach((outcome, i) => { if (outcome.status === 'rejected') failedIndices.push(i) })
  for (const i of failedIndices) {
    try { await fetchOneSource(MASTER_SOURCES[i], results) } catch (_) {}
  }

  if (results.length === 0) return { contests: [SAFETY_NET_CONTEST], offlineMode: true }

  const byUrl = new Map<string, Contest>()
  for (const c of results) if (!byUrl.has(c.url)) byUrl.set(c.url, c)
  let list = [...byUrl.values()].sort((a, b) => {
    const da = a.expiryDate ? new Date(a.expiryDate).getTime() : 0
    const db = b.expiryDate ? new Date(b.expiryDate).getTime() : 0
    return db - da
  })
  const deduped: Contest[] = []
  for (const c of list) if (!deduped.some((r) => isDuplicateTitle(r.title, c.title))) deduped.push(c)
  const live = deduped.filter((c) => {
    if (c.id === '__offline_alert__') return true
    if (!c.expiryDate) return true
    const end = toExpiryEndOfDay(c.expiryDate)
    return Number.isNaN(end.getTime()) || end > new Date()
  })
  return { contests: live, offlineMode: false }
}

export async function fetchRawContests(): Promise<{ contests: Contest[]; offlineMode: boolean }> {
  const results: Contest[] = []
  const settled = await Promise.allSettled(MASTER_SOURCES.map((s) => fetchOneSource(s, results)))
  const failedIndices: number[] = []
  settled.forEach((outcome, i) => { if (outcome.status === 'rejected') failedIndices.push(i) })
  for (const i of failedIndices) {
    try { await fetchOneSource(MASTER_SOURCES[i], results) } catch (_) {}
  }

  if (results.length === 0) return { contests: [SAFETY_NET_CONTEST], offlineMode: true }

  const byUrl = new Map<string, Contest>()
  for (const c of results) if (!byUrl.has(c.url)) byUrl.set(c.url, c)
  let list = [...byUrl.values()].sort((a, b) => {
    const da = a.expiryDate ? new Date(a.expiryDate).getTime() : 0
    const db = b.expiryDate ? new Date(b.expiryDate).getTime() : 0
    return db - da
  })
  const deduped: Contest[] = []
  for (const c of list) if (!deduped.some((r) => isDuplicateTitle(r.title, c.title))) deduped.push(c)
  return { contests: deduped, offlineMode: false }
}

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
  if (result.scrapedValue != null && (prizeValue == null || prizeValue === 0)) prizeValue = result.scrapedValue

  const eligibility = result.scrapedEligibility ?? contest.eligibility
  const eligibilityUnverified = result.scrapedEligibilityUnverified ?? contest.eligibilityUnverified
  const requirements = result.scrapedRequirements ?? contest.requirements ?? []
  const tags = [...new Set([...(contest.tags ?? []), ...(result.scrapedTags ?? [])])]
  const restrictions = [...new Set([...(contest.restrictions ?? []), ...(result.scrapedRestrictions ?? [])])]

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
