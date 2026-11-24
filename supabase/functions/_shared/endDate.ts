/**
 * Contest end-date extraction from page text / titles.
 * Only dates with an explicit year are trusted; "ends 3/31" or "closes Thursday,
 * November 19th" are ambiguous across a year boundary and return null.
 */

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
}

const MONTH = '(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\\.?'
const ORD = '(?:st|nd|rd|th)?'
const DATE_ALTS = [
  `${MONTH}\\s+(\\d{1,2})${ORD},?\\s+(\\d{4})`, // December 31, 2026
  `(\\d{1,2})${ORD}\\s+${MONTH},?\\s+(\\d{4})`, // 15 December 2026
  '(\\d{1,2})/(\\d{1,2})/(\\d{4}|\\d{2})(?!\\d)', // 12/31/2026 (US order)
  '(\\d{4})-(\\d{2})-(\\d{2})', // 2026-12-31
]
const END_CUE =
  '(?:end(?:s|ing)?(?:\\s+date)?|closes?|closing(?:\\s+date)?|deadline|expires?|expiration(?:\\s+date)?|enter\\s+by|giveaway\\s+(?:ends|over)|contest\\s+(?:ends|closes)|entries\\s+(?:must\\s+be\\s+received|accepted)\\s+(?:by|until)|until)'
// Cue, then up to 60 chars without sentence breaks (times, "on", weekday names), then a date.
const CUE_RE = new RegExp(`\\b${END_CUE}\\b[:\\s]*([^.!?<>\\n]{0,60}?)(?:${DATE_ALTS.join('|')})`, 'gi')
const RFD_TITLE_RE = /^\s*(?:\[[^\]]*\]\s*)?(\d{4})\/(\d{2})\/(\d{2})\b/

function build(year: number, month: number, day: number): Date | null {
  if (year < 100) year += 2000
  if (!(month >= 0 && month <= 11) || day < 1) return null
  const probe = new Date(Date.UTC(year, month, day))
  if (probe.getUTCMonth() !== month) return null
  // End of day, Eastern (EST offset; DST drift of an hour is irrelevant here).
  return new Date(Date.UTC(year, month, day, 23 + 5, 59, 59))
}

function plausible(d: Date | null, now: Date): d is Date {
  if (!d) return false
  const years = (d.getTime() - now.getTime()) / (365 * 864e5)
  return years > -3 && years < 3
}

function fromMatch(m: RegExpExecArray): Date | null {
  const g = m.slice(2)
  if (g[0] && g[1] && g[2]) return build(+g[2], MONTHS[g[0].toLowerCase().slice(0, 3)], +g[1])
  if (g[3] && g[4] && g[5]) return build(+g[5], MONTHS[g[4].toLowerCase().slice(0, 3)], +g[3])
  if (g[6] && g[7] && g[8]) return build(+g[8], +g[6] - 1, +g[7])
  if (g[9] && g[10] && g[11]) return build(+g[9], +g[10] - 1, +g[11])
  return null
}

/** First explicit-year end date mentioned in `text`, as an ISO string. */
export function extractEndDate(text: string, now = new Date()): string | null {
  const flat = text.replace(/\s+/g, ' ')
  CUE_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = CUE_RE.exec(flat))) {
    const d = fromMatch(m)
    if (plausible(d, now)) return d.toISOString()
  }
  return null
}

/** RedFlagDeals-style titles: "[Daily] 2026/11/30 Brand Contest". */
export function extractTitleEndDate(title: string, now = new Date()): string | null {
  const m = title.match(RFD_TITLE_RE)
  if (!m) return null
  const d = build(+m[1], +m[2] - 1, +m[3])
  return plausible(d, now) ? d.toISOString() : null
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
    .replace(/\s+/g, ' ')
}
