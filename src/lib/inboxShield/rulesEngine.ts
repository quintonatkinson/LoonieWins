/**
 * Client-side rules stub for Inbox Shield (Phase 1).
 * When Gmail OAuth is connected (Phase 2), these rules map to labels/filters.
 */

import type { InboxShieldMailItem, InboxShieldTab } from './types'

const SPAM_HINTS =
  /\b(viagra|casino|crypto lottery|nigerian|wire transfer|you have won \$1,?000,?000)\b/i
const PROMO_HINTS =
  /\b(newsletter|unsubscribe|sale|%\s*off|promo|deal|marketing|subscribe|daily digest)\b/i
const WIN_HINTS =
  /\b(winner|you won|congratulations|claim your prize|confirmation|entry received|selected)\b/i

/** Classify a message by subject + sender (stub — no Gmail read in Phase 1). */
export function classifyMessage(from: string, subject: string, preview: string): InboxShieldTab {
  const blob = `${from} ${subject} ${preview}`.toLowerCase()
  if (SPAM_HINTS.test(blob)) return 'spam'
  if (WIN_HINTS.test(blob)) return 'primary'
  if (PROMO_HINTS.test(blob)) return 'promotions'
  if (/\b(giveaway|sweepstakes|contest|gleam|rafflecopter)\b/i.test(blob)) return 'promotions'
  return 'primary'
}

/** Planned Gmail filter rules (documented + used in UI copy). */
export const PLANNED_GMAIL_RULES = [
  {
    id: 'lw-promotions-skip-inbox',
    label: 'LoonieWins/Promotions',
    description:
      'Newsletters & promo mail from brands you enter — skip Primary inbox, visible in Promotions tab.',
    gmailAction: 'Apply label + Skip Inbox (when connected)',
  },
  {
    id: 'lw-wins-star',
    label: 'LoonieWins/Wins',
    description: 'Subject contains “winner”, “congratulations”, or “confirmation” — never miss a win.',
    gmailAction: 'Star + label Primary wins (when connected)',
  },
  {
    id: 'lw-spam-review',
    label: 'Likely spam quarantine',
    description: 'Obvious spam patterns — review separately so real wins in Spam are surfaced.',
    gmailAction: 'Label + optional move from Spam after review (Phase 2)',
  },
] as const

export function placeholderInboxItems(_entryEmail?: string): InboxShieldMailItem[] {
  const samples = [
    {
      from: 'prizes@brand-contest.ca',
      subject: 'Entry received — Home Depot gift card draw',
      preview: 'Thanks for entering. Winners notified by email.',
    },
    {
      from: 'news@summergiveaway.com',
      subject: '20% off partner brands + new sweeps inside',
      preview: 'Unsubscribe anytime. Weekly newsletter.',
    },
    {
      from: 'alerts@gleam.io',
      subject: 'Daily bonus entry — Tech Bundle Giveaway',
      preview: 'Come back tomorrow for another entry.',
    },
    {
      from: 'noreply@suspicious-deals.biz',
      subject: 'You have won $1,000,000 — wire fee required',
      preview: 'Act now to claim your crypto lottery prize.',
    },
  ]
  const receivedAt = new Date().toISOString()
  return samples.map((s, i) => {
    const tab = classifyMessage(s.from, s.subject, s.preview)
    return {
      id: `placeholder-${i}`,
      ...s,
      receivedAt,
      tab,
      isPlaceholder: true,
    }
  })
}

export function filterItemsByTab(
  items: InboxShieldMailItem[],
  tab: InboxShieldTab
): InboxShieldMailItem[] {
  return items.filter((m) => m.tab === tab)
}

/** Suggest plus-addressing for Gmail users. */
export function suggestPlusAddress(baseEmail: string): string | null {
  const trimmed = baseEmail.trim()
  if (!trimmed.includes('@')) return null
  const [local, domain] = trimmed.split('@')
  if (!local || !domain) return null
  const root = local.split('+')[0]
  return `${root}+giveaways@${domain}`
}
