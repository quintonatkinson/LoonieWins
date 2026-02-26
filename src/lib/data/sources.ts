/**
 * Add new RSS feeds here. The Engine automatically picks them up.
 * Master Source List for the Data Aggregation Engine.
 * Feeds into the normalization pipeline. Ready to move to Supabase Edge Functions later.
 */

export type SourceType = 'rss_reddit' | 'rss_standard'

export interface Source {
  id: string
  name: string
  url: string
  type: SourceType
  trustScore: number // 1–10
}

/** Fallback image URLs per source (when no image in item) */
export const SOURCE_FALLBACK_IMAGES: Record<string, string> = {
  'reddit-contestsofcanada': 'https://www.redditstatic.com/desktop2x/img/favicon/android-icon-192x192.png',
  'reddit-canadianfreestuff': 'https://www.redditstatic.com/desktop2x/img/favicon/android-icon-192x192.png',
  'redflagdeals': 'https://forums.redflagdeals.com/favicon.ico',
  'contestscoop': 'https://contestscoop.com/favicon.ico',
  'smartcanucks': 'https://smartcanucks.ca/favicon.ico',
}

export const MASTER_SOURCES: Source[] = [
  {
    id: 'reddit-contestsofcanada',
    name: 'Reddit (Contests of Canada)',
    url: 'https://www.reddit.com/r/contestsofcanada/new/.rss',
    type: 'rss_reddit',
    trustScore: 8,
  },
  {
    id: 'reddit-canadianfreestuff',
    name: 'Reddit (Canadian Free Stuff)',
    url: 'https://www.reddit.com/r/CanadianFreeStuff/new/.rss',
    type: 'rss_reddit',
    trustScore: 7,
  },
  {
    id: 'redflagdeals',
    name: 'RedFlagDeals (Contests)',
    url: 'https://forums.redflagdeals.com/feed/forum/34',
    type: 'rss_standard',
    trustScore: 9,
  },
  {
    id: 'contestscoop',
    name: 'ContestScoop',
    url: 'https://contestscoop.com/feed/',
    type: 'rss_standard',
    trustScore: 7,
  },
  {
    id: 'smartcanucks',
    name: 'SmartCanucks',
    url: 'https://smartcanucks.ca/category/canadian-contests/feed/',
    type: 'rss_standard',
    trustScore: 8,
  },
]
