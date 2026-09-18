/**
 * Curated seasonal/recurring Canadian and US promos that don't have RSS feeds.
 * Update dates annually when new seasons are announced.
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
}

const SEASONAL_PROMOS: SeasonalPromo[] = [
  {
    id: 'timhortons-rollup-2026',
    title: 'Tim Hortons Roll Up The Rim',
    url: 'https://www.timhortons.com/roll-up-the-rim',
    source: 'Seasonal Promos',
    eligibility: 'CA',
    tags: ['Daily', 'Instant Win', '⚡ Easy Entry'],
    restrictions: [],
    startDate: '2026-02-23',
    endDate: '2026-03-22',
    prizeValue: 10000000,
    expiryDate: '2026-03-22T23:59:59-05:00',
    description: 'Roll up the rim on cups or play daily in the Tim Hortons app. Prizes include vehicles, trips, and free coffee.',
  },
  {
    id: 'timhortons-rollup-2025',
    title: 'Tim Hortons Roll Up The Rim',
    url: 'https://www.timhortons.com/roll-up-the-rim',
    source: 'Seasonal Promos',
    eligibility: 'CA',
    tags: ['Daily', 'Instant Win', '⚡ Easy Entry'],
    restrictions: [],
    startDate: '2025-03-06',
    endDate: '2025-04-02',
    prizeValue: 10000000,
    expiryDate: '2025-04-02T23:59:59-05:00',
    description: 'Roll up the rim on cups or play daily in the Tim Hortons app. Prizes include vehicles, trips, and free coffee.',
  },
  {
    id: 'mcdonalds-monopoly-2025',
    title: "McDonald's Monopoly Canada",
    url: 'https://www.mcdonalds.com/ca/en-ca/monopoly.html',
    source: 'Seasonal Promos',
    eligibility: 'CA',
    tags: ['Daily', 'Instant Win'],
    restrictions: [],
    startDate: '2025-09-01',
    endDate: '2025-10-31',
    prizeValue: 5000000,
    expiryDate: '2025-10-31T23:59:59-05:00',
    description: "Collect game pieces on select menu items. Play the board for prizes including trips, cars, and cash.",
  },
  {
    id: 'mcdonalds-monopoly-us-2026',
    title: "McDonald's Monopoly USA",
    url: 'https://www.mcdonalds.com/us/en-us/monopoly.html',
    source: 'Seasonal Promos',
    eligibility: 'US',
    tags: ['Daily', 'Instant Win'],
    restrictions: [],
    startDate: '2026-09-01',
    endDate: '2026-10-31',
    prizeValue: 5000000,
    expiryDate: '2026-10-31T23:59:59-05:00',
    description: 'US Monopoly peel-to-win game. Confirm live dates on mcdonalds.com each fall — window updated annually.',
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
    requirements: [],
  }
}

/**
 * Returns seasonal promos that are currently active (today within startDate and endDate).
 */
export function getSeasonalPromos(): Contest[] {
  const today = new Date().toISOString().slice(0, 10)
  return SEASONAL_PROMOS.filter((p) => today >= p.startDate && today <= p.endDate).map(toContest)
}
