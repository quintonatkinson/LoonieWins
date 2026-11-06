/**
 * Local Vault + Supabase Hive Mind. Uses AsyncStorage.
 */

import type { Contest } from '../lib/rssFetcher'
import { toExpiryEndOfDay } from '../lib/utils/expiryDate'
import { isDeadLink, DEAD_LINK_STATUSES } from '../lib/utils/linkHealth'
import { supabase } from '../lib/supabase'
import { storage } from '../lib/utils/storage'
import { autoCategorize } from '../lib/data/tagger'

const VAULT_KEY = 'loonie_vault_v1'
/** @deprecated prefer DEAD_LINK_STATUSES */
const DEAD_STATUSES = [...DEAD_LINK_STATUSES]

interface ContestRow {
  id: string
  title: string
  url: string
  source: string
  expiry_date: string | null
  is_estimated_expiry: boolean
  prize_value: number | null
  eligibility: string | null
  tags: string[]
  requirements: string[]
  link_status: number | null
  is_locked: boolean
  created_at: string
  updated_at: string
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.host}${u.pathname}`.toLowerCase().replace(/\/$/, '')
  } catch {
    return url.toLowerCase().replace(/\/$/, '')
  }
}

function deriveRestrictions(title: string, tags: string[] = []): string[] {
  return autoCategorize(title, tags.join(' ')).restrictions
}

export function withDerivedRestrictions(c: Contest): Contest {
  if (c.restrictions && c.restrictions.length > 0) return c
  return {
    ...c,
    restrictions: deriveRestrictions(c.title, c.tags ?? []),
  }
}

function rowToContest(row: ContestRow): Contest {
  const tags = Array.isArray(row.tags) ? row.tags : []
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    source: row.source,
    expiryDate: row.expiry_date ?? undefined,
    is_estimated_expiry: row.is_estimated_expiry,
    prizeValue: row.prize_value ?? undefined,
    eligibility: (row.eligibility as Contest['eligibility']) ?? undefined,
    tags,
    requirements: Array.isArray(row.requirements) ? row.requirements : [],
    linkStatus: row.link_status ?? undefined,
    isLocked: row.is_locked,
    createdAt: row.created_at ?? undefined,
    restrictions: deriveRestrictions(row.title, tags),
  }
}

function contestToRow(c: Contest): Omit<ContestRow, 'created_at' | 'updated_at'> {
  return {
    id: c.id,
    title: c.title,
    url: c.url,
    source: c.source,
    expiry_date: c.expiryDate ?? null,
    is_estimated_expiry: c.is_estimated_expiry ?? false,
    prize_value: c.prizeValue ?? null,
    eligibility: c.eligibility ?? null,
    tags: c.tags ?? [],
    requirements: c.requirements ?? [],
    link_status: c.linkStatus ?? null,
    is_locked: c.isLocked ?? false,
  }
}

async function loadVault(): Promise<Contest[]> {
  try {
    const raw = await storage.getItem(VAULT_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

async function saveVault(contests: Contest[]): Promise<void> {
  try {
    await storage.setItem(VAULT_KEY, JSON.stringify(contests))
  } catch {}
}

export async function fetchFromCloud(): Promise<number> {
  try {
    const { data, error } = await supabase.from('contests').select('*')
    if (error) {
      console.warn('[Vault] fetchFromCloud error:', error.message)
      return 0
    }
    const rows = (data ?? []) as ContestRow[]
    const cloudContests = rows.map(rowToContest)
    const existing = await loadVault()
    const byUrl = new Map<string, Contest>()
    for (const c of existing) byUrl.set(normalizeUrl(c.url), c)
    for (const c of cloudContests) byUrl.set(normalizeUrl(c.url), c)
    await saveVault([...byUrl.values()])
    return cloudContests.length
  } catch (err) {
    console.warn('[Vault] fetchFromCloud:', err)
    return 0
  }
}

export async function syncToCloud(contests: Contest[]): Promise<void> {
  if (contests.length === 0) return
  try {
    const rows = contests.map(contestToRow)
    const { error } = await supabase.from('contests').upsert(rows, { onConflict: 'id', ignoreDuplicates: false })
    if (error) console.warn('[Vault] syncToCloud error:', error.message)
  } catch (err) {
    console.warn('[Vault] syncToCloud:', err)
  }
}

export async function isVaultEmpty(): Promise<boolean> {
  const vault = await loadVault()
  return vault.length === 0
}

export async function syncToVault(enrichedContests: Contest[]): Promise<void> {
  const existing = await loadVault()
  const byUrl = new Map<string, Contest>()
  for (const c of existing) byUrl.set(normalizeUrl(c.url), c)
  for (const c of enrichedContests) byUrl.set(normalizeUrl(c.url), c)
  await saveVault([...byUrl.values()])
}

export async function getLiveContests(): Promise<Contest[]> {
  const vault = await loadVault()
  const now = new Date()
  return vault
    .map(withDerivedRestrictions)
    .filter((c) => {
      if (isDeadLink(c)) return false
      if (c.expiryDate == null) return true
      const end = toExpiryEndOfDay(c.expiryDate)
      return !Number.isNaN(end.getTime()) && end > now
    })
}

export async function getPastContests(): Promise<Contest[]> {
  const vault = await loadVault()
  const now = new Date()
  return vault
    .map(withDerivedRestrictions)
    .filter((c) => {
      if (c.expiryDate == null) return false
      const end = toExpiryEndOfDay(c.expiryDate)
      return !Number.isNaN(end.getTime()) && end <= now
    })
}

/** Search Hive Mind history: local vault + Supabase contests. Dead links buried. */
export async function searchHiveMind(query: string, limit = 40): Promise<Contest[]> {
  const q = query.trim()
  if (!q) return []
  const qLower = q.toLowerCase()
  const byUrl = new Map<string, Contest>()

  for (const c of await loadVault()) {
    if (isDeadLink(c)) continue
    const hay = `${c.title} ${c.source ?? ''} ${c.url}`.toLowerCase()
    if (hay.includes(qLower)) byUrl.set(normalizeUrl(c.url), withDerivedRestrictions(c))
  }

  try {
    const safe = q.replace(/[%_,]/g, ' ').trim()
    if (safe && supabase) {
      const { data, error } = await supabase
        .from('contests')
        .select('*')
        .ilike('title', `%${safe}%`)
        .limit(limit)
      if (!error && data) {
        for (const row of data as ContestRow[]) {
          const c = rowToContest(row)
          if (isDeadLink(c)) continue
          byUrl.set(normalizeUrl(c.url), c)
        }
      }
    }
  } catch (err) {
    console.warn('[Vault] searchHiveMind:', err)
  }

  return [...byUrl.values()].slice(0, limit)
}

export { isDeadLink, DEAD_STATUSES }
