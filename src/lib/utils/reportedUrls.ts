const STORAGE_KEY = 'looniewins_reported_urls'

export function getReportedUrls(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((u): u is string => typeof u === 'string'))
  } catch {
    return new Set()
  }
}

export function reportUrl(url: string): void {
  if (!url || typeof url !== 'string') return
  const set = getReportedUrls()
  set.add(url.trim())
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
  } catch (_) {
    /* ignore */
  }
}
