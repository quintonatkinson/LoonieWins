/** Stable Hive Mind contest id: source slug + URL tail (no feed index). */

export function contestIdTail(link: string): string {
  const trimmed = link.trim()
  if (!trimmed) return 'unknown'
  try {
    const u = new URL(trimmed)
    const path = `${u.hostname.replace(/^www\./, '')}${u.pathname}${u.search}`
    const slug = path.toLowerCase().replace(/\/+$/, '')
    return slug.slice(-80).replace(/\W/g, '') || 'unknown'
  } catch {
    return trimmed.slice(-50).replace(/\W/g, '') || 'unknown'
  }
}

export function contestRowId(sourceId: string, link: string): string {
  return `${sourceId}-${contestIdTail(link)}`
}