/**
 * Local Vault + Supabase Hive Mind.
 * Persist contests in localStorage and sync with centralized Supabase DB.
 * Cloud data wins on merge. getLiveContests() serves from local for snappy UI.
 */

import type { Contest } from '../lib/rssFetcher'
import { toExpiryEndOfDay } from '../lib/utils/expiryDate'
import { supabase } from '../lib/supabase'

const CLOUD_TIMEOUT_MS = 8000

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    Promise.resolve(promise).then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      }
    )
  })
}

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

function loadVault(): Contest[] {
  try {
    const raw = localStorage.getItem(VAULT_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveVault(contests: Contest[]): void {
  try {
    localStorage.setItem(VAULT_KEY, JSON.stringify(contests))
  } catch {
    // quota exceeded or disabled
  }
}

/**
 * Cloud Pull: fetch live contests from Supabase and merge into localStorage.
 * Cloud data wins conflicts (by url). Dispatches 'loonie_vault_updated'.
 */
export async function fetchFromCloud(): Promise<number> {
  if (!supabase) return 0
  try {
    const { data, error } = await withTimeout(
      supabase.from('contests').select('*'),
      CLOUD_TIMEOUT_MS
    )

    if (error) {
      console.warn('[Vault] fetchFromCloud error:', error.message)
      return 0
    }

    const rows = (data ?? []) as ContestRow[]
    const cloudContests = rows.map(rowToContest)

    const existing = loadVault()
    const byUrl = new Map<string, Contest>()
    for (const c of existing) {
      byUrl.set(normalizeUrl(c.url), c)
    }
    for (const c of cloudContests) {
      byUrl.set(normalizeUrl(c.url), c)
    }
    saveVault([...byUrl.values()])

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('loonie_vault_updated'))
    }

    return cloudContests.length
  } catch (err) {
    console.warn('[Vault] fetchFromCloud:', err)
    return 0
  }
}

/**
 * Cloud Push: UPSERT enriched contests to Supabase master DB.
 */
export async function syncToCloud(contests: Contest[]): Promise<void> {
  if (!supabase || contests.length === 0) return
  try {
    const rows = contests.map((c) => contestToRow(c))
    const { error } = await withTimeout(
      supabase.from('contests').upsert(rows, {
        onConflict: 'id',
        ignoreDuplicates: false,
      }),
      CLOUD_TIMEOUT_MS
    )
    if (error) {
      console.warn('[Vault] syncToCloud error:', error.message)
    }
  } catch (err) {
    console.warn('[Vault] syncToCloud:', err)
  }
}

/**
 * Returns true if vault has no contests (brand new user).
 */
export function isVaultEmpty(): boolean {
  return loadVault().length === 0
}

/**
 * Merge newly fetched/enriched contests into the local vault.
 * Deduplicate by url (newest scrape data overwrites old).
 * Dispatches 'loonie_vault_updated'.
 */
export function syncToVault(enrichedContests: Contest[]): void {
  const existing = loadVault()
  const byUrl = new Map<string, Contest>()
  for (const c of existing) {
    byUrl.set(normalizeUrl(c.url), c)
  }
  for (const c of enrichedContests) {
    byUrl.set(normalizeUrl(c.url), c)
  }
  saveVault([...byUrl.values()])
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('loonie_vault_updated'))
  }
}

/**
 * Returns vault contests that are still live (from local storage).
 * - expiryDate > now OR undefined
 * - linkStatus is not 403, 404, or 500
 */
export function getLiveContests(): Contest[] {
  const vault = loadVault()
  const now = new Date()
  return vault.filter((c) => {
    if (c.linkStatus != null && DEAD_STATUSES.includes(c.linkStatus)) return false
    if (c.expiryDate == null) return true
    const end = toExpiryEndOfDay(c.expiryDate)
    return !Number.isNaN(end.getTime()) && end > now
  })
}

/**
 * Returns vault contests that have expired.
 */
export function getPastContests(): Contest[] {
  const vault = loadVault()
  const now = new Date()
  return vault.filter((c) => {
    if (c.expiryDate == null) return false
    const end = toExpiryEndOfDay(c.expiryDate)
    return !Number.isNaN(end.getTime()) && end <= now
  })
}
