import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'

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

const MOCK_WINNERS: WinnerCard[] = [
  {
    id: '1',
    contestName: 'Summer Giveaway',
    winnerDisplay: 'Anonymous',
    prize: '$500 Gift Card',
    wonAt: '2025-02-20',
    prizeValueEstimate: 500,
    contestSource: 'RedFlagDeals',
    contestUrl: '#',
    entryMethod: 'Single entry',
    winnerRegion: 'ON',
  },
  {
    id: '2',
    contestName: 'Tech Bundle',
    winnerDisplay: 'Sarah M.',
    prize: 'Laptop',
    wonAt: '2025-02-18',
    prizeValueEstimate: 1500,
    contestSource: 'ContestScoop',
    contestUrl: '#',
    entryMethod: 'Daily entry',
    winnerRegion: 'BC',
  },
  {
    id: '3',
    contestName: 'Coffee for a Year',
    winnerDisplay: 'Anonymous',
    prize: 'Coffee subscription',
    wonAt: '2025-02-15',
    prizeValueEstimate: 600,
    contestSource: 'CanadianFreeStuff',
    winnerRegion: 'AB',
  },
  {
    id: '4',
    contestName: 'Tropical Getaway',
    winnerDisplay: 'Mike T.',
    prize: '7-night vacation',
    wonAt: '2025-02-10',
    prizeValueEstimate: 3500,
    contestSource: 'RedFlagDeals',
    contestUrl: '#',
    entryMethod: 'Single entry',
    winnerRegion: 'QC',
  },
  {
    id: '5',
    contestName: 'Grocery Gift Card',
    winnerDisplay: 'Anonymous',
    prize: '$100 Gift Card',
    wonAt: '2025-02-08',
    prizeValueEstimate: 100,
    contestSource: 'SmartCanucks',
    winnerRegion: 'ON',
  },
]

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

  const filtered = useMemo(
    () => filterByTime(MOCK_WINNERS, timeFilter),
    [timeFilter]
  )

  const stats = useMemo(() => {
    const totalValue = MOCK_WINNERS.reduce((s, w) => s + (w.prizeValueEstimate ?? 0), 0)
    const thisMonth = filterByTime(MOCK_WINNERS, 'month').length
    return { totalValue, thisMonth }
  }, [])

  return (
    <div className="p-4 space-y-6 pb-24">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Trophy className="w-6 h-6 text-win" />
          Winners Corner
        </h1>
        <p className="text-white/70 text-sm mt-1">Recent wins. You could be next.</p>
      </div>

      {/* Stats strip */}
      <div className="rounded-xl glass border border-gray-600/50 px-4 py-3 flex flex-wrap items-center gap-4">
        <span className="text-sm text-gray-300">
          <span className="text-win font-semibold">{stats.thisMonth}</span> wins this month
        </span>
        <span className="text-sm text-gray-300">
          <span className="text-win font-semibold">${(stats.totalValue / 1000).toFixed(0)}K+</span> in prizes
        </span>
      </div>

      {/* Time filter */}
      <div className="flex gap-2 flex-wrap">
        {(
          [
            ['week', 'This week'],
            ['month', 'This month'],
            ['all', 'All time'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTimeFilter(key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              timeFilter === key
                ? 'bg-win text-on-win'
                : 'bg-gray-800 border border-gray-600/50 text-gray-300 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* You could be next CTA */}
      <Link
        to="/"
        className="block w-full py-3 rounded-xl bg-win text-on-win font-semibold text-center text-sm hover:opacity-90 transition-opacity"
      >
        Find contests to enter
      </Link>

      {/* Winner cards grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {filtered.length === 0 ? (
          <p className="col-span-2 text-gray-500 text-sm py-6 text-center">No wins in this period yet.</p>
        ) : (
          filtered.map((w) => {
            const isBigWin = (w.prizeValueEstimate ?? 0) >= BIG_WIN_THRESHOLD
            return (
              <article
                key={w.id}
                className={`rounded-xl p-5 flex flex-col gap-3 border ${
                  isBigWin
                    ? 'glass border-win/40 bg-win/5'
                    : 'glass border-gray-600/50'
                }`}
              >
                {isBigWin && (
                  <span className="text-xs font-semibold text-win uppercase tracking-wide">
                    Big win
                  </span>
                )}
                <h2 className="font-semibold text-white line-clamp-2">{w.contestName}</h2>
                <p className="text-white/70 text-sm">
                  {w.winnerDisplay}
                  {w.winnerRegion && (
                    <span className="text-white/50"> · {w.winnerRegion}</span>
                  )}{' '}
                  won {w.prize}
                </p>
                {w.prizeValueEstimate != null && (
                  <p className="text-win text-sm font-medium">~${w.prizeValueEstimate.toLocaleString()} CAD</p>
                )}
                {w.contestSource && (
                  <p className="text-white/50 text-xs">via {w.contestSource}</p>
                )}
                {w.entryMethod && (
                  <p className="text-white/50 text-xs">{w.entryMethod}</p>
                )}
                <div className="flex items-center justify-between mt-auto pt-1">
                  <p className="text-white/50 text-xs">{new Date(w.wonAt).toLocaleDateString()}</p>
                  {w.contestUrl && (
                    <a
                      href={w.contestUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-win hover:opacity-80 flex items-center gap-1 text-xs font-medium"
                    >
                      View <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </article>
            )
          })
        )}
      </div>

      {/* How winners are chosen */}
      <section className="rounded-xl glass border border-gray-600/50 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowHowChosen(!showHowChosen)}
          className="w-full px-4 py-3 flex items-center justify-between text-left text-sm font-medium text-white hover:bg-white/5"
        >
          How winners are chosen
          {showHowChosen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showHowChosen && (
          <div className="px-4 pb-3 pt-0 text-sm text-gray-400 border-t border-gray-600/50">
            Winners are drawn by the contest sponsor. We only display wins shared with us or from public winner lists.
          </div>
        )}
      </section>

      {/* Submit your win */}
      <a
        href="#"
        className="block w-full py-3 rounded-xl border border-dashed border-gray-500 text-gray-400 text-center text-sm font-medium hover:border-win/50 hover:text-win transition-colors"
      >
        Did you win? Tell us
      </a>
    </div>
  )
}
