/**
 * Prize-tiered point cost for contest entries after the free weekly cap.
 * Vehicle / mega giveaways cost more than Tims / coffee / gift-card plays.
 *
 * Resolution order:
 * 1. Explicit prizeValue (CAD)
 * 2. Tag hints (High Value, etc.)
 * 3. Title/description keyword estimate via valuation dictionary
 * 4. Default mid-tier
 */

import { estimatePrizeValue } from '../data/valuationDictionary'
import { ENTRY_COST_PTS } from './tiers'

export type EntryCostTier =
  | 'micro'
  | 'low'
  | 'standard'
  | 'high'
  | 'premium'
  | 'mega'

/** Points charged per tier after free weekly entries are exhausted. */
export const ENTRY_COST_BY_TIER: Record<EntryCostTier, number> = {
  /** Tims, coffee, small gift cards */
  micro: 75,
  /** Everyday CPG / low ARV */
  low: 100,
  /** Default / mid-value (~electronics small) */
  standard: ENTRY_COST_PTS,
  /** Trips, bigger electronics */
  high: 400,
  /** High-ticket non-vehicle */
  premium: 600,
  /** Vehicles, house, mega jackpots */
  mega: 1000,
}

export const ENTRY_COST_TIER_LABELS: Record<EntryCostTier, string> = {
  micro: 'Coffee / small prize',
  low: 'Everyday prize',
  standard: 'Standard prize',
  high: 'High-value prize',
  premium: 'Premium prize',
  mega: 'Vehicle / mega prize',
}

const VEHICLE_PATTERNS =
  /\b(car|truck|vehicle|suv|tesla|ram\b|f-?150|silverado|mustang|camaro|civic|corolla|automobile|pickup)\b/i
const MICRO_PATTERNS =
  /\b(tim\s*hortons|tims\b|coffee|latte|cappuccino|doughnut|donut|gift\s*card|roll\s*up)\b/i

export interface EntryCostInput {
  prizeValue?: number | null
  title?: string | null
  description?: string | null
  tags?: string[] | null
}

function tierFromCad(cad: number): EntryCostTier {
  if (cad >= 50_000) return 'mega'
  if (cad >= 10_000) return 'premium'
  if (cad >= 1_000) return 'high'
  if (cad >= 250) return 'standard'
  if (cad >= 75) return 'low'
  return 'micro'
}

function bumpTier(tier: EntryCostTier, steps: number): EntryCostTier {
  const order: EntryCostTier[] = ['micro', 'low', 'standard', 'high', 'premium', 'mega']
  const i = Math.min(order.length - 1, Math.max(0, order.indexOf(tier) + steps))
  return order[i]!
}

/**
 * Resolve which cost tier a contest falls into.
 */
export function resolveEntryCostTier(input: EntryCostInput): EntryCostTier {
  const title = input.title ?? ''
  const description = input.description ?? ''
  const text = `${title} ${description}`
  const tags = (input.tags ?? []).map((t) => t.toLowerCase())

  let cad =
    typeof input.prizeValue === 'number' && input.prizeValue > 0
      ? input.prizeValue
      : undefined

  if (cad == null) {
    cad = estimatePrizeValue(title, description)
  }

  let tier: EntryCostTier = cad != null ? tierFromCad(cad) : 'standard'

  if (VEHICLE_PATTERNS.test(text) || tags.some((t) => t.includes('vehicle') || t.includes('auto'))) {
    tier = 'mega'
  } else if (tags.includes('high value') || tags.some((t) => t === 'high value')) {
    tier = bumpTier(tier, 1)
    if (tier === 'micro' || tier === 'low') tier = 'high'
  } else if (MICRO_PATTERNS.test(text) && (cad == null || cad < 250)) {
    tier = 'micro'
  }

  return tier
}

/** Points required to enter this contest after the free weekly cap. */
export function entryPointCost(input: EntryCostInput): number {
  return ENTRY_COST_BY_TIER[resolveEntryCostTier(input)]
}

export function entryCostLabel(input: EntryCostInput): string {
  return ENTRY_COST_TIER_LABELS[resolveEntryCostTier(input)]
}

/** Short range copy for Earn / paywall UI. */
export function entryCostRangeCopy(): string {
  return `${ENTRY_COST_BY_TIER.micro}–${ENTRY_COST_BY_TIER.mega} pts`
}
