/**
 * Requirement / cost badges for contest cards and detail sheets.
 * Surfaces purchase and other costly entry rules at a glance.
 */

import type { Contest } from '../rssFetcher'

export type RequirementBadgeKind =
  | 'purchase'
  | 'app'
  | 'creative'
  | 'social'
  | 'newsletter'
  | 'math'
  | 'age'
  | 'easy'

export interface RequirementBadge {
  kind: RequirementBadgeKind
  label: string
  /** Short icon / glyph for dense card UI */
  icon: string
  /** Emphasize costly / friction requirements */
  costly: boolean
}

const COSTLY_KINDS = new Set<RequirementBadgeKind>(['purchase', 'app', 'creative'])

function hasPurchase(contest: Contest): boolean {
  const reqs = contest.requirements ?? []
  const tags = contest.tags ?? []
  if (reqs.includes('Purchase Required')) return true
  if (tags.some((t) => /purchase/i.test(t))) return true
  return false
}

function hasReq(contest: Contest, req: string, tagHint: RegExp): boolean {
  if ((contest.requirements ?? []).includes(req)) return true
  if ((contest.tags ?? []).some((t) => tagHint.test(t))) return true
  return false
}

/** Ordered badges for display — purchase first when present. */
export function getRequirementBadges(contest: Contest): RequirementBadge[] {
  const badges: RequirementBadge[] = []

  if (hasPurchase(contest)) {
    badges.push({ kind: 'purchase', label: 'Purchase required', icon: '🧾', costly: true })
  }
  if (hasReq(contest, 'App Download', /app\s*download/i)) {
    badges.push({ kind: 'app', label: 'App download', icon: '📲', costly: true })
  }
  if (hasReq(contest, 'Creative Submission', /photo|creative|essay|video/i)) {
    badges.push({ kind: 'creative', label: 'Creative entry', icon: '📸', costly: true })
  }
  if (hasReq(contest, 'Social Action', /social|instagram|tiktok|follow/i)) {
    badges.push({ kind: 'social', label: 'Social follow', icon: '📱', costly: false })
  }
  if (hasReq(contest, 'Newsletter Signup', /newsletter/i)) {
    badges.push({ kind: 'newsletter', label: 'Newsletter', icon: '📧', costly: false })
  }
  if ((contest.tags ?? []).some((t) => /math/i.test(t))) {
    badges.push({ kind: 'math', label: 'Math / skill test', icon: '🧠', costly: false })
  }
  if ((contest.tags ?? []).some((t) => /\b18\+|\b21\+|age of majority/i.test(t))) {
    badges.push({ kind: 'age', label: '18+', icon: '🔞', costly: false })
  }

  if (badges.length === 0) {
    badges.push({ kind: 'easy', label: 'Easy entry', icon: '⚡', costly: false })
  }

  return badges
}

export function hasCostlyRequirement(contest: Contest): boolean {
  return getRequirementBadges(contest).some((b) => COSTLY_KINDS.has(b.kind) && b.costly)
}

/** Tailwind-ish class helpers for web cards */
export function badgeToneClass(badge: RequirementBadge): string {
  if (badge.kind === 'purchase') {
    return 'bg-amber-500/25 text-amber-300 border-amber-500/50'
  }
  if (badge.costly) {
    return 'bg-orange-500/20 text-orange-300 border-orange-500/40'
  }
  if (badge.kind === 'easy') {
    return 'bg-win/20 text-win border-win/40'
  }
  return 'bg-gray-600/50 text-gray-300 border-gray-500/50'
}
