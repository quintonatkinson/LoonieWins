import { useState, useCallback, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import type { Contest } from '../lib/rssFetcher'
import { useUserLimits } from '../hooks/useUserLimits'
import { useUserEarn } from '../contexts/UserEarnContext'
import SubscriptionModal from './SubscriptionModal'
import CountdownTimer from './CountdownTimer'

interface ContestCardProps {
  contest: Contest
  onOpenOverlay: (contest: Contest) => void
  variant: 'routine' | 'feed' | 'ended'
  daysLeft?: number | null
}

export default function ContestCard({ contest, onOpenOverlay, variant, daysLeft: daysLeftProp }: ContestCardProps) {
  const navigate = useNavigate()
  const {
    dailyLimitReached,
    userIsFree,
    canEnterFree,
    hasUnlimitedEntries,
    balance,
    entryCostPts,
    spendPointsForEntry,
    useFreeEntry,
  } = useUserLimits()

  const [showInsufficient, setShowInsufficient] = useState(false)
  const [showSubscription, setShowSubscription] = useState(false)
  const [toast, setToast] = useState(false)
  const { setSubscriptionTier } = useUserEarn()

  const daysLeft =
    daysLeftProp ??
    (contest.expiryDate
      ? Math.max(0, Math.ceil((new Date(contest.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(false), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const handleEnter = useCallback(() => {
    if (contest.id === '__offline_alert__') return
    if (variant === 'ended') {
      window.open(contest.url, '_blank', 'noopener,noreferrer')
      return
    }
    if (contest.isLocked) {
      window.open(contest.url, '_blank', 'noopener,noreferrer')
      return
    }
    if (hasUnlimitedEntries) {
      onOpenOverlay(contest)
      return
    }
    if (canEnterFree) {
      useFreeEntry()
      onOpenOverlay(contest)
      return
    }
    if (dailyLimitReached && userIsFree) {
      if (balance >= entryCostPts && spendPointsForEntry()) {
        onOpenOverlay(contest)
        setToast(true)
      } else {
        setShowInsufficient(true)
      }
    }
  }, [
    contest,
    variant,
    hasUnlimitedEntries,
    canEnterFree,
    dailyLimitReached,
    userIsFree,
    balance,
    entryCostPts,
    spendPointsForEntry,
    useFreeEntry,
    onOpenOverlay,
  ])

  const showUnlock =
    contest.id !== '__offline_alert__' && dailyLimitReached && userIsFree && !hasUnlimitedEntries

  const goToEarn = useCallback(() => {
    setShowInsufficient(false)
    navigate('/earn')
  }, [navigate])

  if (contest.id === '__offline_alert__') {
    if (variant === 'routine') return null
    return (
      <li className="rounded-xl bg-surface border border-gray-600/50 px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-50 text-sm">{contest.title}</p>
        </div>
      </li>
    )
  }

  const isLocked = contest.isLocked === true
  const button = variant === 'ended' ? (
    <button
      type="button"
      onClick={handleEnter}
      className="shrink-0 px-5 py-2.5 rounded-lg bg-gray-600 text-gray-400 font-semibold text-sm cursor-pointer"
    >
      Ended
    </button>
  ) : showUnlock ? (
    <button
      type="button"
      onClick={handleEnter}
      className="shrink-0 px-4 py-2.5 rounded-lg bg-amber-500/20 text-amber-400 font-semibold text-sm border border-amber-500/40 hover:bg-amber-500/30"
    >
      UNLOCK ({entryCostPts} Pts)
    </button>
  ) : (
    <button
      type="button"
      onClick={handleEnter}
      className="shrink-0 px-5 py-2.5 rounded-lg bg-win text-gray-900 font-semibold text-sm"
    >
      {isLocked ? 'View on RFD' : 'Enter'}
    </button>
  )

  const toastEl = toast ? (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-win text-gray-900 font-medium text-sm shadow-lg">
      Entry Unlocked!
    </div>
  ) : null

  const insufficientEl = showInsufficient ? (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setShowInsufficient(false)} aria-hidden />
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm rounded-2xl glass border border-gray-600/50 p-6"
        role="dialog"
        aria-modal
      >
        <p className="text-gray-50 font-medium">Insufficient Funds</p>
        <p className="text-gray-400 text-sm mt-2">
          Not enough points. Do 1 Survey to unlock 2.5 Entries!
        </p>
        <button
          type="button"
          onClick={goToEarn}
          className="mt-4 w-full py-2.5 rounded-lg bg-amber-500/20 text-amber-400 font-semibold border border-amber-500/40"
        >
          Go to Earn
        </button>
        <button
          type="button"
          onClick={() => { setShowInsufficient(false); setShowSubscription(true); }}
          className="mt-2 w-full py-2 text-amber-400/90 text-sm font-medium"
        >
          Subscribe for unlimited
        </button>
        <button type="button" onClick={() => setShowInsufficient(false)} className="mt-1 w-full py-2 text-gray-400 text-sm">
          Cancel
        </button>
      </div>
    </>
  ) : null

  const subscriptionModal = (
    <SubscriptionModal
      open={showSubscription}
      onClose={() => setShowSubscription(false)}
      onSelectPlan={(planId) => setSubscriptionTier(planId)}
    />
  )

  const overlayPortal = (el: ReactNode) =>
    typeof document !== 'undefined' && el ? createPortal(el, document.body) : null

  const elig = contest.eligibility ?? 'Unknown'
  // Use maple leaf for CA/Unknown — 🇨🇦 often renders as "CA" on Windows
  const eligDisplay =
    elig === 'CA' ? '🍁' :
    elig === 'US' ? '🇺🇸' :
    elig === 'NA' ? '🌎' :
    '🍁' // Unknown = assume Canadian suppliers
  const eligUnverified = contest.eligibilityUnverified ?? false
  const reqs = contest.requirements ?? []
  const reqLabels: Record<string, string> = {
    'Purchase Required': 'Purchase Required',
    'Social Action': 'Social Follow',
    'App Download': 'App Download',
    'Creative Submission': 'Photo Needed',
    'Newsletter Signup': 'Newsletter',
  }

  if (variant === 'routine') {
    return (
      <>
        <button
          type="button"
          onClick={handleEnter}
          className="shrink-0 w-52 rounded-xl bg-surface border border-gray-600/50 p-4 text-left flex flex-col gap-3"
        >
          <span className="font-semibold text-gray-50 line-clamp-2 text-sm leading-tight">{contest.title}</span>
          <span
            className={`mt-auto w-full py-2.5 rounded-lg font-semibold text-sm text-center ${
              showUnlock ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-win text-gray-900'
            }`}
          >
            {variant === 'ended' ? 'Ended' : showUnlock ? `UNLOCK (${entryCostPts} Pts)` : isLocked ? 'View on RFD' : 'Enter'}
          </span>
        </button>
        {toastEl}
        {insufficientEl}
        {subscriptionModal}
      </>
    )
  }

  return (
    <>
      <li className="rounded-xl bg-surface border border-gray-600/50 px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <span className="text-xs text-gray-500 font-medium">Single</span>
          <p className="font-semibold text-gray-50 text-sm line-clamp-2">{contest.title}</p>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-400">
            {contest.prizeValue != null && (
              <span>
                <span className="text-win">$</span>
                <span className="text-gray-300">{contest.prizeValue.toLocaleString()}</span>
              </span>
            )}
            {contest.expiryDate ? (
              <CountdownTimer targetDate={contest.expiryDate} />
            ) : daysLeft != null ? (
              <span className="flex items-center gap-1 text-gray-400">
                <span aria-hidden>🕐</span>
                {daysLeft}d left
              </span>
            ) : null}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${
                elig === 'US' ? 'bg-red-500/20 text-red-400 border border-red-500/40' :
                eligUnverified ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                'bg-gray-600/50 text-gray-400'
              }`}
              title={
                eligUnverified ? 'Eligibility unverified' :
                elig === 'CA' ? 'Canada' : elig === 'US' ? 'United States' : elig === 'NA' ? 'North America' :
                'Canada (default – Canadian suppliers)'
              }
              aria-label={
                elig === 'CA' ? 'Canada' : elig === 'US' ? 'United States' : elig === 'NA' ? 'North America' : 'Canada (default)'
              }
            >
              {eligDisplay}{eligUnverified ? ' ?' : ''}
            </span>
            {contest.source && (
              <span>{contest.source.replace(/\s*\([^)]*\)/g, '')}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {isLocked && (
              <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/40">
                🔒 RFD Account Required
              </span>
            )}
            {reqs.length === 0 ? (
              <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-win/20 text-win border border-win/40">
                Easy Entry
              </span>
            ) : (
              reqs.map((r) => {
                const label = reqLabels[r] ?? r
                const icon = r === 'Purchase Required' ? '🧾' : r === 'Social Action' ? '📱' : r === 'Creative Submission' ? '📸' : r === 'App Download' ? '📲' : r === 'Newsletter Signup' ? '📧' : ''
                return (
                  <span
                    key={r}
                    className="rounded-full px-2 py-0.5 text-xs font-medium bg-gray-600/50 text-gray-300 border border-gray-500/50"
                  >
                    {icon ? `${icon} ` : ''}{label}
                  </span>
                )
              })
            )}
          </div>
        </div>
        {button}
      </li>
      {overlayPortal(toastEl)}
      {overlayPortal(insufficientEl)}
      {overlayPortal(subscriptionModal)}
    </>
  )
}
