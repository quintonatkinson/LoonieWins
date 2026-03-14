/**
 * Valuation Dictionary: Smart lookup for prize value when RSS and Deep Scrape fail.
 */

const DICT: { pattern: RegExp; value: number }[] = [
  { pattern: /\b(?:tesla|model\s*[3sy])\b/i, value: 60000 },
  { pattern: /\b(?:peloton)\b/i, value: 2000 },
  { pattern: /\b(?:macbook)\b/i, value: 1800 },
  { pattern: /\b(?:iphone)\b/i, value: 1200 },
  { pattern: /\b(?:cruise)\b/i, value: 4000 },
  { pattern: /\b(?:trip|vacation|getaway)\b/i, value: 3000 },
  { pattern: /\b(?:ps5|playstation)\b/i, value: 650 },
  { pattern: /\b(?:xbox)\b/i, value: 600 },
  { pattern: /\b(?:ipad)\b/i, value: 600 },
  { pattern: /\b(?:switch|nintendo)\b/i, value: 450 },
  { pattern: /\b(?:concert|tickets)\b/i, value: 300 },
  { pattern: /\b(?:gift\s*card)\b/i, value: 100 },
]

export function estimatePrizeValue(title: string, description?: string): number | undefined {
  const text = [title, description ?? ''].join(' ').trim()
  if (!text) return undefined
  for (const { pattern, value } of DICT) {
    if (pattern.test(text)) return value
  }
  return undefined
}
