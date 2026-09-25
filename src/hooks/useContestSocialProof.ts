/**
 * Anonymized “N people entered today” from Hive Mind / tracking.contest_entries.
 * Never exposes usernames — only aggregate counts via SECURITY DEFINER RPCs.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const CACHE_MS = 60_000
/** Privacy floor: hide tiny counts that could identify a single friend. */
export const SOCIAL_PROOF_MIN = 3

type CountMap = Record<string, number>

let cachedAt = 0
let cachedMap: CountMap = {}
let cachedHiveTotal: number | null = null
let inflight: Promise<void> | null = null

async function refreshCounts(): Promise<void> {
  if (!supabase || !isSupabaseConfigured) {
    cachedMap = {}
    cachedHiveTotal = null
    cachedAt = Date.now()
    return
  }
  try {
    const [perContest, hive] = await Promise.all([
      supabase.rpc('contest_entries_today'),
      supabase.rpc('hive_entries_today'),
    ])
    const next: CountMap = {}
    if (!perContest.error && Array.isArray(perContest.data)) {
      for (const row of perContest.data as { contest_id?: string; entries_today?: number }[]) {
        if (row.contest_id && typeof row.entries_today === 'number') {
          next[row.contest_id] = row.entries_today
        }
      }
    }
    cachedMap = next
    if (!hive.error && (typeof hive.data === 'number' || typeof hive.data === 'string')) {
      cachedHiveTotal = Number(hive.data)
    } else {
      cachedHiveTotal = Object.values(next).reduce((a, b) => a + b, 0)
    }
    cachedAt = Date.now()
  } catch {
    // Keep prior cache on failure
    cachedAt = Date.now()
  }
}

function ensureFresh(): Promise<void> {
  if (Date.now() - cachedAt < CACHE_MS && cachedAt > 0) {
    return Promise.resolve()
  }
  if (!inflight) {
    inflight = refreshCounts().finally(() => {
      inflight = null
    })
  }
  return inflight
}

export function formatEntriesToday(count: number | null | undefined): string | null {
  if (count == null || count < SOCIAL_PROOF_MIN) return null
  if (count === 1) return '1 person entered today'
  return `${count.toLocaleString()} people entered today`
}

export function useContestSocialProof(contestIds?: string[]) {
  const [map, setMap] = useState<CountMap>(() => cachedMap)
  const [hiveTotal, setHiveTotal] = useState<number | null>(() => cachedHiveTotal)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    await ensureFresh()
    setMap({ ...cachedMap })
    setHiveTotal(cachedHiveTotal)
    setLoading(false)
  }, [])

  const idsKey = contestIds?.join('|')
  useEffect(() => {
    void refresh()
  }, [refresh, idsKey])

  const countFor = useCallback(
    (contestId: string): number => map[contestId] ?? 0,
    [map]
  )

  const labelFor = useCallback(
    (contestId: string): string | null => formatEntriesToday(countFor(contestId)),
    [countFor]
  )

  const hiveLabel = useMemo(() => formatEntriesToday(hiveTotal), [hiveTotal])

  return {
    loading,
    refresh,
    countFor,
    labelFor,
    hiveTotal,
    hiveLabel,
    map,
  }
}
