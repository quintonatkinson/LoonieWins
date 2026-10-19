/**
 * 18+ age confirmation — local + optional profiles.settings.ageConfirmed.
 * No DOB collected; one-time confirm before entering tagged contests.
 */

const AGE_KEY = 'looniewins_age_confirmed'

export function contestRequiresAgeGate(contest: {
  tags?: string[] | null
}): boolean {
  return (contest.tags ?? []).some((t) => /\b18\+|\b21\+|age of majority/i.test(t))
}

export function loadAgeConfirmed(fallback = false): boolean {
  try {
    const raw = localStorage.getItem(AGE_KEY)
    if (raw === '1' || raw === 'true') return true
    if (raw === '0' || raw === 'false') return false
  } catch {
    /* ignore */
  }
  return fallback
}

export function saveAgeConfirmed(value: boolean): void {
  try {
    localStorage.setItem(AGE_KEY, value ? '1' : '0')
  } catch {
    /* ignore */
  }
}

/** Resolve: localStorage → profile settings → false */
export function resolveAgeConfirmed(opts: {
  settingsAgeConfirmed?: unknown
}): boolean {
  try {
    const raw = localStorage.getItem(AGE_KEY)
    if (raw === '1' || raw === 'true') return true
    if (raw === '0' || raw === 'false') return false
  } catch {
    /* ignore */
  }
  if (opts.settingsAgeConfirmed === true) return true
  return false
}
