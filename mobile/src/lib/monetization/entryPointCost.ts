/**
 * Prize-tiered point cost for contest entries after the free weekly cap (mobile).
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

/**
 * Calibrated: Tims ≈ 2–3 videos (~$0.05); vehicle ≈ 1 strong CPI (~$3).
 * Keep in sync with web entryPointCost.ts / pointsEconomy.ts.
 */
export const ENTRY_COST_BY_TIER: Record<EntryCostTier, number> = {
  micro: 50,
  low: 100,
  standard: ENTRY_COST_PTS,
  high: 750,
  premium: 1500,
  mega: 3000,
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
  } else if (tags.includes('high value')) {
    tier = bumpTier(tier, 1)
    if (tier === 'micro' || tier === 'low') tier = 'high'
  } else if (MICRO_PATTERNS.test(text) && (cad == null || cad < 250)) {
    tier = 'micro'
  }

  return tier
}

export function entryPointCost(input: EntryCostInput): number {
  return ENTRY_COST_BY_TIER[resolveEntryCostTier(input)]
}

export function entryCostLabel(input: EntryCostInput): string {
  return ENTRY_COST_TIER_LABELS[resolveEntryCostTier(input)]
}

export function entryCostRangeCopy(): string {
  return `${ENTRY_COST_BY_TIER.micro}–${ENTRY_COST_BY_TIER.mega} pts`
}
