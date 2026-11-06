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

export function isUrlReported(url: string): boolean {
  if (!url) return false
  return getReportedUrls().has(url.trim())
}

/**
 * Mark a URL as bad locally. Callers should also patch vault linkStatus
 * (markVaultLinkStatus) so enrichment-aware drops apply.
 */
export function reportUrl(url: string, _status: number = 410): void {
  if (!url || typeof url !== 'string') return
  const trimmed = url.trim()
  const set = getReportedUrls()
  set.add(trimmed)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('loonie_link_reported', {
        detail: { url: trimmed, status: _status },
      })
    )
  }
}
