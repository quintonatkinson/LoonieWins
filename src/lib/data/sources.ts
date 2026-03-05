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
  'giveawaybase': 'https://giveawaybase.com/favicon.ico',
  'contest-corner': 'https://www.contest-corner.com/favicon.ico',
  'dragonblogger': 'https://www.dragonblogger.com/favicon.ico',
  'momandmore': 'https://momandmore.com/favicon.ico',
  'thereviewwire': 'https://thereviewwire.com/favicon.ico',
  'giveawaybandit': 'https://giveawaybandit.com/favicon.ico',
  'anationofmoms': 'https://anationofmoms.com/favicon.ico',
  'gameonmom': 'https://www.gameonmom.com/favicon.ico',
  'beautifultouches': 'https://beautifultouches.com/favicon.ico',
  'superlucky': 'https://superlucky.me/favicon.ico',
  'mamalikesthis': 'https://mamalikesthis.com/favicon.ico',
  'steamykitchen': 'https://steamykitchen.com/favicon.ico',
  'rkin-blog': 'https://rkin.com/favicon.ico',
  'sweepsadvantage': 'https://www.sweepsadvantage.com/favicon.ico',
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
    id: 'giveawaybase',
    name: 'Giveaway Base',
    url: 'https://giveawaybase.com/feed/',
    type: 'rss_standard',
    trustScore: 8,
  },
  {
    id: 'contest-corner',
    name: 'Contest Corner',
    url: 'https://www.contest-corner.com/feed/',
    type: 'rss_standard',
    trustScore: 8,
  },
  {
    id: 'dragonblogger',
    name: 'Dragon Blogger (Contests)',
    url: 'https://www.dragonblogger.com/category/contests/feed/',
    type: 'rss_standard',
    trustScore: 7,
  },
  {
    id: 'momandmore',
    name: 'Mom and More (Giveaways)',
    url: 'https://momandmore.com/category/current-giveaways/feed',
    type: 'rss_standard',
    trustScore: 7,
  },
  {
    id: 'thereviewwire',
    name: 'The Review Wire (Giveaways)',
    url: 'https://thereviewwire.com/category/current-giveaways/feed/',
    type: 'rss_standard',
    trustScore: 7,
  },
  {
    id: 'giveawaybandit',
    name: 'The Bandit Lifestyle',
    url: 'https://giveawaybandit.com/category/giveaways/feed/',
    type: 'rss_standard',
    trustScore: 7,
  },
  {
    id: 'anationofmoms',
    name: 'A Nation of Moms',
    url: 'https://anationofmoms.com/category/giveaway/feed',
    type: 'rss_standard',
    trustScore: 7,
  },
  {
    id: 'gameonmom',
    name: 'Game On Mom',
    url: 'https://www.gameonmom.com/category/giveaways/feed/',
    type: 'rss_standard',
    trustScore: 7,
  },
  {
    id: 'beautifultouches',
    name: 'Beautiful Touches',
    url: 'https://beautifultouches.com/category/giveaway/feed/',
    type: 'rss_standard',
    trustScore: 6,
  },
  {
    id: 'superlucky',
    name: 'SuperLucky (UK/Comps)',
    url: 'https://superlucky.me/competitions/blog-comp-linky/feed/',
    type: 'rss_standard',
    trustScore: 6,
  },
  {
    id: 'mamalikesthis',
    name: 'Mama Likes This',
    url: 'https://feeds.feedburner.com/sweeps4bloggers/SZnw',
    type: 'rss_standard',
    trustScore: 7,
  },
  {
    id: 'steamykitchen',
    name: 'Steamy Kitchen (Giveaways)',
    url: 'https://steamykitchen.com/category/steamy-kitchen-giveaways/feed',
    type: 'rss_standard',
    trustScore: 6,
  },
  {
    id: 'rkin-blog',
    name: 'RKIN Blog (Giveaways)',
    url: 'https://rkin.com/blogs/giveaways.atom',
    type: 'rss_standard',
    trustScore: 5,
  },
  // Sweepstakes Advantage: no native RSS; use rss.app feed. Create at rss.app if URL fails.
  {
    id: 'sweepsadvantage',
    name: 'Sweepstakes Advantage',
    url: 'https://rss.app/feeds/sweepsadvantage.xml',
    type: 'rss_standard',
    trustScore: 8,
  },
]
