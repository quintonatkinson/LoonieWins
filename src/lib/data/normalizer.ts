/**
 * Normalization pipeline: raw RSS/Atom item + source → clean Contest.
 */

import type { Source } from './sources'
import { SOURCE_FALLBACK_IMAGES } from './sources'
import { sanitizeContestUrl } from '../utils/sanitizeContestUrl'
import { autoCategorize, scanForMetadata } from './tagger'

export interface Contest {
  id: string
  title: string
  url: string
  imageUrl?: string
  prizeValue?: number
  expiryDate?: string // ISO
  is_estimated_expiry?: boolean
  category?: string
  source: string
  description?: string
  contentSnippet?: string
  isLocked?: boolean
  tags: string[]
  restrictions: string[]
  eligibility?: 'CA' | 'US' | 'NA' | 'Unknown'
  eligibilityUnverified?: boolean
  requirements?: string[]
  linkStatus?: number
}

export interface RawFeedItem {
  title: string
  link: string
  description?: string
  pubDate?: string
  enclosure?: string
  mediaContent?: string
  contentEncoded?: string
  content?: string
}

/** Item shape from rss2json.com API (Strategy A). */
export interface Rss2JsonItem {
  title: string
  link: string
  pubDate?: string
  description?: string
  content?: string
  thumbnail?: string
  enclosure?: { link?: string } | string
  guid?: string
  author?: string
  categories?: string[]
}

const TITLE_CLEAN_PATTERNS = [
  /\s*\[QC\/PEI Excluded\]\s*/gi,
  /\s*\(QC\/PEI Excluded\)\s*/gi,
  /\s*\(Daily\)\s*/gi,
  /\s*\[Daily\]\s*/gi,
]

function cleanTitle(title: string): string {
  let t = title
  for (const re of TITLE_CLEAN_PATTERNS) {
    t = t.replace(re, ' ')
  }
  return t.replace(/\s+/g, ' ').trim()
}

/**
 * Extract image: media:content, enclosure, og:image, then first <img> in content/description.
 * Reddit: main content in <content type="html"> (item.content). RFD: image inside <description>.
 */
function extractImage(item: RawFeedItem): string | undefined {
  if (item.mediaContent) return item.mediaContent
  if (item.enclosure) return item.enclosure
  const body = [item.contentEncoded ?? '', item.content ?? '', item.description ?? ''].join(' ')
  const ogMatch = body.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
  if (ogMatch?.[1]) return ogMatch[1]
  const imgMatch = body.match(/<img[^>]+src=["']([^"']+)["']/i)
  if (imgMatch?.[1]) return imgMatch[1]
  return undefined
}

function parseDate(value: string | undefined): string | undefined {
  if (!value) return undefined
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
}

/** Detect timezone in text near a match; assume EST for Canadian context if not found. */
function detectTimezone(text: string, matchIndex: number): string {
  const start = Math.max(0, matchIndex - 50)
  const end = Math.min(text.length, matchIndex + 100)
  const slice = text.slice(start, end)
  if (/\b(?:EST|EDT)\b/i.test(slice)) return ' EST'
  if (/\b(?:PST|PDT)\b/i.test(slice)) return ' PST'
  return ' EST' // default for Canadian contests
}

const DATE_PREFIX =
  '(?:draw date|draws on|entries accepted until|giveaway over on|ends?|closes?|expires?):'

/**
 * Extract expiry date from content/description text. Does not throw on invalid dates.
 * Handles Draw date, Entries accepted until, Giveaway over on, Ends/Closes/Expires.
 * Timezone: EST/EDT/PST/PDT detected in surrounding text, else assumes EST (Canadian).
 * If date cannot be parsed: returns { expiryDate: undefined, is_estimated_expiry: true }.
 * No guessing (e.g. posted_at + 30 days) — pipeline never drops contests with undefined expiry.
 */
function extractExpiryDate(
  contentText: string,
  _postedAtIso: string | undefined
): { expiryDate?: string; is_estimated_expiry: boolean } {
  const text = contentText.replace(/\s+/g, ' ').trim()
  const now = new Date()
  const currentYear = now.getFullYear()

  const tryParse = (
    d: Date | null
  ): { expiryDate: string; is_estimated_expiry: boolean } | null => {
    if (!d || Number.isNaN(d.getTime())) return null
    return { expiryDate: d.toISOString(), is_estimated_expiry: false }
  }

  try {
    // Month name + day: "Draw date: Jan 15" / "Draws on: March 20, 2025"
    const monthDayRe = new RegExp(
      `\\b${DATE_PREFIX}\\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\s+(\\d{1,2})(?:,?\\s*(\\d{4}))?`,
      'i'
    )
    const monthDay = text.match(monthDayRe)
    if (monthDay) {
      const monthStr = monthDay[2].toLowerCase().slice(0, 3)
      const month = MONTHS[monthStr] ?? MONTHS[monthStr + 'uary']
      const day = parseInt(monthDay[3], 10)
      const year = monthDay[4] ? parseInt(monthDay[4], 10) : currentYear
      if (month != null && day >= 1 && day <= 31) {
        const d = new Date(year, month, day)
        const result = tryParse(d)
        if (result) return result
      }
    }

    // ISO: "Draw date: 2024-01-15"
    const isoRe = new RegExp(`\\b${DATE_PREFIX}\\s*(\\d{4})-(\\d{2})-(\\d{2})`, 'i')
    const isoMatch = text.match(isoRe)
    if (isoMatch) {
      const d = new Date(
        parseInt(isoMatch[2], 10),
        parseInt(isoMatch[3], 10) - 1,
        parseInt(isoMatch[4], 10)
      )
      const result = tryParse(d)
      if (result) return result
    }

    // Slash: "Expires: 1/15" or "1/15/2024"
    const slashRe = new RegExp(
      `\\b${DATE_PREFIX}\\s*(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?`,
      'i'
    )
    const slashMatch = text.match(slashRe)
    if (slashMatch) {
      let year = parseInt(slashMatch[4], 10) || currentYear
      if (year < 100) year += year < 50 ? 2000 : 1900
      const month = parseInt(slashMatch[2], 10) - 1
      const day = parseInt(slashMatch[3], 10)
      if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        const d = new Date(year, month, day)
        const result = tryParse(d)
        if (result) return result
      }
    }

    // Timezone-aware: build date string and append TZ, try parsing
    const tzMatch = text.match(
      /\b(draw date|draws on|entries accepted until|giveaway over on|ends?|closes?|expires?):\s*([^.;\n]{10,60})/i
    )
    if (tzMatch) {
      const tz = detectTimezone(text, tzMatch.index ?? 0)
      const dateStr = tzMatch[2].trim() + tz
      const d = new Date(dateStr)
      const result = tryParse(d)
      if (result) return result
    }
  } catch (_) {
    // invalid date handling: fall through to no-guess result
  }

  // Do NOT guess. Pipeline keeps contests with undefined expiry; only drops when date is proven past.
  return { expiryDate: undefined, is_estimated_expiry: true }
}

function parseDollarAmount(match: RegExpMatchArray, groupIndex?: number): number | undefined {
  const s = groupIndex != null ? match[groupIndex] : match[0]
  if (!s) return undefined
  const num = parseFloat(s.replace(/[$,]/g, ''))
  return Number.isNaN(num) ? undefined : num
}

const PRIZE_KEYWORDS: { pattern: RegExp; value: number }[] = [
  { pattern: /\b(?:trip|vacation)\b/i, value: 2500 },
  { pattern: /\b(?:car|vehicle)\b/i, value: 30000 },
  { pattern: /\b(?:laptop|macbook)\b/i, value: 1500 },
  { pattern: /\b(?:console|ps5|xbox)\b/i, value: 600 },
]

function extractPrizeValue(text: string): number | undefined {
  try {
    const arvMatch = text.match(/\b(?:ARV|A\.R\.V\.?)\s*[$]?\s*([\d,]+(?:\.[\d]{2})?)/i)
    if (arvMatch) {
      const n = parseDollarAmount(arvMatch, 1)
      if (n != null) return n
    }
    const worthMatch = text.match(/\b(?:valued at|worth|prize worth)\s*[$]?\s*([\d,]+(?:\.[\d]{2})?)/i)
    if (worthMatch) {
      const n = parseDollarAmount(worthMatch, 1)
      if (n != null) return n
    }
    const dollarMatch = text.match(/\$[\d,]+(?:\.[\d]{2})?|\d+\s*(?:CAD|USD)/i)
    if (dollarMatch) {
      const n = parseDollarAmount(dollarMatch)
      if (n != null) return n
    }
    for (const { pattern, value } of PRIZE_KEYWORDS) {
      if (pattern.test(text)) return value
    }
  } catch (_) {
    // fall through
  }
  return undefined
}

/**
 * Image from rss2json item: thumbnail, enclosure, then first <img> in body.
 */
function extractImageFromJsonItem(item: Rss2JsonItem, body: string): string | undefined {
  if (item.thumbnail) return item.thumbnail
  if (item.enclosure) {
    const enc = item.enclosure
    const url = typeof enc === 'string' ? enc : (enc as { link?: string }).link
    if (url) return url
  }
  const imgMatch = body.match(/<img[^>]+src=["']([^"']+)["']/i)
  return imgMatch?.[1]
}

/**
 * Normalize an item from rss2json (Strategy A) into a Contest.
 */
/** Prefer text-scanned eligibility; fall back to the feed's declared country. */
function resolveEligibility(
  scanned: ReturnType<typeof scanForMetadata>,
  source: Source
): Pick<Contest, 'eligibility' | 'eligibilityUnverified'> {
  if (scanned.eligibility !== 'Unknown') {
    return {
      eligibility: scanned.eligibility,
      eligibilityUnverified: scanned.eligibilityUnverified,
    }
  }
  if (source.country === 'CA' || source.country === 'US') {
    return { eligibility: source.country, eligibilityUnverified: true }
  }
  return { eligibility: 'Unknown', eligibilityUnverified: true }
}

function mergeUnique(base: string[], extras?: string[]): string[] {
  if (!extras?.length) return base
  const out = [...base]
  for (const x of extras) {
    if (!out.includes(x)) out.push(x)
  }
  return out
}

function applySourceDefaults(
  tags: string[],
  requirements: string[],
  source: Source
): { tags: string[]; requirements: string[] } {
  return {
    tags: mergeUnique(tags, source.defaultTags),
    requirements: mergeUnique(requirements, source.defaultRequirements),
  }
}

export function normalizeJsonItem(item: Rss2JsonItem, source: Source, index: number): Contest {
  const title = cleanTitle(item.title)
  const body = [item.description ?? '', item.content ?? ''].join(' ')
  const categorized = autoCategorize(item.title, body)
  const scanned = scanForMetadata(item.title, body)
  const { eligibility, eligibilityUnverified } = resolveEligibility(scanned, source)
  const { tags, requirements } = applySourceDefaults(
    categorized.tags,
    scanned.requirements,
    source
  )

  const imageUrl =
    extractImageFromJsonItem(item, body) ?? SOURCE_FALLBACK_IMAGES[source.id]

  const id = `${source.id}-${index}-${item.link.slice(-50).replace(/\W/g, '')}`

  const postedAtIso = parseDate(item.pubDate)
  const { expiryDate, is_estimated_expiry } = extractExpiryDate(body, postedAtIso)

  return {
    id,
    title,
    url: sanitizeContestUrl(item.link),
    imageUrl,
    prizeValue: extractPrizeValue(item.title + ' ' + body),
    expiryDate,
    is_estimated_expiry,
    category: undefined,
    source: source.name,
    description: item.description,
    contentSnippet: body,
    tags,
    restrictions: categorized.restrictions,
    eligibility,
    eligibilityUnverified,
    requirements,
  }
}

/**
 * Turn a raw XML feed item and its source into a normalized Contest (Strategy B).
 * Applies title cleaning, image extraction, date parsing, and auto-categorization.
 */
export function normalizeXmlItem(item: RawFeedItem, source: Source, index: number): Contest {
  const title = cleanTitle(item.title)
  const body = [item.description ?? '', item.contentEncoded ?? '', item.content ?? ''].join(' ')
  const categorized = autoCategorize(item.title, body)
  const scanned = scanForMetadata(item.title, body)
  const { eligibility, eligibilityUnverified } = resolveEligibility(scanned, source)
  const { tags, requirements } = applySourceDefaults(
    categorized.tags,
    scanned.requirements,
    source
  )

  const imageUrl =
    extractImage(item) ?? SOURCE_FALLBACK_IMAGES[source.id]

  const id = `${source.id}-${index}-${item.link.slice(-50).replace(/\W/g, '')}`

  const postedAtIso = parseDate(item.pubDate)
  const { expiryDate, is_estimated_expiry } = extractExpiryDate(body, postedAtIso)

  return {
    id,
    title,
    url: sanitizeContestUrl(item.link),
    imageUrl,
    prizeValue: extractPrizeValue(item.title + ' ' + body),
    expiryDate,
    is_estimated_expiry,
    category: undefined,
    source: source.name,
    description: item.description,
    contentSnippet: body,
    tags,
    restrictions: categorized.restrictions,
    eligibility,
    eligibilityUnverified,
    requirements,
  }
}
