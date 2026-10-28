/** Quiet-hours helpers for push prefs (America/Toronto wall clock). */

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/

export function normalizeQuietTime(raw: unknown, fallback: string): string {
  if (typeof raw === 'string' && TIME_RE.test(raw.trim())) {
    const [h, m] = raw.trim().split(':')
    return `${h.padStart(2, '0')}:${m}`
  }
  return fallback
}

/** Minutes since midnight for HH:mm */
export function quietTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((n) => Number(n))
  return h * 60 + m
}

/** Current HH:mm in America/Toronto */
export function torontoWallClock(now = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(now)
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00'
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00'
  // en-CA can yield "24" for midnight in some engines — normalize
  const hNum = Number(hour) % 24
  return `${String(hNum).padStart(2, '0')}:${minute.padStart(2, '0')}`
}

/**
 * True when `now` falls in [start, end) on the Toronto clock.
 * Supports windows that wrap midnight (e.g. 22:00 → 07:00).
 */
export function isInQuietHours(
  opts: { enabled: boolean; start: string; end: string },
  now = new Date()
): boolean {
  if (!opts.enabled) return false
  const start = quietTimeToMinutes(normalizeQuietTime(opts.start, '22:00'))
  const end = quietTimeToMinutes(normalizeQuietTime(opts.end, '07:00'))
  if (start === end) return false
  const cur = quietTimeToMinutes(torontoWallClock(now))
  if (start < end) return cur >= start && cur < end
  return cur >= start || cur < end
}
