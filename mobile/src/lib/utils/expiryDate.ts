/**
 * Expiry date helpers: normalize date-only strings to end-of-day EST.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const DATE_SPACE_TIME = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?)/

export function toExpiryEndOfDay(dateStr: string): Date {
  const s = dateStr.trim()
  if (!s) return new Date(NaN)

  if (DATE_ONLY.test(s) || (!/[T ]\d{2}:/.test(s) && !/T/.test(s))) {
    if (DATE_ONLY.test(s)) {
      return new Date(`${s}T23:59:59-05:00`)
    }
    const parsed = new Date(s)
    if (Number.isNaN(parsed.getTime())) return new Date(NaN)
    const y = parsed.getFullYear()
    const m = String(parsed.getMonth() + 1).padStart(2, '0')
    const d = String(parsed.getDate()).padStart(2, '0')
    return new Date(`${y}-${m}-${d}T23:59:59-05:00`)
  }

  const space = s.match(DATE_SPACE_TIME)
  if (space && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    const time = space[2].length === 5 ? `${space[2]}:00` : space[2]
    return new Date(`${space[1]}T${time}-05:00`)
  }

  return new Date(s)
}

export function getMillisUntilExpiry(dateStr: string): number {
  const end = toExpiryEndOfDay(dateStr)
  if (Number.isNaN(end.getTime())) return NaN
  return end.getTime() - Date.now()
}

export function getExpirySortKey(dateStr?: string | null): number {
  if (!dateStr?.trim()) return Number.POSITIVE_INFINITY
  const end = toExpiryEndOfDay(dateStr)
  if (Number.isNaN(end.getTime())) return Number.POSITIVE_INFINITY
  return end.getTime()
}

export function compareExpiryAscending(a?: string | null, b?: string | null): number {
  return getExpirySortKey(a) - getExpirySortKey(b)
}

export function daysLeftUntilExpiry(dateStr?: string | null): number | null {
  if (!dateStr?.trim()) return null
  const ms = getMillisUntilExpiry(dateStr)
  if (!Number.isFinite(ms)) return null
  if (ms <= 0) return 0
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}
