/**
 * Dead / blocked contest URL detection for primary rails and Hive search.
 */

/**
 * Only statuses that prove the page is gone. 403 / 5xx come back from the CORS proxy when it
 * is rate-limited or the host blocks bots, so they must not hide (or persist as dead) a live contest.
 */
export const DEAD_LINK_STATUSES = [404, 410] as const

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
