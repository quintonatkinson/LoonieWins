import type { Contest } from '../rssFetcher'

function decodeTitle(title: string): string {
  return title
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

/** Minimal shape for share — feed Contest or My Giveaways entry. */
export type ShareableGiveaway = {
  title: string
  url: string
  prizeValue?: number | null
}

export function buildContestSharePayload(
  contest: ShareableGiveaway
): { title: string; text: string; url: string } {
  const title = decodeTitle(contest.title)
  const prize =
    contest.prizeValue != null ? ` (~$${contest.prizeValue.toLocaleString()})` : ''
  return {
    title: `LoonieWins: ${title}`,
    text: `Check out this contest on LoonieWins: ${title}${prize}`,
    url: contest.url,
  }
}

/**
 * Share a giveaway you’re already in (My Giveaways).
 * Contest URL only — never injects referral codes (Referrals page owns invites).
 */
export function buildEnteredSharePayload(
  contest: ShareableGiveaway
): { title: string; text: string; url: string } {
  const title = decodeTitle(contest.title)
  const prize =
    contest.prizeValue != null ? ` (~$${contest.prizeValue.toLocaleString()})` : ''
  return {
    title: `I'm in: ${title}`,
    text: `I'm entered in this giveaway on LoonieWins: ${title}${prize}`,
    url: contest.url,
  }
}

async function sharePayload(payload: {
  title: string
  text: string
  url: string
}): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url: payload.url,
      })
      return 'shared'
    }
  } catch (err) {
    // User cancel — treat as soft fail without clipboard spam
    if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') {
      return 'failed'
    }
  }
  try {
    const line = `${payload.text}\n${payload.url}`
    await navigator.clipboard.writeText(line)
    return 'copied'
  } catch {
    return 'failed'
  }
}

/** Web Share API with clipboard fallback. Returns how it was shared. */
export async function shareContest(
  contest: Contest | ShareableGiveaway
): Promise<'shared' | 'copied' | 'failed'> {
  return sharePayload(buildContestSharePayload(contest))
}

/** One-tap share from an entered My Giveaways card (no referral injection). */
export async function shareEnteredGiveaway(
  contest: ShareableGiveaway
): Promise<'shared' | 'copied' | 'failed'> {
  if (!contest.url?.trim()) return 'failed'
  return sharePayload(buildEnteredSharePayload(contest))
}
