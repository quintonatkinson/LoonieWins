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

/**
 * Extract contest/widget URLs from raw RSS text before fetching the page.
 * Avoids hitting RFD login wall when the link is already in the description.
 */
export function extractFromText(text: string): string | null {
  if (!text || typeof text !== 'string') return null
  const urlRe = /https?:\/\/[^\s"'<>)\]]+/gi
  let m: RegExpExecArray | null
  while ((m = urlRe.exec(text)) !== null) {
    const url = m[0].replace(/[.,;:!?)\]]+$/, '')
    if (/\.(css|js|png|jpg|jpeg|gif|ico|woff|svg)/i.test(url)) continue
    if (WIDGET_DOMAINS.test(url)) return url
  }
  return null
}

const LOGIN_WALL_PHRASES = [
  /you must be logged in to view this link/i,
  /sign in to see/i,
]

function isLoginWall(html: string): boolean {
  return LOGIN_WALL_PHRASES.some((p) => p.test(html))
}

const cache = new Map<string, DeepScrapeResult>()
const CACHE_VERSION = 3 // bump when extractFinalUrl logic changes to invalidate stale URLs

async function fetchHtml(url: string): Promise<{ html: string; status: number }> {
  const res = await fetch(PROXY + encodeURIComponent(url))
  const html = await res.text()
  return { html, status: res.status }
}

function extractWidgetUrl(html: string, baseUrl: string): string | null {
  const iframeRe = /<iframe[^>]+src=["']([^"']*(?:gleam\.io|woobox\.com|rafflecopter\.com)[^"']*)["']/gi
  const iframeMatch = iframeRe.exec(html)
  if (iframeMatch?.[1]) {
    const href = iframeMatch[1]
    return href.startsWith('http') ? href : new URL(href, baseUrl).href
  }
  const linkRe = /<a[^>]+href=["']([^"']*(?:gleam\.io|woobox\.com|rafflecopter\.com)[^"']*)["']/gi
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

function extractFinalUrl(html: string, baseUrl: string): string {
  const widgetUrl = extractWidgetUrl(html, baseUrl)
  if (widgetUrl) return widgetUrl

  const ctaRe = /href\s*=\s*["']([^"']*(?:enter|entry|contest|giveaway|win)[^"']*)["']/gi
  let ctaMatch: RegExpExecArray | null
  while ((ctaMatch = ctaRe.exec(html)) !== null) {
    const href = ctaMatch[1]
    if (!/\.(css|js|png|jpg|ico)/i.test(href) && !isSearchUrl(href, baseUrl)) {
      return href.startsWith('http') ? href : new URL(href, baseUrl).href
    }
  }

  const formRe = /<form[^>]+action\s*=\s*["']([^"']+)["']/gi
  let formMatch: RegExpExecArray | null
  while ((formMatch = formRe.exec(html)) !== null) {
    const href = formMatch[1]
    if (!isSearchUrl(href, baseUrl)) {
      return href.startsWith('http') ? href : new URL(href, baseUrl).href
    }
  }

  const anyRe = /href\s*=\s*["'](https?:\/\/[^"']+)["']/gi
  let anyMatch: RegExpExecArray | null
  while ((anyMatch = anyRe.exec(html)) !== null) {
    const href = anyMatch[1]
    if (!/\.(css|js|png|jpg|ico)/i.test(href) && !isSearchUrl(href, baseUrl)) {
      return href
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
  if (cached) return cached

  const textToScan = rssContent ?? ''
  const extracted = extractFromText(textToScan)
  if (extracted) {
    const result: DeepScrapeResult = { finalUrl: sanitizeContestUrl(extracted) }
    cache.set(cacheKey, result)
    return result
  }

  try {
    const { html, status } = await fetchHtml(cleanUrl)
    if (isLoginWall(html)) {
      const locked: DeepScrapeResult = { finalUrl: cleanUrl, isLocked: true }
      cache.set(cacheKey, locked)
      return locked
    }
    const rawUrl = extractFinalUrl(html, cleanUrl)
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

    cache.set(cacheKey, result)
    return result
  } catch (_) {
    const fallback: DeepScrapeResult = { finalUrl: cleanUrl, status: 500 }
    cache.set(cacheKey, fallback)
    return fallback
  }
}
