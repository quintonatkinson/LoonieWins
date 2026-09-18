import { useCallback, useEffect, useState } from 'react'
import { giveaways } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface ReferralLink {
  id: string
  url: string
  title?: string | null
  referrer_id?: string
  clicks_received: number
}

export default function Referrals() {
  const { user } = useAuth()
  const [links, setLinks] = useState<ReferralLink[]>([])
  const [newUrl, setNewUrl] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await giveaways()
      .from('referral_pool')
      .select('id, url, title, referrer_id, clicks_received')
      .order('created_at', { ascending: false })
    if (err) {
      setError(err.message)
      setLinks([])
    } else {
      setError(null)
      setLinks((data ?? []) as ReferralLink[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleClick = async (link: ReferralLink) => {
    window.open(link.url, '_blank', 'noopener,noreferrer')
    const nextClicks = (link.clicks_received ?? 0) + 1
    setLinks((prev) =>
      prev.map((l) => (l.id === link.id ? { ...l, clicks_received: nextClicks } : l))
    )
    // Only the referrer can update under RLS; others still get the open.
    if (user && link.referrer_id === user.id) {
      await giveaways()
        .from('referral_pool')
        .update({ clicks_received: nextClicks })
        .eq('id', link.id)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newUrl.trim()) return
    setError(null)
    const { data, error: err } = await giveaways()
      .from('referral_pool')
      .insert({
        referrer_id: user.id,
        url: newUrl.trim(),
        title: newTitle.trim() || null,
      })
      .select('id, url, title, referrer_id, clicks_received')
      .maybeSingle()
    if (err) {
      setError(err.message)
      return
    }
    if (data) setLinks((prev) => [data as ReferralLink, ...prev])
    setNewUrl('')
    setNewTitle('')
  }

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Referrals</h1>
        <p className="text-white/70 text-sm mt-1">
          I click yours, you click mine. Each click = +Karma.
        </p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="glass rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-medium">Add your link</h2>
        <input
          type="url"
          placeholder="https://…"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          required
          className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50"
        />
        <input
          type="text"
          placeholder="Title (optional)"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50"
        />
        <button type="submit" className="w-full py-2 rounded-lg bg-win text-slate-950 font-semibold">
          Add Link
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>

      <section>
        <h2 className="text-sm font-medium text-white/80 mb-3">Community links</h2>
        {loading ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : links.length === 0 ? (
          <p className="text-gray-500 text-sm">No referral links yet. Be the first.</p>
        ) : (
          <ul className="space-y-3">
            {links.map((link) => (
              <li key={link.id} className="glass rounded-xl p-4">
                <p className="font-medium text-sm line-clamp-1">{link.title || link.url}</p>
                <p className="text-xs text-white/50 truncate mt-0.5">{link.url}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-white/60">{link.clicks_received} clicks</span>
                  <button
                    type="button"
                    onClick={() => void handleClick(link)}
                    className="px-4 py-2 rounded-lg bg-win text-slate-950 font-semibold text-sm"
                  >
                    Click for Karma
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
