/**
 * 18+ age confirmation — AsyncStorage + optional profiles.settings.ageConfirmed.
 */

import { storage } from './storage'

const AGE_KEY = 'looniewins_age_confirmed'

export function contestRequiresAgeGate(contest: {
  tags?: string[] | null
}): boolean {
  return (contest.tags ?? []).some((t) => /\b18\+|\b21\+|age of majority/i.test(t))
}

export async function loadAgeConfirmed(fallback = false): Promise<boolean> {
  const raw = await storage.getItem(AGE_KEY)
  if (raw === '1' || raw === 'true') return true
  if (raw === '0' || raw === 'false') return false
  return fallback
}

export async function saveAgeConfirmed(value: boolean): Promise<void> {
  await storage.setItem(AGE_KEY, value ? '1' : '0')
}

export async function resolveAgeConfirmed(opts: {
  settingsAgeConfirmed?: unknown
}): Promise<boolean> {
  const raw = await storage.getItem(AGE_KEY)
  if (raw === '1' || raw === 'true') return true
  if (raw === '0' || raw === 'false') return false
  if (opts.settingsAgeConfirmed === true) return true
  return false
}
