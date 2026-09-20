import { FREE_TIER_PERKS, PRO_TIER_PERKS } from '../lib/monetization/tiers'
import { billingStubNotice } from '../lib/billing/iap'

interface SubscriptionModalProps {
  open: boolean
  onClose: () => void
  onSelectPlan?: (planId: 'weekly' | 'monthly') => void
  /** When true, show Free vs Pro comparison (perks + pricing) at the top */
  showComparison?: boolean
}

export default function SubscriptionModal({
  open,
  onClose,
  onSelectPlan,
  showComparison = true,
}: SubscriptionModalProps) {
  if (!open) return null

  const handleSelect = (planId: 'weekly' | 'monthly') => {
    onSelectPlan?.(planId)
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-2xl glass border border-gray-600/50 p-6 shadow-xl"
        role="dialog"
        aria-modal
        aria-labelledby="subscription-title"
      >
        <h2 id="subscription-title" className="text-lg font-bold text-gray-50">
          Tired of weekly caps?
        </h2>
        <p className="text-sm text-gray-400 mt-2 mb-4">
          Unlimited Entries. Unlimited Smart-Fills. No Points Needed.
        </p>

        {showComparison && (
          <div className="mb-4 space-y-3 rounded-xl border border-gray-600/50 p-4 bg-gray-900/50">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Free Plan
              </p>
              <ul className="text-sm text-gray-400 space-y-0.5">
                {FREE_TIER_PERKS.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-1">
                Pro Plan
              </p>
              <ul className="text-sm text-gray-300 space-y-0.5">
                {PRO_TIER_PERKS.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="text-amber-400 text-sm mt-2 font-medium">From $1.49/week or $4.99/mo</p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => handleSelect('weekly')}
            className="w-full rounded-xl glass border border-amber-500/20 p-4 text-left hover:border-amber-500/40 transition-colors"
          >
            <p className="font-semibold text-gray-50">Bi-Weekly Coffee</p>
            <p className="text-amber-400 text-sm mt-0.5">$1.49 / week</p>
          </button>
          <button
            type="button"
            onClick={() => handleSelect('monthly')}
            className="w-full rounded-xl glass border border-amber-500/20 p-4 text-left hover:border-amber-500/40 transition-colors"
          >
            <p className="font-semibold text-gray-50">Monthly Saver</p>
            <p className="text-amber-400 text-sm mt-0.5">$4.99 / mo</p>
          </button>
        </div>

        <p className="mt-3 text-[11px] text-gray-500 leading-snug">{billingStubNotice()}</p>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full py-2 rounded-lg text-gray-400 hover:text-gray-50 text-sm"
        >
          Maybe later
        </button>
      </div>
    </>
  )
}
