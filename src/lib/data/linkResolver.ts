/**
 * Link Resolver (Deep Scrape): fetches the page, finds final URL, and scrapes expiry/value/eligibility/requirements.
 * Scans the middleman page HTML for eligibility and entry requirements.
 */

import { sanitizeContestUrl } from '../utils/sanitizeContestUrl'
import { scanForMetadata, autoCategorize } from './tagger'

const PROXY = 'https://corsproxy.io/?'

export interface DeepScrapeResult {
  finalUrl: string
  status?: number
  isLocked?: boolean
  scrapedExpiry?: string // ISO
  scrapedValue?: number
  scrapedEligibility?: 'CA' | 'US' | 'NA' | 'Unknown'
  scrapedEligibilityUnverified?: boolean
  scrapedRequirements?: string[]
  scrapedTags?: string[]
  scrapedRestrictions?: string[]
}

const WIDGET_DOMAINS = /(?:gleam\.io|woobox\.com|rafflecopter\.com|kingsumo\.com|vyre\.network|promosimple\.com)/i

const CONTEST_LIKE_PATHS = /(?:sweepstakes|giveaway|gleam\.io|woobox|rafflecopter|kingsumo)/i

/**
 * Extract contest/widget URLs from raw RSS text before fetching the page.
 * Avoids hitting RFD login wall when the link is already in the description.
 * First tries widget domains; then falls back to any contest-like URL in path.
 */
export function extractFromText(text: string): string | null {
  if (!text || typeof text !== 'string') return null
  const urlRe = /https?:\/\/[^\s"'<>)\]]+/gi
  let m: RegExpExecArray | null
  let contestLikeFallback: string | null = null
  while ((m = urlRe.exec(text)) !== null) {
    const url = m[0].replace(/[.,;:!?)\]]+$/, '')
    if (/\.(css|js|png|jpg|jpeg|gif|ico|woff|svg)/i.test(url)) continue
    if (WIDGET_DOMAINS.test(url)) return url
    if (!contestLikeFallback && CONTEST_LIKE_PATHS.test(url)) contestLikeFallback = url
  }
  return contestLikeFallback
}

const LOGIN_WALL_PHRASES = [
  /you must be logged in to view this link/i,
  /sign in to see/i,
]

function isLoginWall(html: string): boolean {
  return LOGIN_WALL_PHRASES.some((p) => p.test(html))
}

const CACHE_VERSION = 5 // bump when extractFinalUrl logic changes to invalidate stale URLs
const CACHE_TTL_MS = 86400000 // 24 hours
const cache = new Map<string, { result: DeepScrapeResult; ts: number }>()

async function fetchHtml(url: string): Promise<{ html: string; status: number }> {
  const res = await fetch(PROXY + encodeURIComponent(url))
  const html = await res.text()
  return { html, status: res.status }
}

function extractWidgetUrl(html: string, baseUrl: string): string | null {
  const widgetPat = /(?:gleam\.io|woobox\.com|rafflecopter\.com|kingsumo\.com|vyre\.network|promosimple\.com)/i
  const iframeRe = new RegExp(`<iframe[^>]+src=["']([^"']*${widgetPat.source}[^"']*)["']`, 'gi')
  const iframeMatch = iframeRe.exec(html)
  if (iframeMatch?.[1]) {
    const href = iframeMatch[1]
    return href.startsWith('http') ? href : new URL(href, baseUrl).href
  }
  const linkRe = new RegExp(`<a[^>]+href=["']([^"']*${widgetPat.source}[^"']*)["']`, 'gi')
  const linkMatch = linkRe.exec(html)
  if (linkMatch?.[1]) {
    const href = linkMatch[1]
    return href.startsWith('http') ? href : new URL(href, baseUrl).href
  }
  return null
}

function isSearchUrl(href: string, baseUrl: string): boolean {
  try {
    const full = href.startsWith('http') ? href : new URL(href, baseUrl).href
    const lower = full.toLowerCase()
    if (/\/search\/?(\?|$)/i.test(full) || /\/find\/?(\?|$)/i.test(full)) return true
    if (/\?s=|\?q=|\?search=|\?query=/i.test(full)) return true
    if (lower.includes('google.com/search') || lower.includes('bing.com') || lower.includes('duckduckgo.com')) return true
    return false
  } catch {
    return false
  }
}

function isBadContestUrl(href: string, baseUrl: string): boolean {
  if (!href || /^#|javascript:/i.test(href.trim())) return true
  try {
    const full = href.startsWith('http') ? href : new URL(href, baseUrl).href
    const u = new URL(full)
    const path = u.pathname.toLowerCase()
    const badPaths = [
      /\/category\//i, /\/tag\//i, /\/author\//i, /\/page\//i,
      /\/comments\/?/i, /\/feed\/?/i, /\/rss\/?/i, /\/atom\/?/i,
      /\/cart\/?/i, /\/checkout\/?/i, /\/login\/?/i, /\/register\/?/i,
    ]
    if (badPaths.some((re) => re.test(path))) return true
    if (path === '/' || path === '') return true
    if (isSearchUrl(href, baseUrl)) return true
    return false
  } catch {
    return true
  }
}

function isExternalLink(href: string, baseUrl: string): boolean {
  try {
    const hrefFull = href.startsWith('http') ? href : new URL(href, baseUrl).href
    const baseHost = new URL(baseUrl).host
    return new URL(hrefFull).host !== baseHost
  } catch {
    return false
  }
}

function extractMainContentHtml(html: string): string {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const selectors = [
      'article', 'main', '[role="main"]', '.entry-content', '.post-content', '.content',
      '.article-body', '.post-body', '.article-content', '.single-post',
      '[itemprop="articleBody"]', '#content', '.blog-post',
    ]
    for (const sel of selectors) {
      const el = doc.querySelector(sel)
      if (el?.innerHTML?.length > 200) return el.innerHTML
    }
  } catch (_) {
    /* fall through */
  }
  return html
}

type ScoredCandidate = { url: string; score: number }

function extractUrlCandidates(html: string, baseUrl: string): ScoredCandidate[] {
  const byKey = new Map<string, number>()
  const add = (href: string, score: number) => {
    if (!href || /\.(css|js|png|jpg|ico)/i.test(href)) return
    const full = href.startsWith('http') ? href : new URL(href, baseUrl).href
    const key = full.toLowerCase().replace(/\/$/, '')
    if (isBadContestUrl(href, baseUrl)) return
    const prev = byKey.get(key)
    if (prev == null || score > prev) byKey.set(key, score)
  }
  const ctaEnterRe = /href\s*=\s*["']([^"']*enter[^"']*)["']/gi
  let m: RegExpExecArray | null
  while ((m = ctaEnterRe.exec(html)) !== null) add(m[1], 80)
  const ctaOtherRe = /href\s*=\s*["']([^"']*(?:entry|contest|giveaway|win)[^"']*)["']/gi
  while ((m = ctaOtherRe.exec(html)) !== null) add(m[1], 70)
  const formRe = /<form[^>]+action\s*=\s*["']([^"']+)["']/gi
  while ((m = formRe.exec(html)) !== null) add(m[1], 50)
  const anyRe = /href\s*=\s*["'](https?:\/\/[^"']+)["']/gi
  while ((m = anyRe.exec(html)) !== null) add(m[1], 20)
  return [...byKey.entries()].map(([url, score]) => ({ url, score }))
}

function looksLikeContestPage(html: string): boolean {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (/\b(enter|sweepstakes|giveaway|contest)\b/i.test(text)) return true
  const widgetPat = /(?:gleam\.io|woobox\.com|rafflecopter\.com)/i
  return widgetPat.test(html)
}

async function extractFinalUrl(html: string, baseUrl: string): Promise<string> {
  const widgetUrl = extractWidgetUrl(html, baseUrl)
  if (widgetUrl) return widgetUrl

  const mainHtml = extractMainContentHtml(html)
  let candidates = extractUrlCandidates(mainHtml, baseUrl)
  if (candidates.length === 0) candidates = extractUrlCandidates(html, baseUrl)

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const aExt = isExternalLink(a.url, baseUrl)
    const bExt = isExternalLink(b.url, baseUrl)
    return (bExt ? 1 : 0) - (aExt ? 1 : 0)
  })

  const baseUrlNorm = sanitizeContestUrl(baseUrl)
  for (const { url, score } of candidates) {
    if (score < 30) break
    const urlNorm = sanitizeContestUrl(url)
    if (urlNorm === baseUrlNorm) return url
    if (!isExternalLink(url, baseUrl)) return url
    try {
      const c = new AbortController()
      const t = setTimeout(() => c.abort(), 5000)
      const res = await fetch(PROXY + encodeURIComponent(url), { signal: c.signal })
      clearTimeout(t)
      const body = await res.text()
      if (looksLikeContestPage(body)) return url
    } catch (_) {
      /* try next candidate */
    }
  }
  return baseUrl
}

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
}

function extractExpiryFromHtml(html: string): string | undefined {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const now = new Date()
  const currentYear = now.getFullYear()

  try {
    const prefix = /(?:draw date|draws on|entries accepted until|giveaway over on|ends?|closes?|expires?):/i
    const monthDay = text.match(new RegExp(`\\b${prefix.source}\\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\s+(\\d{1,2})(?:,?\\s*(\\d{4}))?`, 'i'))
    if (monthDay) {
      const monthStr = monthDay[2].toLowerCase().slice(0, 3)
      const month = MONTHS[monthStr] ?? MONTHS[monthStr + 'uary']
      const day = parseInt(monthDay[3], 10)
      const year = monthDay[4] ? parseInt(monthDay[4], 10) : currentYear
      if (month != null && day >= 1 && day <= 31) {
        const d = new Date(year, month, day)
        if (!Number.isNaN(d.getTime())) return d.toISOString()
      }
    }

    const isoMatch = text.match(/(?:draw date|draws on|entries accepted until|giveaway over on|ends?|closes?|expires?):\s*(\d{4})-(\d{2})-(\d{2})/i)
    if (isoMatch) {
      const d = new Date(
        parseInt(isoMatch[1], 10),
        parseInt(isoMatch[2], 10) - 1,
        parseInt(isoMatch[3], 10)
      )
      if (!Number.isNaN(d.getTime())) return d.toISOString()
    }

    const slashMatch = text.match(/(?:draw date|draws on|entries accepted until|giveaway over on|ends?|closes?|expires?):\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/i)
    if (slashMatch) {
      let year = parseInt(slashMatch[3], 10) || currentYear
      if (year < 100) year += year < 50 ? 2000 : 1900
      const month = parseInt(slashMatch[1], 10) - 1
      const day = parseInt(slashMatch[2], 10)
      if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        const d = new Date(year, month, day)
        if (!Number.isNaN(d.getTime())) return d.toISOString()
      }
    }
  } catch (_) {
    // fall through
  }
  return undefined
}

function extractValueFromHtml(html: string): number | undefined {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  const arvMatch = text.match(/\b(?:ARV|A\.R\.V\.?)\s*[$]?\s*([\d,]+(?:\.[\d]{2})?)/i)
  if (arvMatch?.[1]) {
    const n = parseFloat(arvMatch[1].replace(/,/g, ''))
    if (!Number.isNaN(n)) return n
  }

  const worthMatch = text.match(/\b(?:valued at|worth|prize worth)\s*[$]?\s*([\d,]+(?:\.[\d]{2})?)/i)
  if (worthMatch?.[1]) {
    const n = parseFloat(worthMatch[1].replace(/,/g, ''))
    if (!Number.isNaN(n)) return n
  }

  const dollarMatch = text.match(/\$[\d,]+(?:\.[\d]{2})?|\d+\s*(?:CAD|USD)/i)
  if (dollarMatch) {
    const n = parseFloat(dollarMatch[0].replace(/[$,CADUSD\s]/gi, ''))
    if (!Number.isNaN(n)) return n
  }

  return undefined
}

/**
 * Deep scrape: fetch page, find final URL, extract expiry and value from HTML.
 * If rssContent is provided, extracts widget URLs from text first to avoid fetching
 * RFD pages behind the login wall.
 */
export async function deepScrape(url: string, rssContent?: string): Promise<DeepScrapeResult> {
  const cleanUrl = sanitizeContestUrl(url)
  const cacheKey = `${CACHE_VERSION}:${cleanUrl}`
  const cached = cache.get(cacheKey)
  if (cached) {
    if (Date.now() - cached.ts <= CACHE_TTL_MS) return cached.result
    cache.delete(cacheKey)
  }

  const textToScan = rssContent ?? ''
  const extracted = extractFromText(textToScan)
  if (extracted) {
    const result: DeepScrapeResult = { finalUrl: sanitizeContestUrl(extracted) }
    cache.set(cacheKey, { result, ts: Date.now() })
    return result
  }

  try {
    const { html, status } = await fetchHtml(cleanUrl)
    if (isLoginWall(html)) {
      const locked: DeepScrapeResult = { finalUrl: cleanUrl, isLocked: true }
      cache.set(cacheKey, { result: locked, ts: Date.now() })
      return locked
    }
    const rawUrl = await extractFinalUrl(html, cleanUrl)
    const finalUrl = sanitizeContestUrl(rawUrl)
    const scrapedExpiry = extractExpiryFromHtml(html)
    const scrapedValue = extractValueFromHtml(html)

    const pageText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const { eligibility, eligibilityUnverified, requirements } = scanForMetadata('', pageText)
    const { tags: scrapedTags, restrictions: scrapedRestrictions } = autoCategorize('', pageText)

    const result: DeepScrapeResult = { finalUrl }
    if (status < 200 || status >= 300) result.status = status
    if (scrapedExpiry) result.scrapedExpiry = scrapedExpiry
    if (scrapedValue != null) result.scrapedValue = scrapedValue
    result.scrapedEligibility = eligibility
    result.scrapedEligibilityUnverified = eligibilityUnverified
    result.scrapedRequirements = requirements
    result.scrapedTags = scrapedTags
    result.scrapedRestrictions = scrapedRestrictions

    cache.set(cacheKey, { result, ts: Date.now() })
    return result
  } catch (_) {
    const fallback: DeepScrapeResult = { finalUrl: cleanUrl, status: 500 }
    cache.set(cacheKey, { result: fallback, ts: Date.now() })
    return fallback
  }
}
