import { useCallback, useEffect, useState } from 'react'
import { giveaways, isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useUserEarn } from '../contexts/UserEarnContext'
import {
  REFERRAL_CLICK_POINTS,
  REFERRAL_SIGNUP_REFEREE_POINTS,
  REFERRAL_SIGNUP_REFERRER_POINTS,
} from '../lib/monetization/tiers'
import {
  rpcApplyReferralCode,
  rpcCreditReferralClick,
  rpcEnsureReferralCode,
} from '../lib/monetization/progression'
import ReferralInviteCard from '../components/ReferralInviteCard'

interface ReferralLink {
  id: string
  url: string
  title?: string | null
  referrer_id?: string
  clicks_received: number
}

export default function Referrals() {
  const { user, profile, refreshProfile } = useAuth()
  const { balance } = useUserEarn()
  const [links, setLinks] = useState<ReferralLink[]>([])
  const [newUrl, setNewUrl] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [myCode, setMyCode] = useState<string | null>(profile?.referral_code ?? null)
  const [error, setError] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [addedToast, setAddedToast] = useState(false)

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLinks([])
      setLoading(false)
      setError('Cloud referrals need Supabase configured.')
      return
    }
    setLoading(true)
    try {
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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setLinks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return
    void (async () => {
      const code = await rpcEnsureReferralCode()
      if (code) setMyCode(code)
      else if (profile?.referral_code) setMyCode(profile.referral_code)
    })()
  }, [user, profile?.referral_code])

  const handleClick = async (link: ReferralLink) => {
    window.open(link.url, '_blank', 'noopener,noreferrer')
    setStatusMsg(null)

    if (!user || !isSupabaseConfigured) {
      setStatusMsg('Sign in to credit the referrer with points.')
      return
    }

    const res = await rpcCreditReferralClick(link.id)
    if (res.ok) {
      setLinks((prev) =>
        prev.map((l) =>
          l.id === link.id ? { ...l, clicks_received: (l.clicks_received ?? 0) + 1 } : l
        )
      )
      setStatusMsg(`Referrer credited +${res.points_awarded ?? REFERRAL_CLICK_POINTS} pts.`)
      await refreshProfile()
      return
    }

    if (res.reason === 'self_click') {
      setStatusMsg('Self-clicks do not pay points.')
    } else if (res.reason === 'already_credited') {
      setStatusMsg('You already credited this link (one payout per friend per link).')
    } else {
      setStatusMsg(res.reason || 'Could not credit referral.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newUrl.trim()) return
    setError(null)
    if (!isSupabaseConfigured) {
      setError('Cloud referrals need Supabase configured.')
      return
    }
    try {
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
      setAddedToast(true)
      setTimeout(() => setAddedToast(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleApplyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatusMsg(null)
    const res = await rpcApplyReferralCode(inviteCode)
    if (res.ok) {
      setStatusMsg(
        `Welcome bonus +${res.referee_points ?? REFERRAL_SIGNUP_REFEREE_POINTS} pts applied. Friend earned +${res.referrer_points ?? REFERRAL_SIGNUP_REFERRER_POINTS}.`
      )
      setInviteCode('')
      await refreshProfile()
      return
    }
    setStatusMsg(res.reason || 'Invalid code')
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      <div>
        <h1 className="text-xl font-semibold text-gray-50">Referrals</h1>
        <p className="text-gray-400 text-sm mt-1">
          Real points, not karma. Click credit = +{REFERRAL_CLICK_POINTS} pts to the link owner
          (once per friend). Invite code: you +{REFERRAL_SIGNUP_REFEREE_POINTS}, friend +
          {REFERRAL_SIGNUP_REFERRER_POINTS}.
        </p>
        <p className="text-amber-400 text-sm mt-2">Balance: {balance.toLocaleString()} Pts</p>
      </div>

      <ReferralInviteCard />

      {!myCode && user && (
        <p className="text-xs text-gray-500">Invite code loads after sign-in sync.</p>
      )}

      <form onSubmit={(e) => void handleApplyCode(e)} className="glass rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-medium text-gray-50">Have an invite code?</h2>
        <input
          type="text"
          placeholder="Enter code"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50"
        />
        <button type="submit" className="w-full py-2 rounded-lg bg-win text-on-win font-semibold">
          Claim signup bonus
        </button>
      </form>

      <form onSubmit={(e) => void handleSubmit(e)} className="glass rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-medium text-gray-50">Add your contest link</h2>
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
        <button type="submit" className="w-full py-2 rounded-lg bg-win text-on-win font-semibold">
          Add Link
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {addedToast && (
          <p className="text-sm text-win" role="status">
            Link added. Friends who click earn you +{REFERRAL_CLICK_POINTS} pts (once each).
          </p>
        )}
      </form>

      {statusMsg && (
        <p className="text-sm text-amber-300" role="status">
          {statusMsg}
        </p>
      )}

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
                <p className="font-medium text-sm text-gray-50 line-clamp-1">{link.title || link.url}</p>
                <p className="text-xs text-gray-500 truncate mt-0.5">{link.url}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-gray-400">
                    {link.clicks_received} paid clicks · +{REFERRAL_CLICK_POINTS} pts each
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleClick(link)}
                    className="px-4 py-2 rounded-lg bg-win text-on-win font-semibold text-sm"
                  >
                    Click for points
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
