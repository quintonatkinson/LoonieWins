import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Package } from 'lucide-react'
import ContestCard from '../components/ContestCard'
import PageShell from '../components/PageShell'
import { getPastContests } from '../hooks/useContestVault'
import type { Contest } from '../lib/rssFetcher'
import { getExpirySortKey, isExpired } from '../lib/utils/expiryDate'

function formatEndedDay(expiryDate?: string): string | null {
  if (!expiryDate?.trim()) return null
  const day = expiryDate.trim().slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) return day
  const t = Date.parse(expiryDate)
  if (!Number.isFinite(t)) return null
  return new Date(t).toISOString().slice(0, 10)
}

export default function PastContests() {
  const [pastContests, setPastContests] = useState<Contest[]>([])

  useEffect(() => {
    setPastContests(getPastContests())
  }, [])

  useEffect(() => {
    const refresh = () => setPastContests(getPastContests())
    window.addEventListener('storage', refresh)
    window.addEventListener('loonie_vault_updated', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('loonie_vault_updated', refresh)
    }
  }, [])

  const sorted = useMemo(
    () =>
      [...pastContests].sort(
        (a, b) => getExpirySortKey(b.expiryDate) - getExpirySortKey(a.expiryDate)
      ),
    [pastContests]
  )

  const withKnownEnd = sorted.filter((c) => c.expiryDate && isExpired(c.expiryDate)).length

  return (
    <PageShell className="space-y-4" testId="past-contests">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-800 border border-gray-600/50 shrink-0">
          <Package className="w-5 h-5 text-gray-300" strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-white">Past contests</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            FOMO vault — contests that already ended
          </p>
        </div>
      </div>

      <p className="text-sm text-gray-500">
        Tap a card to open the original page. Your personal entries live under{' '}
        <Link to="/my-giveaways" className="text-win hover:underline">
          Mine
        </Link>
        ; community wins are on{' '}
        <Link to="/winners" className="text-win hover:underline">
          Winners
        </Link>
        .
      </p>

      {sorted.length > 0 && (
        <p className="text-xs text-gray-500" data-testid="past-contests-counts">
          {sorted.length} past
          {withKnownEnd > 0 ? ` · ${withKnownEnd} with end dates` : ''}
        </p>
      )}

      {sorted.length === 0 ? (
        <div className="empty-panel space-y-3" data-testid="past-empty-state">
          <p className="text-white font-medium">Vault is empty — nothing expired yet</p>
          <p className="text-sm text-gray-400 max-w-sm mx-auto">
            When live Hive Mind contests expire, they drop here so you can still peek — without
            cluttering Home. Browse Home to fill the feed first.
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-win text-on-win font-semibold text-sm"
          >
            Browse live feed
          </Link>
        </div>
      ) : (
        <div className="opacity-70 grayscale-[35%] space-y-2">
          <ul className="space-y-2">
            {sorted.map((c) => {
              const endedDay = formatEndedDay(c.expiryDate)
              return (
                <li key={c.id} className="space-y-1">
                  {endedDay && (
                    <p
                      className="text-[11px] font-medium text-red-400/90 px-1"
                      data-testid="past-ended-date"
                    >
                      Ended {endedDay}
                      {c.is_estimated_expiry ? ' · estimated' : ''}
                    </p>
                  )}
                  {!endedDay && (
                    <p className="text-[11px] text-gray-500 px-1">End date unknown</p>
                  )}
                  <ContestCard contest={c} onOpenOverlay={() => {}} variant="ended" />
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </PageShell>
  )
}
