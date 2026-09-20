/**
 * Human-friendly countdown copy from expiry ms (uses toExpiryEndOfDay via getMillisUntilExpiry).
 */

import { getMillisUntilExpiry, toExpiryEndOfDay } from './expiryDate'

const MS_1_HOUR = 60 * 60 * 1000
const MS_24_HOURS = 24 * 60 * 60 * 1000

export type CountdownUrgency = 'ended' | 'critical' | 'tonight' | 'soon' | 'days' | 'unknown'

export interface CountdownLabel {
  /** Primary short label e.g. "Ending tonight" / "3h left" / "4d left" */
  label: string
  /** Optional precise ticker e.g. "2h 14m 03s" for detail views */
  precise: string
  urgency: CountdownUrgency
  ms: number
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function preciseFromMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return Number.isFinite(ms) && ms <= 0 ? 'Ended' : '—'
  const sec = Math.floor((ms / 1000) % 60)
  const min = Math.floor((ms / (1000 * 60)) % 60)
  const hour = Math.floor((ms / (1000 * 60 * 60)) % 24)
  const day = Math.floor(ms / (1000 * 60 * 60 * 24))
  const parts: string[] = []
  if (day > 0) parts.push(`${day}d`)
  parts.push(`${hour}h`)
  parts.push(`${min}m`)
  parts.push(`${pad(sec)}s`)
  return parts.join(' ')
}

/** Same calendar day as expiry end (America/Toronto) → ending tonight. */
export function isEndingTonight(dateStr: string, now = new Date()): boolean {
  const end = toExpiryEndOfDay(dateStr)
  if (Number.isNaN(end.getTime())) return false
  const endDay = end.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
  const nowDay = now.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
  return endDay === nowDay && end.getTime() > now.getTime()
}

/** @deprecated use isEndingTonight */
function endsTonight(dateStr: string, now = new Date()): boolean {
  return isEndingTonight(dateStr, now)
}

export function getCountdownLabel(dateStr: string): CountdownLabel {
  const liveMs = getMillisUntilExpiry(dateStr)
  const precise = preciseFromMs(liveMs)

  if (!Number.isFinite(liveMs)) {
    return { label: 'Date unknown', precise: '—', urgency: 'unknown', ms: NaN }
  }
  if (liveMs <= 0) {
    return { label: 'Ended', precise: 'Ended', urgency: 'ended', ms: liveMs }
  }
  if (liveMs < MS_1_HOUR) {
    const min = Math.max(1, Math.ceil(liveMs / (1000 * 60)))
    return {
      label: min <= 1 ? 'Ending now' : `${min}m left`,
      precise,
      urgency: 'critical',
      ms: liveMs,
    }
  }
  if (endsTonight(dateStr)) {
    const hours = Math.ceil(liveMs / MS_1_HOUR)
    return {
      label: hours <= 1 ? 'Ending tonight' : `Ending tonight · ${hours}h`,
      precise,
      urgency: 'tonight',
      ms: liveMs,
    }
  }
  if (liveMs < MS_24_HOURS) {
    const hours = Math.ceil(liveMs / MS_1_HOUR)
    return {
      label: `${hours}h left`,
      precise,
      urgency: 'soon',
      ms: liveMs,
    }
  }
  const days = Math.ceil(liveMs / MS_24_HOURS)
  return {
    label: days === 1 ? '1 day left' : `${days}d left`,
    precise,
    urgency: 'days',
    ms: liveMs,
  }
}

export function countdownToneClass(urgency: CountdownUrgency): string {
  switch (urgency) {
    case 'ended':
      return 'text-red-500'
    case 'critical':
      return 'text-red-400'
    case 'tonight':
      return 'text-orange-400'
    case 'soon':
      return 'text-amber-400'
    case 'days':
      return 'text-gray-400'
    default:
      return 'text-gray-500'
  }
}
