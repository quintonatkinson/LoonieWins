import { useState, useEffect } from 'react'
import ContestCard from '../components/ContestCard'
import { getPastContests } from '../hooks/useContestVault'
import type { Contest } from '../lib/rssFetcher'

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

  const sorted = [...pastContests].sort((a, b) => {
    const da = a.expiryDate ? new Date(a.expiryDate).getTime() : 0
    const db = b.expiryDate ? new Date(b.expiryDate).getTime() : 0
    return db - da
  })

  return (
    <div className="flex flex-col bg-gray-900">
      <section className="px-4 pt-4 pb-24">
        <h2 className="text-base font-bold text-gray-50 flex items-center gap-2 mb-3">
          <span className="text-gray-400">📦</span>
          FOMO Vault — Past Contests
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Contests that have ended. Tap to view the original page.
        </p>
        {sorted.length === 0 ? (
          <div className="rounded-xl bg-surface border border-gray-600/50 p-8 text-center">
            <p className="text-gray-400">No past contests yet.</p>
            <p className="text-sm text-gray-500 mt-2">
              Expired contests will appear here once they drop off the live feed.
            </p>
          </div>
        ) : (
          <div className="opacity-60 grayscale space-y-2">
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
      </section>
    </div>
  )
}
