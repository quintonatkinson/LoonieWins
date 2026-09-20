import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Contest } from '../lib/rssFetcher'
import { isSupabaseConfigured, tracking } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  computeLocalProgress,
  rpcAwardEntryProgress,
} from '../lib/monetization/progression'

export type ContestEntryStatus = 'entered' | 'submitted' | 'won' | 'lost' | 'expired'

export interface ContestEntry {
  contest_id: string
  title: string | null
  contest_url: string | null
  prize_value: number | null
  status: ContestEntryStatus
  entered_at: string
  submitted_at: string | null
}

const LOCAL_KEY = 'looniewins_contest_entries'

function loadLocal(): ContestEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) {
      // Migrate legacy ID-only list if present
      const legacy = localStorage.getItem('looniewins_entered')
      if (!legacy) return []
      const ids = JSON.parse(legacy) as string[]
      return ids.map((id) => ({
        contest_id: id,
        title: null,
        contest_url: null,
        prize_value: null,
        status: 'entered' as const,
        entered_at: new Date().toISOString(),
        submitted_at: null,
      }))
    }
    return JSON.parse(raw) as ContestEntry[]
  } catch {
    return []
  }
}

function saveLocal(entries: ContestEntry[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(entries))
    localStorage.setItem(
      'looniewins_entered',
      JSON.stringify(entries.map((e) => e.contest_id))
    )
  } catch {
    /* quota / private mode */
  }
}

function upsertLocal(prev: ContestEntry[], row: ContestEntry): ContestEntry[] {
  const existing = prev.find((e) => e.contest_id === row.contest_id)
  const merged: ContestEntry = existing
    ? {
        ...existing,
        ...row,
        entered_at: existing.entered_at || row.entered_at,
        submitted_at:
          row.status === 'submitted'
            ? row.submitted_at || existing.submitted_at || new Date().toISOString()
            : existing.submitted_at,
      }
    : row
  const without = prev.filter((e) => e.contest_id !== row.contest_id)
  const next = [merged, ...without]
  saveLocal(next)
  return next
}

export function useContestEntries() {
  const { user, profile, updateProfile, refreshProfile } = useAuth()
  const [entries, setEntries] = useState<ContestEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  const applyProgress = useCallback(
    async (contestId: string, status: ContestEntryStatus, existing: ContestEntry | undefined) => {
      const firstEnter = !existing
      const firstSubmit =
        status === 'submitted' || status === 'won'
          ? !existing ||
            (existing.status !== 'submitted' && existing.status !== 'won')
          : false

      if (!firstEnter && !firstSubmit) return

      if (user && isSupabaseConfigured) {
        const res = await rpcAwardEntryProgress(contestId, status)
        if (res.ok && !res.local) {
          await refreshProfile()
          return
        }
      }

      if (!profile) return
      const next = computeLocalProgress(profile, { firstEnter, firstSubmit })
      if (next.xp_gained <= 0) return
      await updateProfile({
        xp: next.xp,
        level: next.level,
        streak: next.streak,
        last_streak_at: next.last_streak_at,
        streak_grace_available: next.streak_grace_available,
        last_comeback_bonus_at: next.last_comeback_bonus_at,
        ...(next.points_balance != null ? { points_balance: next.points_balance } : {}),
      })
    },
    [user, profile, updateProfile, refreshProfile]
  )

  const refresh = useCallback(async () => {
    if (!user || !isSupabaseConfigured) {
      setEntries(loadLocal())
      return
    }
    setLoading(true)
    try {
      const { data, error } = await tracking()
        .from('contest_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('entered_at', { ascending: false })
      if (error) {
        console.warn('[Entries] load:', error.message)
        setLastError(error.message)
        setEntries(loadLocal())
        return
      }
      const rows = (data ?? []) as ContestEntry[]
      setEntries(rows)
      saveLocal(rows)
      setLastError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setLastError(msg)
      setEntries(loadLocal())
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const enteredIds = useMemo(() => new Set(entries.map((e) => e.contest_id)), [entries])

  const markEntered = useCallback(
    async (
      contest: Contest,
      status: ContestEntryStatus = 'entered'
    ): Promise<{ ok: boolean; error?: string }> => {
      const now = new Date().toISOString()
      const existing = entries.find((e) => e.contest_id === contest.id)
      const row: ContestEntry = {
        contest_id: contest.id,
        title: contest.title,
        contest_url: contest.url,
        prize_value: contest.prizeValue ?? null,
        status,
        entered_at: existing?.entered_at || now,
        submitted_at:
          status === 'submitted' ? existing?.submitted_at || now : existing?.submitted_at ?? null,
      }

      // Optimistic local update always
      setEntries((prev) => upsertLocal(prev, row))

      if (!user || !isSupabaseConfigured) {
        await applyProgress(contest.id, status, existing)
        return { ok: true }
      }

      const payload = {
        user_id: user.id,
        contest_id: row.contest_id,
        title: row.title,
        contest_url: row.contest_url,
        prize_value: row.prize_value,
        status: row.status,
        entered_at: row.entered_at,
        submitted_at: row.submitted_at,
      }

      try {
        const { error } = await tracking()
          .from('contest_entries')
          .upsert(payload, { onConflict: 'user_id,contest_id' })
        if (error) {
          console.warn('[Entries] upsert:', error.message)
          setLastError(error.message)
          return { ok: false, error: error.message }
        }
        setLastError(null)
        await applyProgress(contest.id, status, existing)
        return { ok: true }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setLastError(msg)
        return { ok: false, error: msg }
      }
    },
    [user, entries, applyProgress]
  )

  const updateStatus = useCallback(
    async (
      contestId: string,
      status: ContestEntryStatus
    ): Promise<{ ok: boolean; error?: string }> => {
      const existing = entries.find((e) => e.contest_id === contestId)
      if (!existing) return { ok: false, error: 'Entry not found' }
      const now = new Date().toISOString()
      const next: ContestEntry = {
        ...existing,
        status,
        submitted_at:
          status === 'submitted' ? existing.submitted_at || now : existing.submitted_at,
      }
      setEntries((prev) => upsertLocal(prev, next))

      if (!user || !isSupabaseConfigured) {
        await applyProgress(contestId, status, existing)
        return { ok: true }
      }

      try {
        const { error } = await tracking()
          .from('contest_entries')
          .update({
            status,
            submitted_at: next.submitted_at,
            updated_at: now,
          })
          .eq('user_id', user.id)
          .eq('contest_id', contestId)
        if (error) {
          setLastError(error.message)
          return { ok: false, error: error.message }
        }
        await applyProgress(contestId, status, existing)
        return { ok: true }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setLastError(msg)
        return { ok: false, error: msg }
      }
    },
    [user, entries, applyProgress]
  )

  const removeEntry = useCallback(
    async (contestId: string): Promise<{ ok: boolean; error?: string }> => {
      setEntries((prev) => {
        const next = prev.filter((e) => e.contest_id !== contestId)
        saveLocal(next)
        return next
      })

      if (!user || !isSupabaseConfigured) return { ok: true }

      try {
        const { error } = await tracking()
          .from('contest_entries')
          .delete()
          .eq('user_id', user.id)
          .eq('contest_id', contestId)
        if (error) {
          setLastError(error.message)
          return { ok: false, error: error.message }
        }
        return { ok: true }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setLastError(msg)
        return { ok: false, error: msg }
      }
    },
    [user]
  )

  return {
    entries,
    enteredIds,
    loading,
    lastError,
    refresh,
    markEntered,
    updateStatus,
    removeEntry,
  }
}
