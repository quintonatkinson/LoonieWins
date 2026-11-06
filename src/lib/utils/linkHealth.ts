/**
 * Dead / blocked contest URL detection for primary rails and Hive search.
 */

export const DEAD_LINK_STATUSES = [403, 404, 410, 500, 502, 503] as const

export type DeadLinkStatus = (typeof DEAD_LINK_STATUSES)[number]

export function isDeadLinkStatus(status?: number | null): boolean {
  if (status == null) return false
  return (DEAD_LINK_STATUSES as readonly number[]).includes(status)
}

export function isDeadLink(contest: { linkStatus?: number | null }): boolean {
  return isDeadLinkStatus(contest.linkStatus)
}

/** Human label for buried / history-only rows */
export function deadLinkLabel(status?: number | null): string {
  if (status === 404 || status === 410) return 'Link expired'
  if (status === 403) return 'Link blocked'
  if (status != null && status >= 500) return 'Link unavailable'
  return 'Link unavailable'
}

/** Relative “last checked” copy for Hive Mind trust hints. */
export function formatLinkCheckedAgo(
  iso?: string | null,
  now = Date.now()
): string | null {
  if (!iso?.trim()) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  const ago = Math.max(0, now - t)
  const min = Math.floor(ago / 60_000)
  if (min < 1) return 'Checked just now'
  if (min < 60) return `Checked ${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 48) return `Checked ${hr}h ago`
  const day = Math.floor(hr / 24)
  return `Checked ${day}d ago`
}

/**
 * Compact trust line for cards: dead status + last checked, or healthy check only.
 * Returns null when nothing useful is known.
 */
export function linkHealthHint(contest: {
  linkStatus?: number | null
  linkCheckedAt?: string | null
}): string | null {
  const checked = formatLinkCheckedAgo(contest.linkCheckedAt)
  if (isDeadLink(contest)) {
    const dead = deadLinkLabel(contest.linkStatus)
    return checked ? `${dead} · ${checked}` : dead
  }
  if (contest.linkStatus != null && contest.linkStatus >= 200 && contest.linkStatus < 400) {
    return checked ? `Link OK · ${checked}` : 'Link OK'
  }
  return checked
}

const PROBE_PROXY = 'https://corsproxy.io/?'

/**
 * Lightweight client recheck via corsproxy (same path as ingest enrichment).
 * Returns HTTP status when known; null on network / parse failure.
 */
export async function probeContestUrl(
  url: string,
  timeoutMs = 8000
): Promise<number | null> {
  if (!url?.trim()) return null
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const t =
    ctrl &&
    setTimeout(() => {
      try {
        ctrl.abort()
      } catch {
        /* ignore */
      }
    }, timeoutMs)
  try {
    const res = await fetch(PROBE_PROXY + encodeURIComponent(url.trim()), {
      method: 'GET',
      signal: ctrl?.signal,
    })
    return res.status
  } catch {
    return null
  } finally {
    if (t) clearTimeout(t)
  }
}
