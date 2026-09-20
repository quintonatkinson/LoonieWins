import { storage } from './storage'

export type GeoFilterValue = 'CA' | 'US' | 'ANY'
export type HomeMode = 'routine' | 'browse'

const GEO_KEY = 'looniewins_geo_filter'
const QC_KEY = 'looniewins_quebec_safe'
const MODE_KEY = 'looniewins_home_mode'

const CA_PROVINCES =
  /\b(on|ontario|qc|quebec|québec|bc|british columbia|ab|alberta|mb|manitoba|sk|saskatchewan|ns|nova scotia|nb|new brunswick|nl|newfoundland|pe|pei|prince edward|nt|northwest|yt|yukon|nu|nunavut)\b/i

const US_HINT =
  /\b(al|ak|az|ar|ca|california|co|ct|de|fl|florida|ga|hi|ia|id|il|in|ks|ky|la|ma|md|me|mi|mn|mo|ms|mt|nc|nd|ne|nh|nj|nm|nv|ny|new york|oh|ok|or|pa|ri|sc|sd|tn|tx|texas|ut|va|vt|wa|washington|wi|wv|wy|usa|united states)\b/i

export function inferGeoFromProvince(province?: string | null): GeoFilterValue | null {
  if (!province?.trim()) return null
  const p = province.trim()
  if (CA_PROVINCES.test(p)) return 'CA'
  if (/^(ca|california)$/i.test(p)) return 'US'
  if (US_HINT.test(p)) return 'US'
  return null
}

export async function loadGeoFilter(fallback: GeoFilterValue = 'CA'): Promise<GeoFilterValue> {
  const raw = await storage.getItem(GEO_KEY)
  if (raw === 'CA' || raw === 'US' || raw === 'ANY') return raw
  return fallback
}

export async function saveGeoFilter(value: GeoFilterValue): Promise<void> {
  await storage.setItem(GEO_KEY, value)
}

export async function loadQuebecSafe(fallback = false): Promise<boolean> {
  const raw = await storage.getItem(QC_KEY)
  if (raw === '1' || raw === 'true') return true
  if (raw === '0' || raw === 'false') return false
  return fallback
}

export async function saveQuebecSafe(value: boolean): Promise<void> {
  await storage.setItem(QC_KEY, value ? '1' : '0')
}

export async function loadHomeMode(fallback: HomeMode = 'routine'): Promise<HomeMode> {
  const raw = await storage.getItem(MODE_KEY)
  if (raw === 'routine' || raw === 'browse') return raw
  return fallback
}

export async function saveHomeMode(value: HomeMode): Promise<void> {
  await storage.setItem(MODE_KEY, value)
}

export async function resolveInitialGeo(opts: {
  province?: string | null
  settingsGeo?: unknown
}): Promise<GeoFilterValue> {
  const saved = await storage.getItem(GEO_KEY)
  if (saved === 'CA' || saved === 'US' || saved === 'ANY') return saved
  if (opts.settingsGeo === 'CA' || opts.settingsGeo === 'US' || opts.settingsGeo === 'ANY') {
    return opts.settingsGeo
  }
  return inferGeoFromProvince(opts.province) ?? 'CA'
}
