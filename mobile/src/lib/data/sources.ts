/**
 * Add new RSS feeds here. The Engine automatically picks them up.
 * Master Source List for the Data Aggregation Engine.
 * Country is explicit (CA / US / BOTH) so geo coverage stays strong even when
 * per-item eligibility text is missing. Disabled sources are kept for inventory
 * but are not fetched. Ready to move to Supabase Edge Functions later.
 */

export type SourceType = 'rss_reddit' | 'rss_standard' | 'api_partner' | 'scaffold'
export type SourceCountry = 'CA' | 'US' | 'BOTH'
/**
 * Fetch order for Cloudflare-sensitive hosts.
 * `rss2json_first` uses the public rss2json API (optional paid key = fatter pages).
 */
export type FetchStrategy = 'direct_first' | 'rss2json_first'

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
  /** Override default corsproxy→rss2json order (e.g. CF-blocked category feeds). */
  fetchStrategy?: FetchStrategy
  /** Human note for disabled scaffolds / partnership blockers */
  notes?: string
  /** Applied when the feed itself is purchase-required (e.g. Bible purchase category). */
  defaultRequirements?: string[]
  /** Extra tags always applied for this source (merged after text scan). */
  defaultTags?: string[]
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
  'freestufffinder-giveaways': 'https://www.freestufffinder.com/favicon.ico',
  'online-sweepstakes-daily': 'https://www.online-sweepstakes.com/favicon.ico',
  'sweepstakes-bible-ending': 'https://www.sweepstakesbible.com/favicon.ico',
  'sweepstakes-bible-no-purchase': 'https://www.sweepstakesbible.com/favicon.ico',
  'sweepstakes-bible-purchase': 'https://www.sweepstakesbible.com/favicon.ico',
  'southern-savers-sweeps': 'https://www.southernsavers.com/favicon.ico',
  'gleam-directory': 'https://gleam.io/favicon.ico',
  'viralsweep-directory': 'https://viralsweep.com/favicon.ico',
  'woobox-directory': 'https://woobox.com/favicon.ico',
  'retailer-bestbuy-ca': 'https://www.bestbuy.ca/favicon.ico',
  'retailer-walmart-ca': 'https://www.walmart.ca/favicon.ico',
  'retailer-costco-ca': 'https://www.costco.ca/favicon.ico',
  'brand-official-api': 'https://www.looniewins.com/favicon.ico',
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
    notes:
      'Primary CA hub (Atom). XenForo public feed caps ~15 newest threads — includes brand/OEM drops (auto, CPG, radio, Tims co-promos) when posted to Contests. No extra public contest forum feeds beyond f=34; Hot Deals/Automotive are not contest listings.',
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
    id: 'online-sweepstakes-daily',
    name: 'Online Sweepstakes (Daily Entry)',
    url: 'https://www.online-sweepstakes.com/daily-entry-sweepstakes/feed/',
    type: 'rss_standard',
    country: 'US',
    trustScore: 8,
    enabled: true,
  },
  {
    id: 'sweepstakes-bible-ending',
    name: 'Sweepstakes Bible (Ending Soon)',
    url: 'https://www.sweepstakesbible.com/category/ending-soon/feed/',
    type: 'rss_standard',
    country: 'US',
    trustScore: 8,
    enabled: true,
  },
  {
    id: 'sweepstakes-bible-no-purchase',
    name: 'Sweepstakes Bible (No Purchase)',
    url: 'https://www.sweepstakesbible.com/category/no-purchase-necessary/feed/',
    type: 'rss_standard',
    country: 'US',
    trustScore: 8,
    enabled: true,
    defaultTags: ['⚡ Easy Entry'],
  },
  {
    id: 'sweepstakes-bible-purchase',
    name: 'Sweepstakes Bible (Purchase Required)',
    url: 'https://www.sweepstakesbible.com/category/purchase-required/feed/',
    type: 'rss_standard',
    country: 'US',
    trustScore: 7,
    enabled: true,
    defaultRequirements: ['Purchase Required'],
    defaultTags: ['🧾 Purchase', 'Buy to Enter'],
  },
  {
    id: 'southern-savers-sweeps',
    name: 'Southern Savers (Sweepstakes)',
    url: 'https://www.southernsavers.com/category/sweepstakes/feed/',
    type: 'rss_standard',
    country: 'US',
    trustScore: 7,
    enabled: true,
    includeKeywords: CONTEST_KEYWORDS,
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
  // Cloudflare blocks datacenter IPs on this host; rss2json relay works for giveaways category.
  {
    id: 'freestufffinder-giveaways',
    name: 'FreeStuffFinder (Giveaways)',
    url: 'https://www.freestufffinder.com/category/giveaways/feed/',
    type: 'rss_standard',
    country: 'US',
    trustScore: 8,
    enabled: true,
    fetchStrategy: 'rss2json_first',
    includeKeywords: CONTEST_KEYWORDS,
  },

  // ——— Disabled / broken / partnership scaffolds (inventory only — not fetched) ———
  {
    id: 'smartcanucks',
    name: 'SmartCanucks (Contests)',
    url: 'https://smartcanucks.ca/category/canadian-contests/feed/',
    type: 'rss_standard',
    country: 'CA',
    trustScore: 8,
    enabled: false,
    notes:
      'Blocked: contests category is Cloudflare 403 (direct + rss2json). Main /feed/ is deals-only; tag/contest RSS is a stale archive (2015–2017). Needs SmartCanucks partnership or an official contests feed URL.',
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

  // ——— Scaffolds: no public contest listing feed/API (do not scrape) ———
  {
    id: 'gleam-directory',
    name: 'Gleam (Directory — scaffold)',
    url: 'https://gleam.io/',
    type: 'scaffold',
    country: 'BOTH',
    trustScore: 1,
    enabled: false,
    notes:
      'No public contest listing API. blog.gleam.io is Cloudflare-blocked and marketing-only. Needs Gleam partner API key / affiliate directory access.',
  },
  {
    id: 'viralsweep-directory',
    name: 'ViralSweep (Directory — scaffold)',
    url: 'https://viralsweep.com/',
    type: 'scaffold',
    country: 'BOTH',
    trustScore: 1,
    enabled: false,
    notes: 'No public sweepstakes listing API. Partner / API key required.',
  },
  {
    id: 'woobox-directory',
    name: 'Woobox (Directory — scaffold)',
    url: 'https://woobox.com/blog/feed/',
    type: 'scaffold',
    country: 'BOTH',
    trustScore: 1,
    enabled: false,
    notes:
      'Public blog RSS exists but is product marketing, not contest listings. Needs Woobox partner feed/API.',
  },
  {
    id: 'retailer-bestbuy-ca',
    name: 'Best Buy Canada Contests (scaffold)',
    url: 'https://www.bestbuy.ca/',
    type: 'scaffold',
    country: 'CA',
    trustScore: 1,
    enabled: false,
    notes: 'No public giveaway RSS/API. Needs retailer partnership.',
  },
  {
    id: 'retailer-walmart-ca',
    name: 'Walmart Canada Contests (scaffold)',
    url: 'https://www.walmart.ca/',
    type: 'scaffold',
    country: 'CA',
    trustScore: 1,
    enabled: false,
    notes: 'No public giveaway RSS/API. Needs retailer partnership.',
  },
  {
    id: 'retailer-costco-ca',
    name: 'Costco Canada Contests (scaffold)',
    url: 'https://www.costco.ca/',
    type: 'scaffold',
    country: 'CA',
    trustScore: 1,
    enabled: false,
    notes: 'No public giveaway RSS/API. Needs retailer partnership.',
  },
  {
    id: 'brand-official-api',
    name: 'Official brand contest APIs (scaffold)',
    url: 'https://example.com/partner-contests',
    type: 'api_partner',
    country: 'BOTH',
    trustScore: 1,
    enabled: false,
    notes:
      'Placeholder for brand hubs (Tim Hortons, McD, P&G, etc.) once partner API keys exist. Until then use seasonalPromos.ts for known windows.',
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
