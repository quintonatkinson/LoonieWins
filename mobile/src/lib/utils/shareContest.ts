import { Share, Platform } from 'react-native'
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

export async function shareContest(
  contest: Contest
): Promise<'shared' | 'copied' | 'failed'> {
  const payload = buildContestSharePayload(contest)
  try {
    const result = await Share.share(
      Platform.OS === 'ios'
        ? { url: payload.url, message: payload.text }
        : { message: `${payload.text}\n${payload.url}`, title: payload.title }
    )
    if (result.action === Share.dismissedAction) return 'failed'
    return 'shared'
  } catch {
    return 'failed'
  }
}
