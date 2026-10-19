import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Archive } from 'lucide-react'
import ContestCard from '../components/ContestCard'
import PageHeader from '../components/PageHeader'
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
    <div className="flex flex-col bg-gray-900" data-testid="past-contests">
      <section className="px-4 pt-4 pb-24 max-w-3xl mx-auto w-full space-y-4">
        <PageHeader
          icon={<Archive className="w-5 h-5 text-win" strokeWidth={2.5} />}
          title="Past contests"
          subtitle={
            <p>
              FOMO vault — ended contests on this device.
              {sorted.length > 0 && (
                <span data-testid="past-contests-counts">
                  {' '}
                  {sorted.length} past
                  {withKnownEnd > 0 ? ` · ${withKnownEnd} with end dates` : ''}
                </span>
              )}
            </p>
          }
        />
        {sorted.length === 0 ? (
          <div
            className="rounded-xl border border-dashed border-gray-600/60 bg-surface px-4 py-10 text-center space-y-3"
            data-testid="past-empty-state"
          >
            <p className="text-white font-medium">Vault is empty — nothing expired yet</p>
            <p className="text-sm text-gray-400 max-w-sm mx-auto">
              When live contests end, they drop here so you can still open the sponsor page. Browse
              Home to fill the Hive Mind feed first.
            </p>
            <Link
              to="/"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-win text-on-win font-semibold text-sm"
            >
              Browse live contests
            </Link>
            <p className="text-xs text-gray-500">
              Tracking what you entered? That lives on{' '}
              <Link to="/my-giveaways" className="text-win hover:underline">
                My Giveaways
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="opacity-80 space-y-2">
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
                    <ContestCard
                      contest={c}
                      onOpenOverlay={() => {}}
                      variant="ended"
                    />
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
