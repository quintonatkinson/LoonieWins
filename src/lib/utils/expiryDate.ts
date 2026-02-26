/**
 * Expiry date helpers: normalize date-only strings to end-of-day EST.
 * If contest says "Ends Jan 1", assume Jan 1 11:59 PM EST.
 */

/**
 * Parse expiry date. If date-only (no T), treat as end-of-day EST (11:59 PM).
 * Full ISO with time is used as-is.
 */
export function toExpiryEndOfDay(dateStr: string): Date {
  const s = dateStr.trim()
  if (!s) return new Date(NaN)
  if (!/T/.test(s)) {
    return new Date(s + 'T23:59:59-05:00')
  }
  return new Date(s)
}

/**
 * Milliseconds until expiry. Negative if already expired.
 */
export function getMillisUntilExpiry(dateStr: string): number {
  const end = toExpiryEndOfDay(dateStr)
  if (Number.isNaN(end.getTime())) return 0
  return end.getTime() - Date.now()
}
