import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, ExternalLink, ChevronDown, ChevronUp, Package } from 'lucide-react'
import { giveaways, isSupabaseConfigured } from '../lib/supabase'
import PageShell from '../components/PageShell'

interface WinnerCard {
  id: string
  contestName: string
  winnerDisplay: string
  prize: string
  wonAt: string
  prizeValueEstimate?: number
  contestSource?: string
  contestUrl?: string
  entryMethod?: string
  winnerRegion?: string
}

const BIG_WIN_THRESHOLD = 1000

type TimeFilter = 'week' | 'month' | 'all'

function filterByTime(winners: WinnerCard[], filter: TimeFilter): WinnerCard[] {
  const now = Date.now()
  const weekMs = 7 * 24 * 60 * 60 * 1000
  const monthMs = 30 * 24 * 60 * 60 * 1000
  return winners.filter((w) => {
    const t = new Date(w.wonAt).getTime()
    if (filter === 'week') return now - t <= weekMs
    if (filter === 'month') return now - t <= monthMs
    return true
  })
}

export default function Winners() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month')
  const [showHowChosen, setShowHowChosen] = useState(false)
  const [winners, setWinners] = useState<WinnerCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      if (!isSupabaseConfigured) {
        if (mounted) {
          setWinners([])
          setLoading(false)
        }
        return
      }
      try {
        const { data, error } = await giveaways()
          .from('user_wins')
          .select('*')
          .order('won_at', { ascending: false })
          .limit(100)
        if (!mounted) return
        if (error) {
          console.warn('[Winners]', error.message)
          setWinners([])
        } else {
          setWinners(
            (data ?? []).map((row: Record<string, unknown>) => ({
              id: String(row.id),
              contestName: String(row.contest_name || row.prize_description || 'Contest win'),
              winnerDisplay: String(row.winner_display || 'Anonymous'),
              prize: String(row.prize_description || 'Prize'),
              wonAt: String(row.won_at || '').slice(0, 10),
              prizeValueEstimate: row.prize_value_estimate as number | undefined,
              contestSource: row.contest_source as string | undefined,
              contestUrl: row.contest_url as string | undefined,
              entryMethod: row.entry_method as string | undefined,
              winnerRegion: row.winner_region as string | undefined,
            }))
          )
        }
      } catch (e) {
        console.warn('[Winners]', e)
        if (mounted) setWinners([])
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const filtered = useMemo(() => filterByTime(winners, timeFilter), [winners, timeFilter])

  const stats = useMemo(() => {
    const totalValue = winners.reduce((s, w) => s + (w.prizeValueEstimate ?? 0), 0)
    const thisMonth = filterByTime(winners, 'month').length
    return { totalValue, thisMonth, count: winners.length }
  }, [winners])

  return (
    <PageShell className="space-y-6" testId="winners">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-win/20 border border-win/40 shrink-0">
          <Trophy className="w-5 h-5 text-win" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-white">Winners</h1>
          <p className="text-sm text-gray-400 mt-0.5">Recent wins. You could be next.</p>
        </div>
      </div>

      <div className="glass rounded-xl p-4 flex flex-wrap gap-4 text-sm">
        <p>
          <span className="text-win font-semibold">{stats.thisMonth}</span> wins this month
        </p>
        <p>
          <span className="text-win font-semibold">{stats.count}</span> total shared
        </p>
        <p>
          ~$
          <span className="text-win font-semibold">{stats.totalValue.toLocaleString()}</span> prize
          value
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Winner time filter">
        {(['week', 'month', 'all'] as TimeFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={timeFilter === f}
            onClick={() => setTimeFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              timeFilter === f
                ? 'bg-win text-on-win border-win'
                : 'bg-surface border-gray-600/50 text-gray-400 hover:text-gray-200'
            }`}
          >
            {f === 'week' ? 'This week' : f === 'month' ? 'This month' : 'All time'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm py-6 text-center">Loading wins…</p>
      ) : filtered.length === 0 ? (
        <div className="empty-panel space-y-3">
          <p className="text-white font-medium">
            {!isSupabaseConfigured
              ? 'Winner feed needs cloud sync'
              : 'No wins in this period yet'}
          </p>
          <p className="text-sm text-gray-400 max-w-sm mx-auto">
            {!isSupabaseConfigured
              ? 'Guest mode shows the layout. Shared community wins appear here once Supabase is live.'
              : 'Wins appear when users share them to the community feed. Keep entering from Home.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link
              to="/"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-win text-on-win font-semibold text-sm"
            >
              Enter from Home
            </Link>
            <Link
              to="/past"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-gray-600/50 text-sm text-gray-300 hover:text-white"
            >
              <Package className="w-3.5 h-3.5" />
              Past contests
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((w) => {
            const big = (w.prizeValueEstimate ?? 0) >= BIG_WIN_THRESHOLD
            return (
              <article
                key={w.id}
                className={`rounded-xl glass p-4 border ${
                  big ? 'border-win/40' : 'border-gray-600/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-sm text-white line-clamp-2">{w.contestName}</h3>
                  {w.contestUrl && (
                    <a
                      href={w.contestUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-win shrink-0"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
                <p className="text-win font-medium text-sm mt-2">{w.prize}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {w.winnerDisplay}
                  {w.winnerRegion ? ` · ${w.winnerRegion}` : ''} · {w.wonAt}
                </p>
                {w.contestSource && (
                  <p className="text-xs text-gray-500 mt-1">{w.contestSource}</p>
                )}
              </article>
            )
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowHowChosen((v) => !v)}
        className="flex items-center gap-2 text-sm text-gray-400"
      >
        How are winners chosen?
        {showHowChosen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {showHowChosen && (
        <p className="text-sm text-gray-500">
          Winners are drawn by the contest sponsor. We only display wins shared with us or from
          public winner lists. See our{' '}
          <Link to="/terms" className="text-win">
            Terms
          </Link>
          .
        </p>
      )}
    </PageShell>
  )
}
