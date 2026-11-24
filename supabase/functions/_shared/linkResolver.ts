/**
 * Server-side contest URL resolution (Edge Functions).
 * Mirrors client src/lib/data/linkResolver.ts without DOMParser or CORS proxy.
 * v1 — deployed via main / deploy-supabase-functions workflow.
 */

import { fetchPublicUrl } from './http.ts'

const WIDGET_DOMAINS =
  /(?:gleam\.io|woobox\.com|rafflecopter\.com|kingsumo\.com|vyre\.network|promosimple\.com)/i

const CONTEST_LIKE_PATHS = /(?:sweepstakes|giveaway|gleam\.io|woobox|rafflecopter|kingsumo)/i

/** Blog / listing hosts where RSS `link` is usually a middleman page. */
const AGGREGATOR_HOST =
  /(?:canadianfreestuff|contestcanada|contestscoop|sweetiessweeps|sweepstakesbible|freebieshark|hip2save|online-sweepstakes|southernsavers|contestbee|sweepstakeslovers|sweepstakesmag|freestufffinder|globalnews|torontosun|calgaryherald|vancouversun|theprovince|ottawacitizen)\./i

const LOGIN_WALL_PHRASES = [
  /you must be logged in to view this link/i,
  /sign in to see/i,
]

const MAX_HTML_BYTES = 600_000

export function sanitizeContestUrl(url: string): string {
  if (!url || typeof url !== 'string') return url
  let u = url.trim()
  const feedSuffixes = [/\/feed\/?$/i, /\/rss\/?$/i, /\/atom\/?$/i, /\/atom\.xml\/?$/i]
  for (const re of feedSuffixes) {
    u = u.replace(re, '')
  }
  return u.replace(/\/$/, '') || u
}

export function extractFromText(text: string): string | null {
  if (!text || typeof text !== 'string') return null
  const urlRe = /https?:\/\/[^\s"'<>)\]]+/gi
  let m: RegExpExecArray | null
  let contestLikeFallback: string | null = null
  while ((m = urlRe.exec(text)) !== null) {
    const url = m[0].replace(/[.,;:!?)\]]+$/, '')
    if (/\.(css|js|png|jpg|jpeg|gif|ico|woff|svg)/i.test(url)) continue
    if (WIDGET_DOMAINS.test(url)) return sanitizeContestUrl(url)
    if (!contestLikeFallback && CONTEST_LIKE_PATHS.test(url)) contestLikeFallback = url
  }
  return contestLikeFallback ? sanitizeContestUrl(contestLikeFallback) : null
}

export function isWidgetEntryUrl(url: string): boolean {
  try {
    return WIDGET_DOMAINS.test(new URL(url).hostname)
  } catch {
    return WIDGET_DOMAINS.test(url)
  }
}

export function isAggregatorListingUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (WIDGET_DOMAINS.test(host)) return false
    return AGGREGATOR_HOST.test(host)
  } catch {
    return AGGREGATOR_HOST.test(url)
  }
}

/** Listing page or non-widget URL that may still need HTML scrape to find the entry form. */
export function needsEntryResolution(url: string): boolean {
  if (isWidgetEntryUrl(url)) return false
  return isAggregatorListingUrl(url)
}

function isLoginWall(html: string): boolean {
  return LOGIN_WALL_PHRASES.some((p) => p.test(html))
}

function extractMainContentHtml(html: string): string {
  const selectors: RegExp[] = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*itemprop="articleBody"[^>]*>([\s\S]*?)<\/div>/i,
  ]
  for (const re of selectors) {
    const m = html.match(re)
    if (m?.[1] && m[1].length > 200) return m[1]
  }
  return html
}

function extractWidgetUrl(html: string, baseUrl: string): string | null {
  const widgetPat = WIDGET_DOMAINS
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
    if (lower.includes('google.com/search') || lower.includes('bing.com') || lower.includes('duckduckgo.com'))
      return true
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
  return WIDGET_DOMAINS.test(html)
}

/**
 * Pick the best outbound entry URL from listing-page HTML (no network).
 */
export function resolveFromHtml(html: string, pageUrl: string): string {
  const widgetUrl = extractWidgetUrl(html, pageUrl)
  if (widgetUrl) return sanitizeContestUrl(widgetUrl)

  const mainHtml = extractMainContentHtml(html)
  let candidates = extractUrlCandidates(mainHtml, pageUrl)
  if (candidates.length === 0) candidates = extractUrlCandidates(html, pageUrl)

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const aExt = isExternalLink(a.url, pageUrl)
    const bExt = isExternalLink(b.url, pageUrl)
    return (bExt ? 1 : 0) - (aExt ? 1 : 0)
  })

  const baseUrlNorm = sanitizeContestUrl(pageUrl)
  for (const { url, score } of candidates) {
    if (score < 30) break
    const urlNorm = sanitizeContestUrl(url)
    if (urlNorm === baseUrlNorm) continue
    if (WIDGET_DOMAINS.test(url)) return urlNorm
    if (!isExternalLink(url, pageUrl)) return urlNorm
    if (CONTEST_LIKE_PATHS.test(url) || score >= 70) return urlNorm
  }
  return sanitizeContestUrl(pageUrl)
}

async function readCapped(res: Response, deadline: number): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (size < MAX_HTML_BYTES && Date.now() < deadline) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      size += value.length
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  const buf = new Uint8Array(size)
  let off = 0
  for (const c of chunks) {
    buf.set(c, off)
    off += c.length
  }
  return new TextDecoder().decode(buf)
}

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; LoonieWinsLinkResolver/1.0; +https://github.com/quintonatkinson/LoonieWins)',
  Accept: 'text/html,application/xhtml+xml,*/*',
}

/**
 * Resolve RSS listing URL → direct entry URL when possible.
 * Eligibility scans should still use the original RSS link, not the resolved URL.
 */
export async function resolveContestEntryUrl(
  rawUrl: string,
  options: { rssText?: string; timeoutMs?: number } = {}
): Promise<{ url: string; resolved: boolean; locked?: boolean; html?: string }> {
  const clean = sanitizeContestUrl(rawUrl.trim())
  if (!clean) return { url: rawUrl, resolved: false }

  const fromText = options.rssText ? extractFromText(options.rssText) : null
  if (fromText && fromText !== clean) {
    return { url: fromText, resolved: true }
  }
  if (isWidgetEntryUrl(clean) || !needsEntryResolution(clean)) {
    return { url: clean, resolved: false }
  }

  const timeoutMs = options.timeoutMs ?? 10_000
  try {
    const res = await fetchPublicUrl(clean, {
      method: 'GET',
      headers: FETCH_HEADERS,
      timeoutMs,
    })
    if (!res.ok) {
      await res.body?.cancel()
      return { url: clean, resolved: false }
    }
    const html = await readCapped(res, Date.now() + timeoutMs)
    if (isLoginWall(html)) {
      return { url: clean, resolved: false, locked: true, html }
    }
    const resolved = resolveFromHtml(html, clean)
    if (resolved !== clean) {
      return { url: resolved, resolved: true, html }
    }
    return { url: clean, resolved: false, html }
  } catch {
    return { url: clean, resolved: false }
  }
}

/** Lightweight resolver for ingest: text extract only (no HTML fetch). */
export function resolveContestEntryUrlFast(rawUrl: string, rssText: string): string {
  const clean = sanitizeContestUrl(rawUrl.trim())
  const fromText = extractFromText(rssText)
  if (fromText && fromText !== clean) return fromText
  return clean
}