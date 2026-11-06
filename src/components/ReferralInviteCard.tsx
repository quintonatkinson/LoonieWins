import { useCallback, useEffect, useState } from 'react'
import { Copy, Check, Share2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'
import { rpcEnsureReferralCode } from '../lib/monetization/progression'

/**
 * Compact invite-code block for Profile Preferences + Referrals.
 * Copy / Share use the Web Share API when available.
 */
export default function ReferralInviteCard({ compact = false }: { compact?: boolean }) {
  const { user, profile } = useAuth()
  const [code, setCode] = useState<string | null>(profile?.referral_code ?? null)
  const [copied, setCopied] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!user || !isSupabaseConfigured) {
      setCode(profile?.referral_code ?? null)
      return
    }
    void (async () => {
      const ensured = await rpcEnsureReferralCode()
      setCode(ensured || profile?.referral_code || null)
    })()
  }, [user, profile?.referral_code])

  const shareText = code
    ? `Join me on LoonieWins — use my invite code ${code} when you sign up.`
    : ''

  const handleCopy = useCallback(async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setMsg('Copied!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setMsg('Could not copy — select the code manually.')
    }
  }, [code])

  const handleShare = useCallback(async () => {
    if (!code) return
    try {
      if (navigator.share) {
        await navigator.share({ title: 'LoonieWins invite', text: shareText })
        setMsg('Shared.')
        return
      }
      await navigator.clipboard.writeText(shareText)
      setMsg('Share text copied.')
    } catch {
      /* user cancelled or unsupported */
    }
  }, [code, shareText])

  if (!user) {
    return (
      <div className={compact ? '' : 'rounded-xl bg-gray-800/80 border border-gray-600/50 p-4'}>
        <p className="text-sm text-gray-400">Sign in to get your invite code.</p>
      </div>
    )
  }

  if (!code) {
    return (
      <div className={compact ? 'pt-2' : 'rounded-xl bg-gray-800/80 border border-gray-600/50 p-4'}>
        <p className="text-sm text-gray-400">Generating invite code…</p>
      </div>
    )
  }

  return (
    <div className={compact ? 'pt-2 space-y-2' : 'rounded-xl bg-gray-800/80 border border-gray-600/50 p-4 space-y-2'}>
      <p className="text-xs text-gray-500 uppercase tracking-wide">Your invite code</p>
      <p className="text-lg font-mono font-bold text-win">{code}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-win text-on-win text-sm font-semibold"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          type="button"
          onClick={() => void handleShare()}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg border border-gray-600/50 text-gray-200 text-sm font-semibold hover:bg-white/5"
        >
          <Share2 className="w-4 h-4" />
          Share
        </button>
      </div>
      {msg && <p className="text-xs text-gray-500">{msg}</p>}
    </div>
  )
}
