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
  'redflagdeals': 'https://forums.redflagdeals.com/favicon.ico',
  'contestscoop': 'https://contestscoop.com/favicon.ico',
  'smartcanucks': 'https://smartcanucks.ca/favicon.ico',
  'contestgirl-ca': 'https://www.contestgirl.com/favicon.ico',
  'contestgirl-us': 'https://www.contestgirl.com/favicon.ico',
  'sweeps-fanatics': 'https://sweepstakesfanatics.com/favicon.ico',
  'freebieshark': 'https://www.freebieshark.com/favicon.ico',
  'contest-canada': 'https://contestcanada.ca/favicon.ico',
  'cbc-contests': 'https://www.cbc.ca/favicon.ico',
  'contestcanada-net': 'https://www.contestcanada.net/favicon.ico',
  'sweeties-sweeps': 'https://sweetiessweeps.com/favicon.ico',
  'sweepstakes-bible': 'https://www.sweepstakesbible.com/favicon.ico',
  'win-prizes-online': 'https://www.winprizesonline.com/favicon.ico',
  'true-sweepstakes': 'https://truesweepstakes.com/favicon.ico',
  'save-a-loonie': 'https://www.savealoonie.com/favicon.ico',
}

export const MASTER_SOURCES: Source[] = [
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
  {
    id: 'contestgirl-ca',
    name: 'ContestGirl (CA)',
    url: 'https://www.contestgirl.com/rss/canada-sweepstakes.xml',
    type: 'rss_standard',
    trustScore: 9,
  },
  {
    id: 'contestgirl-us',
    name: 'ContestGirl (US)',
    url: 'https://www.contestgirl.com/rss/sweepstakes.xml',
    type: 'rss_standard',
    trustScore: 9,
  },
  {
    id: 'sweeps-fanatics',
    name: 'Sweepstakes Fanatics',
    url: 'https://sweepstakesfanatics.com/feed/',
    type: 'rss_standard',
    trustScore: 8,
  },
  {
    id: 'freebieshark',
    name: 'FreebieShark (Sweeps)',
    url: 'https://www.freebieshark.com/category/sweepstakes/feed',
    type: 'rss_standard',
    trustScore: 8,
  },
  {
    id: 'contest-canada',
    name: 'Contest Canada',
    url: 'https://contestcanada.ca/feed/',
    type: 'rss_standard',
    trustScore: 7,
  },
  {
    id: 'cbc-contests',
    name: 'CBC Contests',
    url: 'https://rss.cbc.ca/contests/',
    type: 'rss_standard',
    trustScore: 9,
  },
  {
    id: 'contestcanada-net',
    name: 'Contest Canada (.net)',
    url: 'https://feeds.feedburner.com/ContestCanadanet',
    type: 'rss_standard',
    trustScore: 8,
  },
  {
    id: 'sweeties-sweeps',
    name: 'Sweeties Sweeps',
    url: 'https://sweetiessweeps.com/feed',
    type: 'rss_standard',
    trustScore: 9,
  },
  {
    id: 'sweepstakes-bible',
    name: 'Sweepstakes Bible',
    url: 'https://www.sweepstakesbible.com/feed/',
    type: 'rss_standard',
    trustScore: 8,
  },
  {
    id: 'win-prizes-online',
    name: 'WinPrizesOnline',
    url: 'https://www.winprizesonline.com/rss.xml',
    type: 'rss_standard',
    trustScore: 8,
  },
  {
    id: 'true-sweepstakes',
    name: 'True Sweepstakes',
    url: 'https://truesweepstakes.com/feed/',
    type: 'rss_standard',
    trustScore: 8,
  },
  {
    id: 'save-a-loonie',
    name: 'SaveALoonie',
    url: 'https://www.savealoonie.com/category/contests/feed/',
    type: 'rss_standard',
    trustScore: 8,
  },
]
