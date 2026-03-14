/**
 * Contest fetching: re-exports from engine.
 */

import type { Contest } from './data/engine'
import { deepScrape } from './data/linkResolver'

export type { Contest }
export { fetchAllContests, fetchRawContests, enrichContest } from './data/engine'

export async function resolveContestUrl(url: string, textContent?: string): Promise<string> {
  const result = await deepScrape(url, textContent)
  return result.finalUrl
}
