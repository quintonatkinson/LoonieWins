import type { Contest } from '../rssFetcher'

function decodeTitle(title: string): string {
  return title
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

export function buildContestSharePayload(contest: Contest): { title: string; text: string; url: string } {
  const title = decodeTitle(contest.title)
  const prize =
    contest.prizeValue != null ? ` (~$${contest.prizeValue.toLocaleString()})` : ''
  return {
    title: `LoonieWins: ${title}`,
    text: `Check out this contest on LoonieWins: ${title}${prize}`,
    url: contest.url,
  }
}

/** Web Share API with clipboard fallback. Returns how it was shared. */
export async function shareContest(
  contest: Contest
): Promise<'shared' | 'copied' | 'failed'> {
  const payload = buildContestSharePayload(contest)
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
