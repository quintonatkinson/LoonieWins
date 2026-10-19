import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, ExternalLink, Check, FileSpreadsheet, History } from 'lucide-react'
import { useContestEntries, type ContestEntryStatus } from '../hooks/useContestEntries'
import { useAuth } from '../contexts/AuthContext'
import { useUserEarn } from '../contexts/UserEarnContext'
import { downloadAppliedContestsCsv } from '../lib/account/exportAppliedCsv'
import { hasFeature } from '../lib/monetization/tiers'
import { daysLeftUntilExpiry, isExpired } from '../lib/utils/expiryDate'
import { isCurrentContestEntry } from '../lib/utils/contestEntryScope'
import SubscriptionModal from '../components/SubscriptionModal'

type ScopeTab = 'current' | 'all'
type StatusFilter = 'all' | ContestEntryStatus

function formatPrize(v: number | null | undefined): string | undefined {
  if (v == null || Number.isNaN(v)) return undefined
  if (v >= 1000) return `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K`
  return `$${Math.round(v)}`
}

function statusLabel(s: ContestEntryStatus): string {
  switch (s) {
    case 'submitted':
      return 'Submitted'
    case 'won':
      return 'Won'
    case 'lost':
      return 'Lost'
    case 'expired':
      return 'Expired'
    default:
      return 'Entered'
  }
}

export default function MyGiveaways() {
  const { entries, updateStatus, removeEntry } = useContestEntries()
  const { profile } = useAuth()
  const { subscriptionTier } = useUserEarn()
  const [scope, setScope] = useState<ScopeTab>('current')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [showPlanModal, setShowPlanModal] = useState(false)

  const activeCount = useMemo(
    () => entries.filter(isCurrentContestEntry).length,
    [entries]
  )
  const allTimeCount = entries.length

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries
      .filter((e) => (scope === 'current' ? isCurrentContestEntry(e) : true))
      .filter((e) => (statusFilter === 'all' ? true : e.status === statusFilter))
      .filter((e) => (!q ? true : (e.title || e.contest_id).toLowerCase().includes(q)))
      .map((e) => {
        const expiresAt = e.expires_at
        const expiredByDate = isExpired(expiresAt)
        const daysLeft = daysLeftUntilExpiry(expiresAt)
        let endsLabel: string | null = null
        if (expiresAt) {
          const day = expiresAt.slice(0, 10)
          if (expiredByDate || e.status === 'expired') endsLabel = `Ended ${day}`
          else if (daysLeft === 0) endsLabel = `Ends today (${day})`
          else if (daysLeft === 1) endsLabel = `Ends tomorrow (${day})`
          else if (daysLeft != null) endsLabel = `Ends ${day} · ${daysLeft}d left`
          else endsLabel = `Ends ${day}`
        }
        return {
          id: e.contest_id,
          title: e.title || e.contest_id,
          enteredAt: e.entered_at.slice(0, 10),
          prizeValue: formatPrize(e.prize_value),
          ended: e.status === 'expired' || e.status === 'lost' || expiredByDate,
          endsLabel,
          status: e.status,
          url: e.contest_url,
        }
      })
  }, [entries, scope, statusFilter, search])

  const canExportCsv = hasFeature(profile?.feature_flags, 'export_csv', {
    tier: subscriptionTier,
    isPremium: profile?.is_premium,
  })

  const handleExportCsv = () => {
    if (!canExportCsv) {
      setShowPlanModal(true)
      return
    }
    downloadAppliedContestsCsv(
      entries.map((e) => ({
        contest_id: e.contest_id,
        title: e.title,
        status: e.status,
        entered_at: e.entered_at,
        submitted_at: e.submitted_at,
        prize_value: e.prize_value,
        contest_url: e.contest_url,
        expires_at: e.expires_at,
      }))
    )
  }

  const emptyCopy =
    scope === 'current'
      ? {
          title: 'No active giveaways yet',
          body: 'Enter from Home to see them here. Open a contest, then Mark Entered — it lands on Current until it ends.',
        }
      : {
          title: 'No giveaways tracked yet',
          body: 'Enter from Home to build your history. Everything you mark entered stays in All-time.',
        }

  return (
    <div className="p-4 space-y-4 pb-24" data-testid="my-giveaways">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-win/20 border border-win/40 shrink-0">
            <Trophy className="w-5 h-5 text-win" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-white">My Giveaways</h1>
            <p
              className="text-sm text-gray-400 mt-0.5"
              data-testid="my-giveaways-counts"
            >
              {activeCount} active · {allTimeCount} all-time
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={entries.length === 0 && canExportCsv}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
            canExportCsv
              ? 'border-win/40 text-win hover:bg-win/10 disabled:opacity-40'
              : 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10'
          }`}
          title={
            canExportCsv
              ? 'Download as CSV'
              : 'Pro unlocks CSV export of My Giveaways'
          }
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          {canExportCsv ? 'Export CSV' : 'CSV · Pro'}
        </button>
      </div>

      {/* Current / All-time */}
      <div
        className="flex rounded-xl bg-surface border border-gray-600/50 p-1 gap-1"
        role="tablist"
        aria-label="Giveaway scope"
      >
        {(
          [
            ['current', 'Current', activeCount],
            ['all', 'All-time', allTimeCount],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={scope === key}
            onClick={() => setScope(key)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              scope === key
                ? 'bg-win text-on-win'
                : 'text-gray-400 hover:text-gray-50'
            }`}
            data-testid={`my-giveaways-tab-${key}`}
          >
            {label}
            <span className={`ml-1.5 text-xs ${scope === key ? 'opacity-80' : 'text-gray-500'}`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['all', 'All'],
            ['entered', 'Entered'],
            ['submitted', 'Submitted'],
            ['won', 'Won'],
            ['lost', 'Lost'],
            ['expired', 'Expired'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatusFilter(key)}
            className={`px-3 py-1 rounded-full text-xs font-medium border ${
              statusFilter === key
                ? 'bg-win text-on-win border-win'
                : 'border-gray-600/50 text-gray-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search your giveaways…"
        className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-600/50 text-white text-sm"
        aria-label="Search giveaways"
      />

      <ul className="space-y-2">
        {visible.length === 0 ? (
          <li className="rounded-xl border border-dashed border-gray-600/60 bg-gray-800/40 px-4 py-8 text-center space-y-3">
            <p className="text-white font-medium">{emptyCopy.title}</p>
            <p className="text-sm text-gray-400 max-w-sm mx-auto">{emptyCopy.body}</p>
            <Link
              to="/"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-win text-on-win font-semibold text-sm"
            >
              Enter from Home
            </Link>
            {scope === 'current' && allTimeCount > 0 && (
              <button
                type="button"
                onClick={() => setScope('all')}
                className="block mx-auto text-xs text-win hover:underline"
              >
                View All-time history ({allTimeCount})
              </button>
            )}
          </li>
        ) : (
          visible.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border-2 border-win/40 bg-gray-800/60 px-4 py-3 space-y-2"
              data-testid="my-giveaway-card"
            >
              <div className="flex items-center gap-3">
                <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-win/20">
                  <Check className="w-4 h-4 text-win" strokeWidth={3} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white line-clamp-1">{c.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {c.prizeValue && (
                      <span className="text-xs font-semibold text-win">{c.prizeValue}</span>
                    )}
                    <span className="text-xs text-gray-400">Entered {c.enteredAt}</span>
                    {c.endsLabel ? (
                      <span
                        className={`text-xs ${c.ended ? 'text-red-400' : 'text-amber-300'}`}
                        data-testid="my-giveaway-ends"
                      >
                        {c.endsLabel}
                      </span>
                    ) : c.ended ? (
                      <span className="text-xs text-red-400">Ended</span>
                    ) : (
                      <span className="text-xs text-gray-500">End date unknown</span>
                    )}
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-win/20 text-win">
                      {statusLabel(c.status)}
                    </span>
                  </div>
                </div>
                {c.url && (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 p-2 rounded-lg text-win hover:bg-win/10 transition-colors"
                    aria-label="Open contest"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
              <div className="flex flex-wrap gap-2 pl-11">
                {c.status === 'entered' && (
                  <button
                    type="button"
                    onClick={() => void updateStatus(c.id, 'submitted')}
                    className="text-xs px-2 py-1 rounded border border-win/40 text-win"
                  >
                    Mark submitted
                  </button>
                )}
                {c.status !== 'won' && (
                  <button
                    type="button"
                    onClick={() => void updateStatus(c.id, 'won')}
                    className="text-xs px-2 py-1 rounded border border-gray-600/50 text-gray-300"
                  >
                    Won
                  </button>
                )}
                {c.status !== 'lost' && (
                  <button
                    type="button"
                    onClick={() => void updateStatus(c.id, 'lost')}
                    className="text-xs px-2 py-1 rounded border border-gray-600/50 text-gray-300"
                  >
                    Lost
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void removeEntry(c.id)}
                  className="text-xs px-2 py-1 rounded border border-red-500/40 text-red-400"
                >
                  Remove
                </button>
              </div>
            </li>
          ))
        )}
      </ul>

      <p className="text-xs text-gray-500 flex items-center gap-1.5 pt-2">
        <History className="w-3.5 h-3.5 shrink-0" />
        Platform expired vault (FOMO) lives on{' '}
        <Link to="/past" className="text-win hover:underline">
          Past
        </Link>
        — this page is only what you entered.
      </p>

      <SubscriptionModal
        open={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        onSelectPlan={() => setShowPlanModal(false)}
        showComparison
      />
    </div>
  )
}
