/**
 * Persist feed UX prefs: geo filter, Quebec-safe, home mode, auto-advance.
 */

import type { GeoFilterValue } from '../../components/CountryToggle'

export type HomeMode = 'routine' | 'browse'

const GEO_KEY = 'looniewins_geo_filter'
const QC_KEY = 'looniewins_quebec_safe'
const MODE_KEY = 'looniewins_home_mode'
const AUTO_ADVANCE_KEY = 'looniewins_auto_advance'

/** QC province / territory hints → default Québec-safe on */
const QC_PROVINCE = /\b(qc|quebec|québec)\b/i

/** Canadian province/territory codes and common names → CA */
const CA_PROVINCES =
  /\b(on|ontario|qc|quebec|québec|bc|british columbia|ab|alberta|mb|manitoba|sk|saskatchewan|ns|nova scotia|nb|new brunswick|nl|newfoundland|pe|pei|prince edward|nt|northwest|yt|yukon|nu|nunavut)\b/i

/** US state codes / common names → US (subset + generic "state") */
const US_HINT =
  /\b(al|ak|az|ar|ca|california|co|ct|de|fl|florida|ga|hi|ia|id|il|in|ks|ky|la|ma|md|me|mi|mn|mo|ms|mt|nc|nd|ne|nh|nj|nm|nv|ny|new york|oh|ok|or|pa|ri|sc|sd|tn|tx|texas|ut|va|vt|wa|washington|wi|wv|wy|usa|united states)\b/i

export function inferGeoFromProvince(province?: string | null): GeoFilterValue | null {
  if (!province?.trim()) return null
  const p = province.trim()
  if (CA_PROVINCES.test(p)) return 'CA'
  // Ambiguous short codes like "CA" (California) — prefer profile settings when set
  if (/^(ca|california)$/i.test(p)) return 'US'
  if (US_HINT.test(p)) return 'US'
  return null
}

/** True when autofill province is Québec — default Québec-safe filters on. */
export function inferQuebecSafeFromProvince(province?: string | null): boolean {
  if (!province?.trim()) return false
  return QC_PROVINCE.test(province.trim())
}

export function loadGeoFilter(fallback: GeoFilterValue = 'CA'): GeoFilterValue {
  try {
    const raw = localStorage.getItem(GEO_KEY)
    if (raw === 'CA' || raw === 'US' || raw === 'ANY') return raw
  } catch {
    /* ignore */
  }
  return fallback
}

export function saveGeoFilter(value: GeoFilterValue): void {
  try {
    localStorage.setItem(GEO_KEY, value)
  } catch {
    /* ignore */
  }
}

export function loadQuebecSafe(fallback = false): boolean {
  try {
    const raw = localStorage.getItem(QC_KEY)
    if (raw === '1' || raw === 'true') return true
    if (raw === '0' || raw === 'false') return false
  } catch {
    /* ignore */
  }
  return fallback
}

export function saveQuebecSafe(value: boolean): void {
  try {
    localStorage.setItem(QC_KEY, value ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function loadHomeMode(fallback: HomeMode = 'routine'): HomeMode {
  try {
    const raw = localStorage.getItem(MODE_KEY)
    if (raw === 'routine' || raw === 'browse') return raw
  } catch {
    /* ignore */
  }
  return fallback
}

export function saveHomeMode(value: HomeMode): void {
  try {
    localStorage.setItem(MODE_KEY, value)
  } catch {
    /* ignore */
  }
}

/** Resolve initial geo: last saved → profile province → fallback CA */
export function resolveInitialGeo(opts: {
  province?: string | null
  settingsGeo?: unknown
}): GeoFilterValue {
  try {
    const raw = localStorage.getItem(GEO_KEY)
    if (raw === 'CA' || raw === 'US' || raw === 'ANY') return raw
  } catch {
    /* ignore */
  }
  if (opts.settingsGeo === 'CA' || opts.settingsGeo === 'US' || opts.settingsGeo === 'ANY') {
    return opts.settingsGeo
  }
  return inferGeoFromProvince(opts.province) ?? 'CA'
}

/**
 * Resolve Québec-safe: last saved → profiles.settings.quebecSafe → QC province → false.
 * Does not invent a localStorage key when unset (so province can still seed on first load).
 */
export function resolveInitialQuebecSafe(opts: {
  province?: string | null
  settingsQuebecSafe?: unknown
}): boolean {
  try {
    const raw = localStorage.getItem(QC_KEY)
    if (raw === '1' || raw === 'true') return true
    if (raw === '0' || raw === 'false') return false
  } catch {
    /* ignore */
  }
  if (opts.settingsQuebecSafe === true) return true
  if (opts.settingsQuebecSafe === false) return false
  return inferQuebecSafeFromProvince(opts.province)
}

export function loadAutoAdvance(fallback = true): boolean {
  try {
    const raw = localStorage.getItem(AUTO_ADVANCE_KEY)
    if (raw === '1' || raw === 'true') return true
    if (raw === '0' || raw === 'false') return false
  } catch {
    /* ignore */
  }
  return fallback
}

export function saveAutoAdvance(value: boolean): void {
  try {
    localStorage.setItem(AUTO_ADVANCE_KEY, value ? '1' : '0')
  } catch {
    /* ignore */
  }
}

/** True when the Québec-safe key was never written (first visit). */
export function hasSavedQuebecSafe(): boolean {
  try {
    return localStorage.getItem(QC_KEY) != null
  } catch {
    return false
  }
}
