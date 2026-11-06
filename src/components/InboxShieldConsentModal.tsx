import { useEffect, useId, useState } from 'react'
import { Mail, ShieldCheck } from 'lucide-react'
import { suggestPlusAddress } from '../lib/inboxShield/rulesEngine'

export type InboxShieldConsentChoice = 'local' | 'skipped' | 'gmail_wishlist'

interface InboxShieldConsentModalProps {
  open: boolean
  suggestedEmail?: string
  onClose: () => void
  onChoose: (choice: InboxShieldConsentChoice, entryEmail: string) => void
}

export default function InboxShieldConsentModal({
  open,
  suggestedEmail = '',
  onClose,
  onChoose,
}: InboxShieldConsentModalProps) {
  const titleId = useId()
  const [entryEmail, setEntryEmail] = useState(suggestedEmail)

  useEffect(() => {
    if (open) setEntryEmail(suggestedEmail)
  }, [open, suggestedEmail])

  if (!open) return null

  const plusTip = suggestPlusAddress(entryEmail || suggestedEmail)

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-[80] backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[90] w-[min(92vw,420px)] max-h-[90vh] overflow-y-auto rounded-2xl bg-gray-900 border border-win/30 p-6 shadow-xl"
        role="dialog"
        aria-modal
        aria-labelledby={titleId}
        data-testid="inbox-shield-consent-modal"
      >
        <div className="flex items-center gap-3 mb-3">
          <span className="flex items-center justify-center w-10 h-10 rounded-full bg-win/15 border border-win/40">
            <ShieldCheck className="w-5 h-5 text-win" />
          </span>
          <div>
            <h2 id={titleId} className="text-lg font-bold text-white">
              Inbox Shield
            </h2>
            <p className="text-xs text-gray-500">Keep giveaway mail under control</p>
          </div>
        </div>

        <ul className="text-sm text-gray-300 space-y-2.5 mb-4 list-disc pl-5">
          <li>
            We use <strong className="text-white font-medium">your entry email</strong> so
            confirmations and wins can be tracked with contests you enter here.
          </li>
          <li>
            We help you <strong className="text-white font-medium">not miss wins</strong> buried in
            Gmail Spam or Promotions — once you connect Google (coming soon).
          </li>
          <li>
            We organize giveaway mail so your{' '}
            <strong className="text-white font-medium">main inbox stays clean</strong> — not 100
            brands flooding Primary when you enter a lot of sweeps.
          </li>
        </ul>

        <p className="text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-4">
          Honest status: LoonieWins cannot read Gmail until you connect Google sign-in with Gmail
          permissions (Phase 2). Today we save your choices and show how mail will be sorted.
        </p>

        <label className="block mb-4">
          <span className="text-xs text-gray-400 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" />
            Entry email for giveaways
          </span>
          <input
            type="email"
            value={entryEmail}
            onChange={(e) => setEntryEmail(e.target.value)}
            placeholder="you@gmail.com"
            className="mt-1 w-full px-3 py-2.5 rounded-lg bg-gray-950 border border-gray-600/50 text-white text-sm"
            autoComplete="email"
          />
          {plusTip && (
            <p className="text-[11px] text-gray-500 mt-1.5">
              Tip: use a dedicated address or Gmail plus-tag like{' '}
              <code className="text-win/90">{plusTip}</code> so filters stay simple.
            </p>
          )}
        </label>

        <div className="space-y-2">
          <button
            type="button"
            disabled
            title="Google OAuth + Gmail API scopes are not set up yet (Phase 2)."
            className="w-full py-3 px-4 rounded-xl border border-gray-600/50 bg-gray-800/40 text-left opacity-60 cursor-not-allowed"
          >
            <p className="text-sm font-semibold text-gray-300">Connect Gmail</p>
            <p className="text-xs text-gray-500 mt-0.5">Coming after Google Cloud OAuth setup</p>
          </button>

          <button
            type="button"
            onClick={() => onChoose('local', entryEmail)}
            className="w-full py-3 px-4 rounded-xl bg-win text-on-win font-semibold text-sm text-left"
          >
            Use entry email only (on this device)
          </button>
          <p className="text-[11px] text-gray-500 px-1">
            Saves your email &amp; Inbox Shield prefs locally and to your LoonieWins account when
            signed in. No Gmail access yet.
          </p>

          <button
            type="button"
            onClick={() => onChoose('skipped', entryEmail)}
            className="w-full py-2.5 rounded-lg text-gray-400 hover:text-white text-sm"
          >
            Skip for now
          </button>
        </div>
      </div>
    </>
  )
}
