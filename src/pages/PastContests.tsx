import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Package } from 'lucide-react'
import ContestCard from '../components/ContestCard'
import PageShell from '../components/PageShell'
import { getPastContests } from '../hooks/useContestVault'
import type { Contest } from '../lib/rssFetcher'
import { getExpirySortKey } from '../lib/utils/expiryDate'

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

  const sorted = [...pastContests].sort(
    (a, b) => getExpirySortKey(b.expiryDate) - getExpirySortKey(a.expiryDate)
  )

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

      {sorted.length === 0 ? (
        <div className="empty-panel space-y-3">
          <p className="text-white font-medium">No past contests yet</p>
          <p className="text-sm text-gray-400 max-w-sm mx-auto">
            When live Hive Mind contests expire, they drop here so you can still peek — without
            cluttering Home.
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
            {sorted.map((c) => (
              <ContestCard
                key={c.id}
                contest={c}
                onOpenOverlay={() => {}}
                variant="ended"
              />
            ))}
          </ul>
        </div>
      )}
    </PageShell>
  )
}
