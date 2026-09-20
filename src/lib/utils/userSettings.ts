/**
 * Feed / display preferences under profiles.settings + localStorage.
 * Keeps accentTheme / notifications untouched via shallow merge helpers.
 */

export type CardDensity = 'comfortable' | 'compact'
export type SortDefault = 'high-value' | 'ending-soon' | 'best-odds' | 'most-popular'
export type OpenContestsIn = 'webview' | 'browser'

export interface FeedDisplayPrefs {
  /** Exclude purchase-required contests from Home / feed */
  hidePurchaseRequired: boolean
  /** Exclude 18+ / age-gated contests from Home / feed */
  hideAdult: boolean
  /** Always re-confirm age gate for 18+ (even after prior confirm) */
  adultAlwaysConfirm: boolean
  cardDensity: CardDensity
  sortDefault: SortDefault
  /** Mobile / Capacitor: in-app WebView vs system browser */
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

/** Parse display prefs from profiles.settings (and optional local overlay). */
export function parseFeedDisplayPrefs(
  settings: Record<string, unknown> | null | undefined
): FeedDisplayPrefs {
  const local = loadFeedDisplayPrefsLocal()
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

/** Prefer localStorage when set, else settings, else defaults. */
export function resolveFeedDisplayPrefs(opts: {
  settings?: Record<string, unknown> | null
}): FeedDisplayPrefs {
  const local = loadFeedDisplayPrefsLocal()
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
  const current = parseFeedDisplayPrefs(settings)
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

export function loadFeedDisplayPrefsLocal(): Partial<FeedDisplayPrefs> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
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
  } catch {
    return null
  }
}

export function saveFeedDisplayPrefsLocal(patch: Partial<FeedDisplayPrefs>): void {
  try {
    const prev = loadFeedDisplayPrefsLocal() ?? {}
    const next = { ...prev, ...patch }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
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
