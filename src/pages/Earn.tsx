import { useState, useCallback, useMemo } from 'react'
import confetti from 'canvas-confetti'
import { useLocation, useNavigate } from 'react-router-dom'
import { useUserEarn } from '../contexts/UserEarnContext'
import { useAuth } from '../contexts/AuthContext'
import { ENTRY_COST_PTS } from '../hooks/useUserLimits'
import {
  ENTRY_COST_BY_TIER,
  entryCostRangeCopy,
} from '../lib/monetization/entryPointCost'
import { hasFeature, isProTier } from '../lib/monetization/tiers'
import SubscriptionModal from '../components/SubscriptionModal'
import {
  isSandboxOffer,
  openOfferwallSession,
  type OfferwallOffer,
} from '../lib/earn/offerwall'

const SIMULATE_MS = 2000

function TimeIcon({ kind }: { kind: OfferwallOffer['timeKind'] }) {
  if (kind === 'lightning') return <span className="text-amber-400" aria-hidden>⚡</span>
  if (kind === 'clock') return <span className="text-amber-400" aria-hidden>⏳</span>
  if (kind === 'game') return <span className="text-amber-400" aria-hidden>🎮</span>
  if (kind === 'video') return <span className="text-amber-400" aria-hidden>📺</span>
  if (kind === 'offer') return <span className="text-amber-400" aria-hidden>🎁</span>
  return null
}

export default function Earn() {
  const { balance, addPoints, subscriptionTier, upgradeToPro } = useUserEarn()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [successTask, setSuccessTask] = useState<OfferwallOffer | null>(null)
  const [showPlanModal, setShowPlanModal] = useState(false)

  const playerId = user?.id ?? profile?.id ?? 'guest'
  const session = useMemo(() => openOfferwallSession(playerId), [playerId])
  const isPro = isProTier(subscriptionTier, profile?.is_premium)
  const hideEarnAds = hasFeature(profile?.feature_flags, 'hide_earn_ads', {
    tier: subscriptionTier,
    isPremium: profile?.is_premium,
  })

  const returnCost =
    typeof (location.state as { entryCostPts?: number } | null)?.entryCostPts === 'number'
      ? (location.state as { entryCostPts: number }).entryCostPts
      : null
  const targetCost = returnCost ?? ENTRY_COST_PTS
  const entriesFromBalance = Math.floor(balance / ENTRY_COST_BY_TIER.micro)
  const canCoverTarget = balance >= targetCost

  const handleOfferClick = useCallback(
    (offer: OfferwallOffer) => {
      if (loadingId) return

      // Live AdGem wall — open provider; credits arrive via postback
      if (offer.url && !isSandboxOffer(offer)) {
        window.open(offer.url, '_blank', 'noopener,noreferrer')
        return
      }

      setLoadingId(offer.id)
      setTimeout(() => {
        addPoints(offer.reward, {
          type: 'offerwall',
          description: `Offerwall: ${offer.title}`,
        })
        setSuccessTask(offer)
        setLoadingId(null)
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } })
      }, SIMULATE_MS)
    },
    [addPoints, loadingId]
  )

  const closeSuccess = useCallback(() => setSuccessTask(null), [])

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="rounded-xl glass border border-amber-500/20 p-4">
        <p className="text-gray-300 text-sm">Your Balance</p>
        <p className="text-amber-400 font-bold text-2xl mt-1 flex items-center gap-2">
          <span aria-hidden>🪙</span>
          {balance.toLocaleString()} Pts
        </p>
        <p className="text-gray-400 text-sm mt-2">
          Prize-tiered entries after your free weekly cap:{' '}
          <span className="text-amber-400 font-semibold">{entryCostRangeCopy()}</span>
          {' '}(Tims → vehicle). Enough for ~{entriesFromBalance} coffee-tier unlocks.
        </p>
        {returnCost != null && (
          <p className="text-sm mt-2 text-gray-300">
            Contest you came from needs{' '}
            <span className="text-amber-400 font-semibold">{returnCost} pts</span>
            {canCoverTarget ? ' — you can enter now.' : ' — keep earning.'}
          </p>
        )}
        <p className="text-xs text-gray-500 mt-2">
          Provider: <span className="text-gray-300">{session.provider}</span>
          {session.configured ? ' (live)' : ' (sandbox fallback)'}
        </p>
        {canCoverTarget && (
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-3 w-full py-2.5 rounded-lg bg-win text-on-win font-semibold text-sm"
          >
            Back to feed — spend pts &amp; enter
          </button>
        )}
      </div>

      {!hideEarnAds && (
        <div
          className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-gray-900/60 p-4"
          data-earn-promo="house"
          role="complementary"
          aria-label="Promotional"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-500/80">
            Ad · Free plan
          </p>
          <p className="text-sm font-semibold text-gray-50 mt-1">
            Skip promo slots + the point grind
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Pro hides this banner and unlocks unlimited entries, New/Ending rails, CSV export, and
            more — weekly or monthly.
          </p>
          <button
            type="button"
            onClick={() => setShowPlanModal(true)}
            className="mt-3 w-full py-2.5 rounded-lg bg-amber-500/25 text-amber-300 font-semibold text-sm border border-amber-500/40 hover:bg-amber-500/35"
          >
            {isPro ? 'Manage Pro' : 'Go Pro — ad-free Earn'}
          </button>
        </div>
      )}

      {hideEarnAds && (
        <p className="text-center text-xs text-win">
          Pro · Earn promo slots hidden. Offerwall stays available when you want pts.
        </p>
      )}

      <div className="rounded-xl border border-gray-600/50 bg-gray-900/40 p-3 text-xs text-gray-400 space-y-1">
        <p className="font-semibold text-gray-300 text-sm">Loop when free entries are capped</p>
        <p>1. Complete AdGem offers / rewarded tasks → earn pts</p>
        <p>2. Return to the contest → spend prize-tiered pts to unlock</p>
        <p>3. Or go Pro (weekly/monthly) to skip the grind entirely</p>
      </div>

      <p className="text-center text-sm text-gray-400">
        Micro {ENTRY_COST_BY_TIER.micro} · Standard {ENTRY_COST_BY_TIER.standard} · Mega{' '}
        {ENTRY_COST_BY_TIER.mega} pts
      </p>

      {session.wallUrl && (
        <button
          type="button"
          onClick={() => window.open(session.wallUrl!, '_blank', 'noopener,noreferrer')}
          className="w-full py-3 rounded-xl bg-amber-500/20 text-amber-400 font-semibold border border-amber-500/40"
        >
          Open live AdGem offerwall
        </button>
      )}

      <section>
        <h2 className="text-base font-bold text-gray-50 mb-1">Offerwall</h2>
        <p className="text-xs text-gray-500 mb-3">{session.note}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {session.offers.map((offer) => (
            <button
              key={offer.id}
              type="button"
              disabled={!!loadingId}
              onClick={() => handleOfferClick(offer)}
              className="relative rounded-xl glass border border-amber-500/20 p-4 text-left flex flex-col gap-2 hover:border-amber-500/40 transition-colors disabled:opacity-60 disabled:pointer-events-none"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-gray-50 text-sm line-clamp-2">{offer.title}</span>
                <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {offer.tag}
                </span>
              </div>
              <div className="flex items-center justify-between mt-auto">
                <span className="text-amber-400 font-bold text-sm">
                  {offer.reward > 0 ? `+${offer.reward.toLocaleString()} Pts` : 'Variable'}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <TimeIcon kind={offer.timeKind} />
                  {offer.timeLabel}
                </span>
              </div>
              {loadingId === offer.id && (
                <div className="absolute inset-0 rounded-xl bg-gray-900/80 flex items-center justify-center" aria-busy>
                  <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </button>
          ))}
        </div>
      </section>

      {successTask && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40" onClick={closeSuccess} aria-hidden />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 rounded-2xl glass border border-amber-500/30 p-6 text-center min-w-[240px]">
            <p className="text-2xl font-bold text-amber-400">Success!</p>
            <p className="text-gray-50 mt-1">+{successTask.reward.toLocaleString()} Pts</p>
            <p className="text-xs text-gray-400 mt-2">
              Head back to the contest and spend pts to enter — or keep earning.
            </p>
            <button
              type="button"
              onClick={() => {
                closeSuccess()
                navigate('/')
              }}
              className="mt-4 w-full py-2.5 rounded-lg bg-win text-on-win font-semibold"
            >
              Back to feed
            </button>
            <button
              type="button"
              onClick={closeSuccess}
              className="mt-2 w-full py-2.5 rounded-lg bg-amber-500/20 text-amber-400 font-semibold border border-amber-500/40"
            >
              Keep earning
            </button>
          </div>
        </>
      )}

      <SubscriptionModal
        open={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        onSelectPlan={(planId) => void upgradeToPro(planId)}
        showComparison
      />
    </div>
  )
}
