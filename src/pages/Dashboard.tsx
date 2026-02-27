import { useState, useCallback } from 'react'
import type { Contest } from '../lib/rssFetcher'
import ContestBrowser from '../components/ContestBrowser'
import ContestCard from '../components/ContestCard'
import RadarLoader from '../components/RadarLoader'
import { useContestPipeline } from '../hooks/useContestPipeline'
import type { AutoFillData } from '../types/profile'

type SortFilter = 'high-value' | 'ending-soon' | 'best-odds' | 'most-popular'

/** Filter by tag or requirement — matches contest.tags or contest.requirements */
const TAG_REQ_FILTERS: { key: string; label: string; match: (c: Contest) => boolean }[] = [
  {
    key: 'easy',
    label: '⚡ Easy Entry',
    match: (c) => {
      const tags = c.tags ?? []
      const reqs = c.requirements ?? []
      if (tags.includes('⚡ Easy Entry')) return true
      if (reqs.length === 0 && !tags.includes('🧾 Purchase')) return true
      return false
    },
  },
  { key: 'purchase', label: 'Purchase Required', match: (c) => (c.requirements ?? []).includes('Purchase Required') },
  { key: 'app', label: 'App Download', match: (c) => (c.requirements ?? []).includes('App Download') },
  { key: 'social', label: 'Social Follow', match: (c) => (c.requirements ?? []).includes('Social Action') },
  { key: 'creative', label: 'Creative', match: (c) => (c.requirements ?? []).includes('Creative Submission') },
  { key: 'newsletter', label: 'Newsletter', match: (c) => (c.requirements ?? []).includes('Newsletter Signup') },
  { key: 'daily', label: 'Daily', match: (c) => (c.tags ?? []).includes('Daily') },
  { key: 'instant', label: 'Instant Win', match: (c) => (c.tags ?? []).includes('Instant Win') },
  { key: 'highvalue', label: 'High Value', match: (c) => (c.tags ?? []).includes('High Value') },
  { key: 'math', label: 'Math', match: (c) => (c.tags ?? []).includes('🧠 Math') },
]

const STORAGE_ENTERED = 'looniewins_entered'

function getEnteredIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_ENTERED)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function setEnteredIds(ids: Set<string>) {
  localStorage.setItem(STORAGE_ENTERED, JSON.stringify([...ids]))
}

export default function Dashboard() {
  const pipeline = useContestPipeline()
  const { liveContests, isScanning, isFinished, offlineMode, phaseMessage, refetch } = pipeline

  const [search, setSearch] = useState('')
  const [sortFilter, setSortFilter] = useState<SortFilter | null>(null)
  const [hideEntered, setHideEntered] = useState(false)
  const [hideQCExcluded, setHideQCExcluded] = useState(false)
  const [tagFilters, setTagFilters] = useState<Set<string>>(new Set())
  const [enteredIds, setEnteredIdsState] = useState(getEnteredIds)
  const [overlayContest, setOverlayContest] = useState<Contest | null>(null)
  const [autoFillData] = useState<AutoFillData>(() => ({
    name: 'Jane Doe',
    email: 'jane@example.com',
    address: '123 Main St, Toronto ON',
  }))

  const markEntered = useCallback((contest: Contest) => {
    const next = new Set(enteredIds)
    next.add(contest.id)
    setEnteredIdsState(next)
    setEnteredIds(next)
  }, [enteredIds])

  const routineContests = liveContests.filter((c) => enteredIds.has(c.id)).slice(0, 10)

  let feedContests = liveContests.filter((c) => {
    if (hideEntered && enteredIds.has(c.id)) return false
    if (hideQCExcluded && c.restrictions?.includes('no_quebec')) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      if (!c.title.toLowerCase().includes(q)) return false
    }
    if (tagFilters.size > 0) {
      const matchesAny = TAG_REQ_FILTERS.some(
        (f) => tagFilters.has(f.key) && f.match(c)
      )
      if (!matchesAny) return false
    }
    return true
  })

  if (sortFilter === 'high-value') {
    feedContests = [...feedContests].sort((a, b) => (b.prizeValue ?? 0) - (a.prizeValue ?? 0))
  } else if (sortFilter === 'ending-soon') {
    feedContests = [...feedContests].sort((a, b) => {
      const da = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity
      const db = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity
      return da - db
    })
  } else if (sortFilter === 'most-popular') {
    feedContests = [...feedContests].sort((a, b) => (b.prizeValue ?? 0) - (a.prizeValue ?? 0))
  }
  // best-odds: no data, leave order as-is

  const daysLeft = (c: Contest) =>
    c.expiryDate
      ? Math.max(0, Math.ceil((new Date(c.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null

  const showFullRadar = isScanning && liveContests.length === 0

  return (
    <div className="flex flex-col bg-gray-900">
      {offlineMode && (
        <div className="mx-4 mt-2 mb-0 px-3 py-1.5 rounded-lg bg-yellow-500/20 text-yellow-400 text-sm font-medium inline-flex w-fit">
          Offline Mode
        </div>
      )}
      {!showFullRadar && (
        <>
      {/* Your Daily Routine */}
      <section className="px-4 pt-4">
        <h2 className="text-base font-bold text-gray-50 flex items-center gap-2 mb-3">
          <span className="text-win">⚡</span>
          Your Daily Routine
        </h2>
        <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-thin">
          {routineContests.length === 0 ? (
            <p className="text-gray-500 text-sm py-4">Enter contests to see them here.</p>
          ) : (
            routineContests.map((c) => (
              <ContestCard
                key={c.id}
                contest={c}
                onOpenOverlay={setOverlayContest}
                variant="routine"
              />
            ))
          )}
        </div>
      </section>

      {/* Search bar */}
      <div className="sticky top-[52px] z-20 px-4 py-3 bg-gray-900 border-y border-gray-700/50">
        <div className="flex items-center gap-2 w-full rounded-xl bg-surface-light border border-gray-600/50 px-3 py-2.5">
          <span className="text-gray-500" aria-hidden>🔍</span>
          <input
            type="search"
            placeholder="Search contests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-gray-50 placeholder-gray-500 focus:outline-none text-sm"
          />
          <button
            type="button"
            onClick={refetch}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-50 hover:bg-gray-600/50"
            title="Refresh"
            aria-label="Refresh contests"
          >
            <span aria-hidden>🔄</span>
          </button>
        </div>
      </div>

      {/* Filter row */}
      <div className="px-4 py-3 flex flex-wrap gap-2 items-center">
        {(
          [
            ['high-value', 'High Value'],
            ['ending-soon', 'Ending Soon'],
            ['best-odds', 'Best Odds'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSortFilter(sortFilter === key ? null : key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              sortFilter === key
                ? 'bg-win text-gray-900'
                : 'bg-surface border border-gray-600/50 text-gray-300 hover:text-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setHideEntered((v) => !v)}
          className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
            hideEntered ? 'bg-gray-700 text-gray-50 border-gray-500' : 'bg-surface border-gray-600/50 text-gray-400'
          }`}
        >
          Hide Entered
        </button>
        <button
          type="button"
          onClick={() => setHideQCExcluded((v) => !v)}
          className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
            hideQCExcluded ? 'bg-gray-700 text-gray-50 border-gray-500' : 'bg-surface border-gray-600/50 text-gray-400'
          }`}
        >
          Hide QC Excluded
        </button>
      </div>

      {/* Tag / requirement filters */}
      <div className="px-4 py-2 flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-500 font-medium shrink-0">Filter:</span>
        {tagFilters.size > 0 && (
          <button
            type="button"
            onClick={() => setTagFilters(new Set())}
            className="px-3 py-1.5 rounded-full text-xs font-medium text-gray-400 hover:text-gray-50 hover:bg-gray-600/50"
          >
            Clear filters
          </button>
        )}
        {TAG_REQ_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setTagFilters((prev) => {
                const next = new Set(prev)
                if (next.has(key)) next.delete(key)
                else next.add(key)
                return next
              })
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              tagFilters.has(key)
                ? 'bg-win text-gray-900'
                : 'bg-surface border border-gray-600/50 text-gray-400 hover:text-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
        </>
      )}

      {/* Opportunity List */}
      <section className="px-4 pb-24">
        {showFullRadar ? (
          <RadarLoader phaseMessage={phaseMessage} liveCount={liveContests.length} />
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-gray-50">Opportunity List</h2>
              {liveContests.length > 0 && (
                <span className="text-sm text-gray-500">{feedContests.length} contests</span>
              )}
            </div>
            {liveContests.length === 0 ? (
              <div className="rounded-xl bg-surface border border-gray-600/50 p-6 text-center space-y-4">
                <p className="text-gray-300">No contests found. Check Console (F12) for errors.</p>
                <button
                  type="button"
                  onClick={refetch}
                  className="px-5 py-2.5 rounded-lg bg-win text-gray-900 font-semibold"
                >
                  Retry Fetch
                </button>
              </div>
            ) : feedContests.length === 0 ? (
              <div className="rounded-xl bg-surface border border-gray-600/50 p-6 text-center space-y-4">
                <p className="text-gray-300">No contests match your filters.</p>
                <button
                  type="button"
                  onClick={() => { setTagFilters(new Set()); setSearch('') }}
                  className="px-5 py-2.5 rounded-lg bg-win text-gray-900 font-semibold"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                <ul className="space-y-2">
                  {feedContests.map((c) => (
                    <ContestCard
                      key={c.id}
                      contest={c}
                      onOpenOverlay={setOverlayContest}
                      variant="feed"
                      daysLeft={daysLeft(c)}
                    />
                  ))}
                </ul>
                {!isFinished && (
                  <RadarLoader mini phaseMessage={phaseMessage} liveCount={liveContests.length} />
                )}
              </>
            )}
          </>
        )}
      </section>

      <ContestBrowser
        contest={overlayContest}
        open={!!overlayContest}
        onClose={() => setOverlayContest(null)}
        onMarkEntered={markEntered}
        autoFillData={autoFillData}
      />
    </div>
  )
}
