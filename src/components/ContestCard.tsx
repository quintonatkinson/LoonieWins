import { useState, useCallback, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import type { Contest } from '../lib/rssFetcher'
import { useUserLimits } from '../hooks/useUserLimits'
import { useUserEarn } from '../contexts/UserEarnContext'
import SubscriptionModal from './SubscriptionModal'
import CountdownTimer from './CountdownTimer'
import { daysLeftUntilExpiry } from '../lib/utils/expiryDate'
import {
  badgeToneClass,
  getRequirementBadges,
} from '../lib/utils/requirementBadges'

interface ContestCardProps {
  contest: Contest
  onOpenOverlay: (contest: Contest) => void
  /** One-tap Enter: open contest + auto-mark on return */
  onOneTapEnter?: (contest: Contest) => void
  onShare?: (contest: Contest) => void
  variant: 'routine' | 'feed' | 'ended'
  daysLeft?: number | null
  entered?: boolean
}

export default function ContestCard({
  contest,
  onOpenOverlay,
  onOneTapEnter,
  onShare,
  variant,
  daysLeft: daysLeftProp,
  entered = false,
}: ContestCardProps) {
  const navigate = useNavigate()
  const {
    weeklyLimitReached,
    userIsFree,
    canEnterFree,
    hasUnlimitedEntries,
    balance,
    entryCostPts,
    spendPointsForEntry,
    useFreeEntry,
    weeklyEntriesUsed,
    weeklyEntryCap,
  } = useUserLimits()

  const [showInsufficient, setShowInsufficient] = useState(false)
  const [showSubscription, setShowSubscription] = useState(false)
  const [toast, setToast] = useState(false)
  const { upgradeToPro } = useUserEarn()

  const daysLeft = daysLeftProp ?? daysLeftUntilExpiry(contest.expiryDate)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(false), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const openEntry = useCallback(() => {
    if (onOneTapEnter) {
      onOneTapEnter(contest)
      return
    }
    onOpenOverlay(contest)
  }, [contest, onOneTapEnter, onOpenOverlay])

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
      openEntry()
      return
    }
    if (canEnterFree) {
      // Open first so guest/demo never blocks on bookkeeping
      openEntry()
      try {
        void useFreeEntry()
      } catch (_) {}
      return
    }
    if (weeklyLimitReached && userIsFree) {
      if (balance >= entryCostPts && spendPointsForEntry()) {
        openEntry()
        setToast(true)
      } else {
        setShowInsufficient(true)
      }
      return
    }
    // Fallback: never dead-end the Enter CTA
    openEntry()
  }, [
    contest,
    variant,
    hasUnlimitedEntries,
    canEnterFree,
    weeklyLimitReached,
    userIsFree,
    balance,
    entryCostPts,
    spendPointsForEntry,
    useFreeEntry,
    openEntry,
  ])

  const showUnlock =
    contest.id !== '__offline_alert__' && weeklyLimitReached && userIsFree && !hasUnlimitedEntries

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
  const tags = contest.tags ?? []
  const entryTypeLabel = tags.includes('Daily')
    ? 'Daily'
    : tags.includes('Weekly')
      ? 'Weekly'
      : tags.includes('Instant Win')
        ? 'Instant Win'
        : tags.includes('1 Single Entry')
          ? 'Single'
          : 'Contest'
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
      className="shrink-0 px-5 py-2.5 rounded-lg bg-win text-on-win font-semibold text-sm"
    >
      {isLocked ? 'View on RFD' : 'Enter'}
    </button>
  )

  const toastEl = toast ? (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-win text-on-win font-medium text-sm shadow-lg">
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
        <p className="text-gray-50 font-medium">Weekly free entries used</p>
        <p className="text-gray-400 text-sm mt-2">
          Free tier: {weeklyEntriesUsed}/{weeklyEntryCap ?? '∞'} entries this week. Spend{' '}
          {entryCostPts} pts for another, earn more on Earn, or go Pro for unlimited.
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
      onSelectPlan={(planId) => void upgradeToPro(planId)}
      showComparison
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
  const reqBadges = getRequirementBadges(contest)

  if (variant === 'routine') {
    return (
      <>
        <div className="shrink-0 w-52 rounded-xl bg-surface border border-gray-600/50 p-4 text-left flex flex-col gap-3">
          <button type="button" onClick={handleEnter} className="text-left flex flex-col gap-2 flex-1">
            <div className="flex flex-wrap gap-1">
              {reqBadges
                .filter((b) => b.costly)
                .slice(0, 1)
                .map((b) => (
                  <span
                    key={b.kind}
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badgeToneClass(b)}`}
                  >
                    {b.icon} {b.kind === 'purchase' ? 'Purchase' : b.label}
                  </span>
                ))}
              {contest.expiryDate && <CountdownTimer targetDate={contest.expiryDate} />}
            </div>
            <span className="font-semibold text-gray-50 line-clamp-2 text-sm leading-tight">{contest.title}</span>
            <span
              className={`mt-auto w-full py-2.5 rounded-lg font-semibold text-sm text-center ${
                showUnlock ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-win text-on-win'
              }`}
            >
              {showUnlock ? `UNLOCK (${entryCostPts} Pts)` : isLocked ? 'View on RFD' : 'Enter'}
            </span>
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onOpenOverlay(contest)}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-medium text-gray-400 border border-gray-600/50 hover:text-gray-50"
            >
              Smart-Fill
            </button>
            {onShare && (
              <button
                type="button"
                onClick={() => onShare(contest)}
                className="flex-1 py-1.5 rounded-lg text-[11px] font-medium text-gray-400 border border-gray-600/50 hover:text-gray-50"
              >
                Share
              </button>
            )}
          </div>
        </div>
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
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-medium">{entryTypeLabel}</span>
            {entered && (
              <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-win/20 text-win border border-win/30">
                Entered
              </span>
            )}
            {reqBadges
              .filter((b) => b.costly)
              .map((b) => (
                <span
                  key={b.kind}
                  className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded border ${badgeToneClass(b)}`}
                  title={b.label}
                >
                  {b.icon} {b.kind === 'purchase' ? 'Purchase' : b.label}
                </span>
              ))}
          </div>
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
            {reqBadges.map((b) => (
              <span
                key={b.kind}
                className={`rounded-full px-2 py-0.5 text-xs font-medium border ${badgeToneClass(b)}`}
              >
                {b.icon} {b.label}
              </span>
            ))}
            {onShare && variant !== 'ended' && (
              <button
                type="button"
                onClick={() => onShare(contest)}
                className="rounded-full px-2 py-0.5 text-xs font-medium bg-gray-600/40 text-gray-300 border border-gray-500/40 hover:text-win"
              >
                Share
              </button>
            )}
            {onOneTapEnter && (
              <button
                type="button"
                onClick={() => onOpenOverlay(contest)}
                className="rounded-full px-2 py-0.5 text-xs font-medium bg-gray-600/40 text-gray-300 border border-gray-500/40 hover:text-win"
              >
                Smart-Fill
              </button>
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
