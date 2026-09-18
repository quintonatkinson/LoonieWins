/**
 * Add new RSS feeds here. The Engine automatically picks them up.
 * Master Source List for the Data Aggregation Engine.
 * Country is explicit (CA / US / BOTH) so geo coverage stays strong even when
 * per-item eligibility text is missing. Disabled sources are kept for inventory
 * but are not fetched. Ready to move to Supabase Edge Functions later.
 */

export type SourceType = 'rss_reddit' | 'rss_standard'
export type SourceCountry = 'CA' | 'US' | 'BOTH'

export interface Source {
  id: string
  name: string
  url: string
  type: SourceType
  /** Primary market for contests in this feed */
  country: SourceCountry
  trustScore: number // 1–10
  /** When false, engine skips this feed (kept for docs / future revive) */
  enabled?: boolean
  /**
   * If set, keep only items whose title+body match at least one pattern (case-insensitive).
   * Useful for mixed deal/contest blogs.
   */
  includeKeywords?: string[]
}

/** Fallback image URLs per source (when no image in item) */
export const SOURCE_FALLBACK_IMAGES: Record<string, string> = {
  redflagdeals: 'https://forums.redflagdeals.com/favicon.ico',
  contestscoop: 'https://contestscoop.com/favicon.ico',
  smartcanucks: 'https://smartcanucks.ca/favicon.ico',
  'contestgirl-ca': 'https://www.contestgirl.com/favicon.ico',
  'contestgirl-us': 'https://www.contestgirl.com/favicon.ico',
  'sweeps-fanatics': 'https://sweepstakesfanatics.com/favicon.ico',
  freebieshark: 'https://www.freebieshark.com/favicon.ico',
  'contest-canada': 'https://contestcanada.ca/favicon.ico',
  'cbc-contests': 'https://www.cbc.ca/favicon.ico',
  'contestcanada-net': 'https://www.contestcanada.net/favicon.ico',
  'sweeties-sweeps': 'https://sweetiessweeps.com/favicon.ico',
  'sweepstakes-bible': 'https://www.sweepstakesbible.com/favicon.ico',
  'sweepstakes-bible-daily': 'https://www.sweepstakesbible.com/favicon.ico',
  'sweepstakes-bible-iw': 'https://www.sweepstakesbible.com/favicon.ico',
  'win-prizes-online': 'https://www.winprizesonline.com/favicon.ico',
  'true-sweepstakes': 'https://truesweepstakes.com/favicon.ico',
  'save-a-loonie': 'https://www.savealoonie.com/favicon.ico',
  'cfs-contests': 'https://www.canadianfreestuff.com/favicon.ico',
  'cfs-daily': 'https://www.canadianfreestuff.com/favicon.ico',
  'cfs-canadian-contests': 'https://www.canadianfreestuff.com/favicon.ico',
  'hip2save-sweeps': 'https://www.hip2save.com/favicon.ico',
  'online-sweepstakes': 'https://www.online-sweepstakes.com/favicon.ico',
  contestbee: 'https://www.contestbee.com/favicon.ico',
  'sweepstakes-lovers': 'https://www.sweepstakeslovers.com/favicon.ico',
  'sweepstakes-mag': 'https://www.sweepstakesmag.com/favicon.ico',
  'reddit-contestsofcanada': 'https://www.redditstatic.com/desktop2x/img/favicon/android-icon-192x192.png',
  'reddit-canadian-contests': 'https://www.redditstatic.com/desktop2x/img/favicon/android-icon-192x192.png',
  'reddit-contests-canada': 'https://www.redditstatic.com/desktop2x/img/favicon/android-icon-192x192.png',
  'reddit-sweepstakes': 'https://www.redditstatic.com/desktop2x/img/favicon/android-icon-192x192.png',
  'reddit-giveaways': 'https://www.redditstatic.com/desktop2x/img/favicon/android-icon-192x192.png',
  'reddit-freebies': 'https://www.redditstatic.com/desktop2x/img/favicon/android-icon-192x192.png',
}

const CONTEST_KEYWORDS = [
  'contest',
  'sweepstake',
  'giveaway',
  'enter to win',
  'chance to win',
  'win a',
  'win the',
  'win $',
  'instant win',
  'prize',
]

/**
 * Full inventory. `enabled: false` = known dead/blocked/empty — not fetched.
 * Prefer working public RSS; Reddit may rate-limit via shared proxies.
 */
export const MASTER_SOURCES: Source[] = [
  // ——— Canada (active) ———
  {
    id: 'redflagdeals',
    name: 'RedFlagDeals (Contests)',
    url: 'https://forums.redflagdeals.com/feed/forum/34',
    type: 'rss_standard',
    country: 'CA',
    trustScore: 9,
    enabled: true,
  },
  {
    id: 'contestcanada-net',
    name: 'Contest Canada (.net)',
    url: 'https://www.contestcanada.net/feed/',
    type: 'rss_standard',
    country: 'CA',
    trustScore: 9,
    enabled: true,
  },
  {
    id: 'cfs-contests',
    name: 'Canadian Free Stuff (Contests)',
    url: 'https://www.canadianfreestuff.com/canadian-contests/feed/',
    type: 'rss_standard',
    country: 'CA',
    trustScore: 9,
    enabled: true,
  },
  {
    id: 'cfs-daily',
    name: 'Canadian Free Stuff (Daily)',
    url: 'https://www.canadianfreestuff.com/canadian-contests/enter-daily/feed/',
    type: 'rss_standard',
    country: 'CA',
    trustScore: 9,
    enabled: true,
  },
  {
    id: 'cfs-canadian-contests',
    name: 'Canadian Free Stuff (Category)',
    url: 'https://www.canadianfreestuff.com/category/canadian-contests/feed/',
    type: 'rss_standard',
    country: 'CA',
    trustScore: 8,
    enabled: true,
  },
  {
    id: 'contestscoop',
    name: 'ContestScoop',
    url: 'https://contestscoop.com/feed/',
    type: 'rss_standard',
    country: 'CA',
    trustScore: 6,
    enabled: true,
  },
  {
    id: 'contest-canada',
    name: 'Contest Canada (.ca)',
    url: 'https://contestcanada.ca/feed/',
    type: 'rss_standard',
    country: 'CA',
    trustScore: 5,
    enabled: true,
  },
  {
    id: 'reddit-contestsofcanada',
    name: 'Reddit r/contestsofcanada',
    url: 'https://www.reddit.com/r/contestsofcanada/.rss',
    type: 'rss_reddit',
    country: 'CA',
    trustScore: 8,
    enabled: true,
    includeKeywords: CONTEST_KEYWORDS,
  },
  {
    id: 'reddit-canadian-contests',
    name: 'Reddit r/CanadianContests',
    url: 'https://www.reddit.com/r/CanadianContests/.rss',
    type: 'rss_reddit',
    country: 'CA',
    trustScore: 7,
    enabled: true,
    includeKeywords: CONTEST_KEYWORDS,
  },
  {
    id: 'reddit-contests-canada',
    name: 'Reddit r/contestsCanada',
    url: 'https://www.reddit.com/r/contestsCanada/.rss',
    type: 'rss_reddit',
    country: 'CA',
    trustScore: 6,
    enabled: true,
    includeKeywords: CONTEST_KEYWORDS,
  },

  // ——— United States (active) ———
  {
    id: 'sweeties-sweeps',
    name: 'Sweeties Sweeps',
    url: 'https://sweetiessweeps.com/feed/',
    type: 'rss_standard',
    country: 'US',
    trustScore: 9,
    enabled: true,
  },
  {
    id: 'sweepstakes-bible',
    name: 'Sweepstakes Bible',
    url: 'https://www.sweepstakesbible.com/feed/',
    type: 'rss_standard',
    country: 'US',
    trustScore: 9,
    enabled: true,
  },
  {
    id: 'sweepstakes-bible-daily',
    name: 'Sweepstakes Bible (Daily Entry)',
    url: 'https://www.sweepstakesbible.com/category/daily-entry/feed/',
    type: 'rss_standard',
    country: 'US',
    trustScore: 8,
    enabled: true,
  },
  {
    id: 'sweepstakes-bible-iw',
    name: 'Sweepstakes Bible (Instant Win)',
    url: 'https://www.sweepstakesbible.com/category/instant-win/feed/',
    type: 'rss_standard',
    country: 'US',
    trustScore: 8,
    enabled: true,
  },
  {
    id: 'freebieshark',
    name: 'FreebieShark (Sweeps)',
    url: 'https://www.freebieshark.com/category/sweepstakes/feed',
    type: 'rss_standard',
    country: 'US',
    trustScore: 8,
    enabled: true,
  },
  {
    id: 'hip2save-sweeps',
    name: 'Hip2Save (Sweepstakes)',
    url: 'https://www.hip2save.com/category/sweepstakes/feed/',
    type: 'rss_standard',
    country: 'US',
    trustScore: 8,
    enabled: true,
    includeKeywords: CONTEST_KEYWORDS,
  },
  {
    id: 'online-sweepstakes',
    name: 'Online Sweepstakes',
    url: 'https://www.online-sweepstakes.com/feed/',
    type: 'rss_standard',
    country: 'US',
    trustScore: 8,
    enabled: true,
  },
  {
    id: 'contestbee',
    name: 'Contest Bee',
    url: 'https://www.contestbee.com/feed/',
    type: 'rss_standard',
    country: 'US',
    trustScore: 8,
    enabled: true,
  },
  {
    id: 'sweepstakes-lovers',
    name: 'Sweepstakes Lovers',
    url: 'https://www.sweepstakeslovers.com/feed/',
    type: 'rss_standard',
    country: 'US',
    trustScore: 8,
    enabled: true,
  },
  {
    id: 'sweepstakes-mag',
    name: 'Sweepstakes Mag',
    url: 'https://www.sweepstakesmag.com/feed/',
    type: 'rss_standard',
    country: 'US',
    trustScore: 7,
    enabled: true,
    includeKeywords: CONTEST_KEYWORDS,
  },
  {
    id: 'reddit-sweepstakes',
    name: 'Reddit r/sweepstakes',
    url: 'https://www.reddit.com/r/sweepstakes/.rss',
    type: 'rss_reddit',
    country: 'US',
    trustScore: 8,
    enabled: true,
    includeKeywords: CONTEST_KEYWORDS,
  },
  {
    id: 'reddit-giveaways',
    name: 'Reddit r/giveaways',
    url: 'https://www.reddit.com/r/giveaways/.rss',
    type: 'rss_reddit',
    country: 'US',
    trustScore: 7,
    enabled: true,
    includeKeywords: CONTEST_KEYWORDS,
  },
  {
    id: 'reddit-freebies',
    name: 'Reddit r/Freebies',
    url: 'https://www.reddit.com/r/Freebies/.rss',
    type: 'rss_reddit',
    country: 'US',
    trustScore: 6,
    enabled: true,
    includeKeywords: CONTEST_KEYWORDS,
  },

  // ——— Disabled / broken (inventory only — not fetched) ———
  {
    id: 'smartcanucks',
    name: 'SmartCanucks (Contests)',
    url: 'https://smartcanucks.ca/category/canadian-contests/feed/',
    type: 'rss_standard',
    country: 'CA',
    trustScore: 8,
    enabled: false, // 403 Cloudflare
  },
  {
    id: 'contestgirl-ca',
    name: 'ContestGirl (CA)',
    url: 'https://www.contestgirl.com/rss/canada-sweepstakes.xml',
    type: 'rss_standard',
    country: 'CA',
    trustScore: 9,
    enabled: false, // 404 — site RSS removed
  },
  {
    id: 'contestgirl-us',
    name: 'ContestGirl (US)',
    url: 'https://www.contestgirl.com/rss/sweepstakes.xml',
    type: 'rss_standard',
    country: 'US',
    trustScore: 9,
    enabled: false, // 404
  },
  {
    id: 'sweeps-fanatics',
    name: 'Sweepstakes Fanatics',
    url: 'https://sweepstakesfanatics.com/feed/',
    type: 'rss_standard',
    country: 'US',
    trustScore: 8,
    enabled: false, // 403
  },
  {
    id: 'cbc-contests',
    name: 'CBC Contests',
    url: 'https://rss.cbc.ca/contests/',
    type: 'rss_standard',
    country: 'CA',
    trustScore: 9,
    enabled: false, // HTML landing page, not RSS
  },
  {
    id: 'win-prizes-online',
    name: 'WinPrizesOnline',
    url: 'https://www.winprizesonline.com/rss.xml',
    type: 'rss_standard',
    country: 'US',
    trustScore: 8,
    enabled: false, // 404
  },
  {
    id: 'true-sweepstakes',
    name: 'True Sweepstakes',
    url: 'https://truesweepstakes.com/feed/',
    type: 'rss_standard',
    country: 'US',
    trustScore: 8,
    enabled: false, // TLS / host down
  },
  {
    id: 'save-a-loonie',
    name: 'SaveALoonie (Contests)',
    url: 'https://www.savealoonie.com/category/contests/feed/',
    type: 'rss_standard',
    country: 'CA',
    trustScore: 7,
    enabled: false, // empty feed
  },
]

/** Sources the engine should actually fetch */
export function getActiveSources(): Source[] {
  return MASTER_SOURCES.filter((s) => s.enabled !== false)
}

export function getSourcesByCountry(country: 'CA' | 'US' | 'BOTH' | 'ANY'): Source[] {
  const active = getActiveSources()
  if (country === 'ANY' || country === 'BOTH') return active
  return active.filter((s) => s.country === country || s.country === 'BOTH')
}

export function countActiveSources(): { ca: number; us: number; both: number; total: number } {
  const active = getActiveSources()
  return {
    ca: active.filter((s) => s.country === 'CA').length,
    us: active.filter((s) => s.country === 'US').length,
    both: active.filter((s) => s.country === 'BOTH').length,
    total: active.length,
  }
}

/** Whether an item passes the source's optional keyword filter */
export function itemMatchesSourceFilter(source: Source, title: string, body: string): boolean {
  if (!source.includeKeywords?.length) return true
  const text = `${title} ${body}`.toLowerCase()
  return source.includeKeywords.some((kw) => text.includes(kw.toLowerCase()))
}
