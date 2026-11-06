/**
 * Feed / display preferences under profiles.settings + AsyncStorage.
 * Mirrors web src/lib/utils/userSettings.ts
 */

import { storage } from './storage'

export type CardDensity = 'comfortable' | 'compact'
export type SortDefault = 'high-value' | 'ending-soon' | 'best-odds' | 'most-popular'
export type OpenContestsIn = 'webview' | 'browser'

export interface FeedDisplayPrefs {
  hidePurchaseRequired: boolean
  hideAdult: boolean
  adultAlwaysConfirm: boolean
  cardDensity: CardDensity
  sortDefault: SortDefault
  openContestsIn: OpenContestsIn
}

export const DEFAULT_FEED_DISPLAY_PREFS: FeedDisplayPrefs = {
  hidePurchaseRequired: false,
  hideAdult: false,
  adultAlwaysConfirm: false,
  cardDensity: 'comfortable',
  sortDefault: 'ending-soon',
  openContestsIn: 'webview',
}

const STORAGE_KEY = 'looniewins_display_prefs'

const SORT_VALUES: SortDefault[] = ['high-value', 'ending-soon', 'best-odds', 'most-popular']

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback
}

function asCardDensity(v: unknown): CardDensity {
  return v === 'compact' ? 'compact' : 'comfortable'
}

function asSortDefault(v: unknown): SortDefault {
  return SORT_VALUES.includes(v as SortDefault) ? (v as SortDefault) : 'ending-soon'
}

function asOpenContestsIn(v: unknown): OpenContestsIn {
  return v === 'browser' ? 'browser' : 'webview'
}

function sanitizePartial(parsed: Record<string, unknown>): Partial<FeedDisplayPrefs> {
  return {
    hidePurchaseRequired:
      typeof parsed.hidePurchaseRequired === 'boolean' ? parsed.hidePurchaseRequired : undefined,
    hideAdult: typeof parsed.hideAdult === 'boolean' ? parsed.hideAdult : undefined,
    adultAlwaysConfirm:
      typeof parsed.adultAlwaysConfirm === 'boolean' ? parsed.adultAlwaysConfirm : undefined,
    cardDensity:
      parsed.cardDensity === 'compact' || parsed.cardDensity === 'comfortable'
        ? parsed.cardDensity
        : undefined,
    sortDefault: SORT_VALUES.includes(parsed.sortDefault as SortDefault)
      ? (parsed.sortDefault as SortDefault)
      : undefined,
    openContestsIn:
      parsed.openContestsIn === 'browser' || parsed.openContestsIn === 'webview'
        ? parsed.openContestsIn
        : undefined,
  }
}

export function parseFeedDisplayPrefs(
  settings: Record<string, unknown> | null | undefined,
  local?: Partial<FeedDisplayPrefs> | null
): FeedDisplayPrefs {
  return {
    hidePurchaseRequired: asBool(
      settings?.hidePurchaseRequired ?? local?.hidePurchaseRequired,
      DEFAULT_FEED_DISPLAY_PREFS.hidePurchaseRequired
    ),
    hideAdult: asBool(
      settings?.hideAdult ?? local?.hideAdult,
      DEFAULT_FEED_DISPLAY_PREFS.hideAdult
    ),
    adultAlwaysConfirm: asBool(
      settings?.adultAlwaysConfirm ?? local?.adultAlwaysConfirm,
      DEFAULT_FEED_DISPLAY_PREFS.adultAlwaysConfirm
    ),
    cardDensity: asCardDensity(settings?.cardDensity ?? local?.cardDensity),
    sortDefault: asSortDefault(settings?.sortDefault ?? local?.sortDefault),
    openContestsIn: asOpenContestsIn(settings?.openContestsIn ?? local?.openContestsIn),
  }
}

export async function loadFeedDisplayPrefsLocal(): Promise<Partial<FeedDisplayPrefs> | null> {
  try {
    const raw = await storage.getItem(STORAGE_KEY)
    if (!raw) return null
    return sanitizePartial(JSON.parse(raw) as Record<string, unknown>)
  } catch {
    return null
  }
}

export async function saveFeedDisplayPrefsLocal(patch: Partial<FeedDisplayPrefs>): Promise<void> {
  const prev = (await loadFeedDisplayPrefsLocal()) ?? {}
  await storage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, ...patch }))
}

export async function resolveFeedDisplayPrefs(opts: {
  settings?: Record<string, unknown> | null
}): Promise<FeedDisplayPrefs> {
  const local = await loadFeedDisplayPrefsLocal()
  const s = opts.settings ?? {}
  return {
    hidePurchaseRequired: asBool(
      local?.hidePurchaseRequired ?? s.hidePurchaseRequired,
      DEFAULT_FEED_DISPLAY_PREFS.hidePurchaseRequired
    ),
    hideAdult: asBool(local?.hideAdult ?? s.hideAdult, DEFAULT_FEED_DISPLAY_PREFS.hideAdult),
    adultAlwaysConfirm: asBool(
      local?.adultAlwaysConfirm ?? s.adultAlwaysConfirm,
      DEFAULT_FEED_DISPLAY_PREFS.adultAlwaysConfirm
    ),
    cardDensity: asCardDensity(local?.cardDensity ?? s.cardDensity),
    sortDefault: asSortDefault(local?.sortDefault ?? s.sortDefault),
    openContestsIn: asOpenContestsIn(local?.openContestsIn ?? s.openContestsIn),
  }
}

export function withFeedDisplayPrefs(
  settings: Record<string, unknown> | null | undefined,
  patch: Partial<FeedDisplayPrefs>
): Record<string, unknown> {
  const current = parseFeedDisplayPrefs(settings, null)
  const next = { ...current, ...patch }
  return {
    ...(settings ?? {}),
    hidePurchaseRequired: next.hidePurchaseRequired,
    hideAdult: next.hideAdult,
    adultAlwaysConfirm: next.adultAlwaysConfirm,
    cardDensity: next.cardDensity,
    sortDefault: next.sortDefault,
    openContestsIn: next.openContestsIn,
  }
}

export function isPurchaseRequiredContest(c: {
  requirements?: string[] | null
  tags?: string[] | null
}): boolean {
  const reqs = c.requirements ?? []
  const tags = c.tags ?? []
  if (reqs.includes('Purchase Required')) return true
  return tags.some((t) => /purchase/i.test(t))
}

export function isAdultContest(c: { tags?: string[] | null }): boolean {
  return (c.tags ?? []).some((t) => /\b18\+|\b21\+|age of majority/i.test(t))
}

export const SORT_DEFAULT_OPTIONS: { key: SortDefault; label: string }[] = [
  { key: 'ending-soon', label: 'Ending soon' },
  { key: 'high-value', label: 'High value' },
  { key: 'most-popular', label: 'Most popular' },
  { key: 'best-odds', label: 'Best odds' },
]
