/**
 * LoonieWins contest fetching: uses the Data Aggregation Engine and provides link resolution.
 * Re-exports fetchAllContests + Contest from the engine.
 * resolveContestUrl uses linkResolver.deepScrape for final URL.
 */

import type { Contest } from './data/engine'
import { deepScrape } from './data/linkResolver'

export type { Contest }
export { fetchAllContests, fetchRawContests, enrichContest } from './data/engine'

/**
 * Resolve a middleman/blog URL to the actual contest entry form URL.
 * Uses linkResolver.deepScrape (CORS proxy + form/CTA parsing). Caches internally.
 */
export async function resolveContestUrl(url: string): Promise<string> {
  const result = await deepScrape(url)
  return result.finalUrl
}
