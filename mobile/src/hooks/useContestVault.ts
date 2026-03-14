/**
 * Local Vault + Supabase Hive Mind. Uses AsyncStorage.
 */

import type { Contest } from '../lib/rssFetcher'
import { toExpiryEndOfDay } from '../lib/utils/expiryDate'
import { supabase } from '../lib/supabase'
import { storage } from '../lib/utils/storage'

const VAULT_KEY = 'loonie_vault_v1'
const DEAD_STATUSES = [403, 404, 500]

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

function rowToContest(row: ContestRow): Contest {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    source: row.source,
    expiryDate: row.expiry_date ?? undefined,
    is_estimated_expiry: row.is_estimated_expiry,
    prizeValue: row.prize_value ?? undefined,
    eligibility: (row.eligibility as Contest['eligibility']) ?? undefined,
    tags: Array.isArray(row.tags) ? row.tags : [],
    requirements: Array.isArray(row.requirements) ? row.requirements : [],
    linkStatus: row.link_status ?? undefined,
    isLocked: row.is_locked,
    restrictions: [],
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
  return vault.filter((c) => {
    if (c.linkStatus != null && DEAD_STATUSES.includes(c.linkStatus)) return false
    if (c.expiryDate == null) return true
    const end = toExpiryEndOfDay(c.expiryDate)
    return !Number.isNaN(end.getTime()) && end > now
  })
}

export async function getPastContests(): Promise<Contest[]> {
  const vault = await loadVault()
  const now = new Date()
  return vault.filter((c) => {
    if (c.expiryDate == null) return false
    const end = toExpiryEndOfDay(c.expiryDate)
    return !Number.isNaN(end.getTime()) && end <= now
  })
}
