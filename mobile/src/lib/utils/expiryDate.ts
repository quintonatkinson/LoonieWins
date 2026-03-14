/**
 * Expiry date helpers: normalize date-only strings to end-of-day EST.
 */

export function toExpiryEndOfDay(dateStr: string): Date {
  const s = dateStr.trim()
  if (!s) return new Date(NaN)
  if (!/T/.test(s)) {
    return new Date(s + 'T23:59:59-05:00')
  }
  return new Date(s)
}

export function getMillisUntilExpiry(dateStr: string): number {
  const end = toExpiryEndOfDay(dateStr)
  if (Number.isNaN(end.getTime())) return 0
  return end.getTime() - Date.now()
}
