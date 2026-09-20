/**
 * Curated seasonal/recurring Canadian and US promos that don't have RSS feeds.
 * Update dates annually when new seasons are announced.
 * Windows are inclusive YYYY-MM-DD; getSeasonalPromos() only returns live ones.
 */

import type { Contest } from './normalizer'

interface SeasonalPromo {
  id: string
  title: string
  url: string
  source: string
  eligibility: 'CA' | 'US' | 'NA'
  tags: string[]
  restrictions: string[]
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  prizeValue?: number
  expiryDate?: string
  description?: string
  requirements?: string[]
}

const SEASONAL_PROMOS: SeasonalPromo[] = [
  // ——— Coffee / QSR (CA) ———
  {
    id: 'timhortons-rollup-2026',
    title: 'Tim Hortons Roll Up To Win (2026)',
    url: 'https://www.timhortons.ca/rolluptowin',
    source: 'Seasonal Promos',
    eligibility: 'CA',
    tags: ['Daily', 'Instant Win', '⚡ Easy Entry'],
    restrictions: [],
    startDate: '2026-02-23',
    endDate: '2026-03-22',
    prizeValue: 10000000,
    expiryDate: '2026-03-22T23:59:59-05:00',
    description:
      'Seasonal Tim Hortons Roll Up / digital daily play in the Tims app. Confirm live dates on timhortons.ca each year.',
  },
  {
    id: 'timhortons-rollup-2025',
    title: 'Tim Hortons Roll Up The Rim (2025)',
    url: 'https://www.timhortons.com/roll-up-the-rim',
    source: 'Seasonal Promos',
    eligibility: 'CA',
    tags: ['Daily', 'Instant Win', '⚡ Easy Entry'],
    restrictions: [],
    startDate: '2025-03-06',
    endDate: '2025-04-02',
    prizeValue: 10000000,
    expiryDate: '2025-04-02T23:59:59-05:00',
    description: 'Roll up the rim on cups or play daily in the Tim Hortons app.',
  },
  {
    id: 'timhortons-app-ongoing',
    title: 'Tim Hortons App — Offers & Contests Hub',
    url: 'https://www.timhortons.ca/tims-rewards',
    source: 'Seasonal Promos',
    eligibility: 'CA',
    tags: ['Daily', '⚡ Easy Entry'],
    restrictions: [],
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    prizeValue: 500,
    expiryDate: '2026-12-31T23:59:59-05:00',
    description:
      'Year-round Tims Rewards / app hub — check for rotating digital dailies and co-promos (e.g. NHL Heritage Classic).',
  },
  {
    id: 'starbucks-ca-rewards',
    title: 'Starbucks Rewards Canada — Contests & Stars',
    url: 'https://www.starbucks.ca/rewards',
    source: 'Seasonal Promos',
    eligibility: 'CA',
    tags: ['Weekly', '⚡ Easy Entry'],
    restrictions: [],
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    prizeValue: 1000,
    expiryDate: '2026-12-31T23:59:59-05:00',
    description: 'Starbucks Rewards hub; seasonal Stars challenges and partner giveaways appear here.',
  },
  {
    id: 'mcdonalds-monopoly-2025',
    title: "McDonald's Monopoly Canada",
    url: 'https://www.mcdonalds.com/ca/en-ca/monopoly.html',
    source: 'Seasonal Promos',
    eligibility: 'CA',
    tags: ['Daily', 'Instant Win', '🧾 Purchase', 'Buy to Enter'],
    restrictions: [],
    startDate: '2025-09-01',
    endDate: '2025-10-31',
    prizeValue: 5000000,
    expiryDate: '2025-10-31T23:59:59-05:00',
    description: "Collect game pieces on select menu items.",
    requirements: ['Purchase Required'],
  },
  {
    id: 'mcdonalds-monopoly-ca-2026',
    title: "McDonald's Monopoly Canada (2026 window)",
    url: 'https://www.mcdonalds.com/ca/en-ca/monopoly.html',
    source: 'Seasonal Promos',
    eligibility: 'CA',
    tags: ['Daily', 'Instant Win', '🧾 Purchase', 'Buy to Enter'],
    restrictions: [],
    startDate: '2026-09-01',
    endDate: '2026-10-31',
    prizeValue: 5000000,
    expiryDate: '2026-10-31T23:59:59-05:00',
    description: 'Confirm Monopoly CA dates on mcdonalds.com each fall.',
    requirements: ['Purchase Required'],
  },
  {
    id: 'aw-buddy-ca',
    title: 'A&W Canada Contests & Buddy Burger Promos',
    url: 'https://web.aw.ca/en/our-commitment',
    source: 'Seasonal Promos',
    eligibility: 'CA',
    tags: ['Weekly'],
    restrictions: [],
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    prizeValue: 500,
    expiryDate: '2026-12-31T23:59:59-05:00',
    description: 'A&W Canada rotates regional contests; check site/app for live entry forms.',
  },
  {
    id: 'dq-blizzard-ca',
    title: 'Dairy Queen Canada Contests',
    url: 'https://www.dairyqueen.com/en-ca/',
    source: 'Seasonal Promos',
    eligibility: 'CA',
    tags: ['Weekly', '🧾 Purchase', 'Buy to Enter'],
    restrictions: [],
    startDate: '2026-05-01',
    endDate: '2026-09-15',
    prizeValue: 1000,
    expiryDate: '2026-09-15T23:59:59-05:00',
    description: 'Summer Blizzard / DQ Canada promo window — confirm dates annually.',
    requirements: ['Purchase Required'],
  },

  // ——— Grocery / CPG / loyalty (CA) ———
  {
    id: 'pc-optimum-contests',
    title: 'PC Optimum — Contests & Offers',
    url: 'https://www.pcoptimum.ca/',
    source: 'Seasonal Promos',
    eligibility: 'CA',
    tags: ['Weekly', '⚡ Easy Entry'],
    restrictions: [],
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    prizeValue: 2000,
    expiryDate: '2026-12-31T23:59:59-05:00',
    description: 'Loblaw / PC Optimum member contests and point sweeps (rotating).',
  },
  {
    id: 'scene-plus-contests',
    title: 'Scene+ Contests & Experiences',
    url: 'https://www.sceneplus.ca/en-ca/contests',
    source: 'Seasonal Promos',
    eligibility: 'CA',
    tags: ['Weekly', '⚡ Easy Entry'],
    restrictions: [],
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    prizeValue: 5000,
    expiryDate: '2026-12-31T23:59:59-05:00',
    description: 'Scene+ member contests (movies, sports, travel). URL may redirect if path changes.',
  },
  {
    id: 'shoppers-beauty-contests',
    title: 'Shoppers Drug Mart / Beauty Boutique Contests',
    url: 'https://www.shoppersdrugmart.ca/',
    source: 'Seasonal Promos',
    eligibility: 'CA',
    tags: ['Weekly'],
    restrictions: [],
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    prizeValue: 1000,
    expiryDate: '2026-12-31T23:59:59-05:00',
    description: 'SDM / Beauty Boutique rotating giveaways — often purchase or points related.',
  },

  // ——— US QSR / portals ———
  {
    id: 'mcdonalds-monopoly-us-2026',
    title: "McDonald's Monopoly USA",
    url: 'https://www.mcdonalds.com/us/en-us/monopoly.html',
    source: 'Seasonal Promos',
    eligibility: 'US',
    tags: ['Daily', 'Instant Win', '🧾 Purchase', 'Buy to Enter'],
    restrictions: [],
    startDate: '2026-09-01',
    endDate: '2026-10-31',
    prizeValue: 5000000,
    expiryDate: '2026-10-31T23:59:59-05:00',
    description: 'US Monopoly peel-to-win. Confirm live dates yearly.',
    requirements: ['Purchase Required'],
  },
  {
    id: 'pch-superprize-ongoing',
    title: 'Publishers Clearing House Sweepstakes',
    url: 'https://www.pch.com/',
    source: 'Seasonal Promos',
    eligibility: 'US',
    tags: ['Daily', '⚡ Easy Entry'],
    restrictions: [],
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    prizeValue: 7000000,
    expiryDate: '2026-12-31T23:59:59-05:00',
    description: 'Ongoing US sweepstakes portal (PCH). Multiple prize drawings year-round.',
  },
  {
    id: 'starbucks-us-rewards',
    title: 'Starbucks Rewards USA — Challenges & Sweeps',
    url: 'https://www.starbucks.com/rewards',
    source: 'Seasonal Promos',
    eligibility: 'US',
    tags: ['Weekly', '⚡ Easy Entry'],
    restrictions: [],
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    prizeValue: 1000,
    expiryDate: '2026-12-31T23:59:59-05:00',
    description: 'US Starbucks Rewards hub for seasonal Stars challenges and partner sweeps.',
  },
  {
    id: 'coca-cola-us-sweeps',
    title: 'Coca-Cola Contests & Sweepstakes Hub',
    url: 'https://us.coca-cola.com/',
    source: 'Seasonal Promos',
    eligibility: 'US',
    tags: ['Weekly'],
    restrictions: [],
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    prizeValue: 10000,
    expiryDate: '2026-12-31T23:59:59-05:00',
    description: 'Coca-Cola brand hub — summer / sports co-promos rotate; check site for live forms.',
  },
  {
    id: 'pepsico-us-sweeps',
    title: 'PepsiCo Promotions Hub',
    url: 'https://contact.pepsico.com/pepsi',
    source: 'Seasonal Promos',
    eligibility: 'US',
    tags: ['Weekly'],
    restrictions: [],
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    prizeValue: 5000,
    expiryDate: '2026-12-31T23:59:59-05:00',
    description: 'Pepsi / Frito-Lay style promotions — often buy-to-enter; confirm active offers.',
  },

  // ——— Auto / OEM (high-value; usually short windows — keep URL hubs) ———
  {
    id: 'stellantis-ram-sweeps',
    title: 'RAM / Stellantis Contests & Truck Giveaways',
    url: 'https://www.ramtrucks.com/',
    source: 'Seasonal Promos',
    eligibility: 'NA',
    tags: ['High Value', '🧾 Purchase', 'Buy to Enter'],
    restrictions: [],
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    prizeValue: 80000,
    expiryDate: '2026-12-31T23:59:59-05:00',
    description:
      'OEM truck giveaways (RAM, Jeep, etc.) are episodic. Also watch RedFlagDeals Contests for CA drops. No stable public RSS — curated hub only.',
    requirements: ['Purchase Required'],
  },
]

function toContest(p: SeasonalPromo): Contest {
  return {
    id: p.id,
    title: p.title,
    url: p.url,
    source: p.source,
    tags: p.tags,
    restrictions: p.restrictions,
    eligibility: p.eligibility,
    prizeValue: p.prizeValue,
    expiryDate: p.expiryDate,
    description: p.description,
    requirements: p.requirements ?? [],
  }
}

/**
 * Returns seasonal promos that are currently active (today within startDate and endDate).
 */
export function getSeasonalPromos(): Contest[] {
  const today = new Date().toISOString().slice(0, 10)
  return SEASONAL_PROMOS.filter((p) => today >= p.startDate && today <= p.endDate).map(toContest)
}
