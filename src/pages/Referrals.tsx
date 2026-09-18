import { useState } from 'react'

interface ReferralLink {
  id: string
  url: string
  title?: string
  referrerId?: string
  clicksReceived: number
}

// Mock list – replace with Supabase from referral_pool
const MOCK_REFERRALS: ReferralLink[] = [
  { id: '1', url: 'https://example.com/contest-a', title: 'Contest A', clicksReceived: 12 },
  { id: '2', url: 'https://example.com/contest-b', title: 'Contest B', clicksReceived: 8 },
]

export default function Referrals() {
  const [links, setLinks] = useState<ReferralLink[]>(MOCK_REFERRALS)
  const [newUrl, setNewUrl] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [addedToast, setAddedToast] = useState(false)

  const handleClick = (link: ReferralLink) => {
    window.open(link.url, '_blank', 'noopener,noreferrer')
    // In real app: call Supabase to increment clicks_received / karma
    setLinks((prev) =>
      prev.map((l) =>
        l.id === link.id ? { ...l, clicksReceived: l.clicksReceived + 1 } : l
      )
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUrl.trim()) return
    setLinks((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        url: newUrl.trim(),
        title: newTitle.trim() || undefined,
        clicksReceived: 0,
      },
    ])
    setNewUrl('')
    setNewTitle('')
    setAddedToast(true)
    setTimeout(() => setAddedToast(false), 2500)
  }

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-50">Referrals</h1>
        <p className="text-gray-400 text-sm mt-1">I click yours, you click mine. Each click = +Karma.</p>
      </div>

      <form onSubmit={handleSubmit} className="glass rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-medium text-gray-50">Add your link</h2>
        <input
          type="url"
          placeholder="https://…"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50"
          required
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
        {addedToast && (
          <p className="text-sm text-win" role="status">
            Link added to the community list.
          </p>
        )}
      </form>

      <section>
        <h2 className="text-sm font-medium text-gray-300 mb-3">Community links</h2>
        <ul className="space-y-3">
          {links.map((link) => (
            <li key={link.id} className="glass rounded-xl p-4">
              <p className="font-medium text-sm text-gray-50 line-clamp-1">{link.title || link.url}</p>
              <p className="text-xs text-gray-500 truncate mt-0.5">{link.url}</p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-gray-400">{link.clicksReceived} clicks</span>
                <button
                  type="button"
                  onClick={() => handleClick(link)}
                  className="px-4 py-2 rounded-lg bg-win text-slate-950 font-semibold text-sm"
                >
                  Click for Karma
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
