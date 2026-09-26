/**
 * Local Vault + Supabase Hive Mind.
 * The ingest Edge Function fills public.contests server-side; the app reads it in one paged pull
 * and caches it in localStorage so the next open paints instantly.
 */

import type { Contest } from '../lib/rssFetcher'
import { toExpiryEndOfDay } from '../lib/utils/expiryDate'
import { isDeadLink, DEAD_LINK_STATUSES } from '../lib/utils/linkHealth'
import { supabase } from '../lib/supabase'
import { autoCategorize } from '../lib/data/tagger'

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

/** @deprecated prefer DEAD_LINK_STATUSES from linkHealth */
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
  // Hive Mind DB has no restrictions column — re-derive from title/tags so Québec-safe works.
  return autoCategorize(title, tags.join(' ')).restrictions
}

/** Rehydrate restrictions when missing (cloud pull / older vault rows). */
export function withDerivedRestrictions(c: Contest): Contest {
  if (c.restrictions && c.restrictions.length > 0) return c
  return {
    ...c,
    restrictions: deriveRestrictions(c.title, c.tags ?? []),
  }
}

function rowToContest(row: ContestRow): Contest {
  const tags = Array.isArray(row.tags) ? row.tags : []
  const requirements = Array.isArray(row.requirements) ? row.requirements : []
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
    requirements,
    linkStatus: row.link_status ?? undefined,
    isLocked: row.is_locked,
    createdAt: row.created_at ?? undefined,
    restrictions: deriveRestrictions(row.title, tags),
  }
}

// Clients no longer write public.contests (server-only since 20260926); kept for tooling.
export function contestToRow(c: Contest): Omit<ContestRow, 'created_at' | 'updated_at'> {
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

const CLOUD_COLUMNS =
  'id,title,url,source,expiry_date,is_estimated_expiry,prize_value,eligibility,tags,requirements,link_status,is_locked,created_at,updated_at'
/** PostgREST caps each response at 1,000 rows; fetch pages in parallel. */
const CLOUD_PAGE = 1000
const CLOUD_MAX_PAGES = 5 // up to 5,000 live contests

function liveQuery(from: number, withCount: boolean, size = CLOUD_PAGE) {
  const nowIso = new Date().toISOString()
  return supabase!
    .from('contests')
    .select(CLOUD_COLUMNS, withCount ? { count: 'exact' } : undefined)
    .or(`expiry_date.is.null,expiry_date.gt.${nowIso}`)
    .or('link_status.is.null,link_status.not.in.(404,410)')
    .order('created_at', { ascending: false })
    .range(from, from + size - 1)
}

/**
 * Cloud Pull: every live contest from the Hive Mind (filled by the ingest Edge Function),
 * newest first. Replaces the local vault cache so the next open paints instantly.
 * Returns null when the cloud is unavailable (offline / not configured).
 */
export async function fetchLiveFromCloud(): Promise<Contest[] | null> {
  if (!supabase) return null
  try {
    const first = await withTimeout(liveQuery(0, true), CLOUD_TIMEOUT_MS)
    if (first.error) {
      console.warn('[Vault] cloud pull:', first.error.message)
      return null
    }
    const rows = [...((first.data ?? []) as unknown as ContestRow[])]
    // The project's "max rows" setting may be below CLOUD_PAGE, so page by what actually came back.
    const pageSize = rows.length
    if (pageSize > 0 && first.count != null && first.count > pageSize) {
      const pages = Math.min(CLOUD_MAX_PAGES, Math.ceil(first.count / pageSize))
      const rest = await Promise.all(
        Array.from({ length: pages - 1 }, (_, i) =>
          Promise.resolve(withTimeout(liveQuery((i + 1) * pageSize, false, pageSize), CLOUD_TIMEOUT_MS)).catch(() => null)
        )
      )
      for (const page of rest) {
        if (page && !page.error) rows.push(...((page.data ?? []) as unknown as ContestRow[]))
      }
    } else if (pageSize > 0 && first.count == null) {
      // Count unavailable: walk until a short page.
      for (let i = 1; i < CLOUD_MAX_PAGES; i++) {
        const page = await Promise.resolve(withTimeout(liveQuery(i * pageSize, false, pageSize), CLOUD_TIMEOUT_MS)).catch(() => null)
        const data = page && !page.error ? ((page.data ?? []) as unknown as ContestRow[]) : []
        rows.push(...data)
        if (data.length < pageSize) break
      }
    }
    const contests = rows.map(rowToContest)
    if (contests.length > 0) {
      saveVault(contests)
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('loonie_vault_updated'))
    }
    return contests
  } catch (err) {
    console.warn('[Vault] cloud pull:', err)
    return null
  }
}

/** @deprecated use fetchLiveFromCloud — kept for callers that only need the count */
export async function fetchFromCloud(): Promise<number> {
  return (await fetchLiveFromCloud())?.length ?? 0
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
 * - linkStatus is not a proven-dead status (404 / 410)
 */
export function getLiveContests(): Contest[] {
  const vault = loadVault()
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

/**
 * Returns vault contests that have expired.
 */
export function getPastContests(): Contest[] {
  const vault = loadVault()
  const now = new Date()
  return vault
    .map(withDerivedRestrictions)
    .filter((c) => {
      if (c.expiryDate == null) return false
      const end = toExpiryEndOfDay(c.expiryDate)
      return !Number.isNaN(end.getTime()) && end <= now
    })
}

/**
 * Search Hive Mind history: local vault + Supabase contests table.
 * Dead links (404/410) are buried from primary results.
 */
export async function searchHiveMind(
  query: string,
  limit = 40,
  opts?: { includeDead?: boolean }
): Promise<Contest[]> {
  const q = query.trim()
  if (!q) return []
  const qLower = q.toLowerCase()
  const includeDead = opts?.includeDead === true

  const byUrl = new Map<string, Contest>()
  for (const c of loadVault()) {
    if (!includeDead && isDeadLink(c)) continue
    const hay = `${c.title} ${c.source ?? ''} ${c.url}`.toLowerCase()
    if (hay.includes(qLower)) byUrl.set(normalizeUrl(c.url), withDerivedRestrictions(c))
  }

  if (supabase) {
    try {
      const safe = q.replace(/[%_,]/g, ' ').trim()
      if (safe) {
        const { data, error } = await withTimeout(
          supabase.from('contests').select('*').ilike('title', `%${safe}%`).limit(limit),
          CLOUD_TIMEOUT_MS
        )
        if (!error && data) {
          for (const row of data as ContestRow[]) {
            const c = rowToContest(row)
            if (!includeDead && isDeadLink(c)) continue
            byUrl.set(normalizeUrl(c.url), c)
          }
        }
      }
    } catch (err) {
      console.warn('[Vault] searchHiveMind:', err)
    }
  }

  return [...byUrl.values()].slice(0, limit)
}

export { isDeadLink, DEAD_STATUSES }
