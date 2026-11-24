#!/usr/bin/env node
/**
 * Regenerate supabase/functions/_shared/seasonalPromos.ts from client seasonal list.
 * Usage: npx tsx scripts/export-seasonal-ingest.mjs
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSeasonalPromos } from '../src/lib/data/seasonalPromos.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const promos = getSeasonalPromos().filter((p) => p.eligibility === 'CA' || p.eligibility === 'NA')
const body = `/**
 * Live seasonal promo rows for server ingest (generated from src/lib/data/seasonalPromos.ts).
 * Regenerate: npx tsx scripts/export-seasonal-ingest.mjs
 */
export interface SeasonalIngestRow {
  id: string
  title: string
  url: string
  eligibility: 'CA' | 'US' | 'NA'
  tags: string[]
  requirements: string[]
  prizeValue?: number
  expiryDate?: string
  description?: string
}

export const SEASONAL_INGEST_ROWS: SeasonalIngestRow[] = ${JSON.stringify(
  promos.map((p) => ({
    id: p.id,
    title: p.title,
    url: p.url,
    eligibility: p.eligibility,
    tags: p.tags,
    requirements: p.requirements ?? [],
    prizeValue: p.prizeValue,
    expiryDate: p.expiryDate,
    description: p.description,
  })),
  null,
  2
)}
`
writeFileSync(join(root, 'supabase/functions/_shared/seasonalPromos.ts'), body)
console.log(`seasonal ingest rows: ${promos.length}`)