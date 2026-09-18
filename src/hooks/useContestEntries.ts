import { useCallback, useEffect, useState } from 'react'
import type { Contest } from '../lib/rssFetcher'
import { tracking } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export interface ContestEntry {
  contest_id: string
  title: string | null
  contest_url: string | null
  prize_value: number | null
  status: 'entered' | 'submitted' | 'won' | 'lost' | 'expired'
  entered_at: string
  submitted_at: string | null
}

export function useContestEntries() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<ContestEntry[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!user) {
      setEntries([])
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
        return
      }
      setEntries((data ?? []) as ContestEntry[])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const enteredIds = new Set(entries.map((e) => e.contest_id))

  const markEntered = useCallback(
    async (contest: Contest, status: ContestEntry['status'] = 'entered') => {
      if (!user) return
      const row = {
        user_id: user.id,
        contest_id: contest.id,
        title: contest.title,
        contest_url: contest.url,
        prize_value: contest.prizeValue ?? null,
        status,
        entered_at: new Date().toISOString(),
        submitted_at: status === 'submitted' ? new Date().toISOString() : null,
      }
      const { error } = await tracking()
        .from('contest_entries')
        .upsert(row, { onConflict: 'user_id,contest_id' })
      if (error) {
        console.warn('[Entries] upsert:', error.message)
        return
      }
      setEntries((prev) => {
        const without = prev.filter((e) => e.contest_id !== contest.id)
        return [
          {
            contest_id: contest.id,
            title: contest.title,
            contest_url: contest.url,
            prize_value: contest.prizeValue ?? null,
            status,
            entered_at: row.entered_at,
            submitted_at: row.submitted_at,
          },
          ...without,
        ]
      })
    },
    [user]
  )

  return { entries, enteredIds, loading, refresh, markEntered }
}
