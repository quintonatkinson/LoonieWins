export function sanitizeContestUrl(url: string): string {
  if (!url || typeof url !== 'string') return url
  let u = url.trim()
  // Strip common feed path suffixes - never send users to RSS/XML
  const feedSuffixes = [
    /\/feed\/?$/i,
    /\/rss\/?$/i,
    /\/atom\/?$/i,
    /\/atom\.xml\/?$/i,
  ]
  for (const re of feedSuffixes) {
    u = u.replace(re, '')
  }
  return u.replace(/\/$/, '') || u
}

/** The URL only when it is http(s); blocks javascript:, data: and other schemes in user-supplied links. */
export function safeHttpUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  try {
    const u = new URL(url.trim())
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : undefined
  } catch {
    return undefined
  }
}

/** window.open for external links, refusing non-http(s) URLs. */
export function openExternalUrl(url: string | null | undefined): Window | null {
  const safe = safeHttpUrl(url)
  return safe ? window.open(safe, '_blank', 'noopener,noreferrer') : null
}
