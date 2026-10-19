import { useState } from 'react'
import { FREE_TIER_PERKS, PRO_LOCKED_FEATURES } from '../lib/monetization/tiers'
import {
  billingStatusNotice,
  isIapConfigured,
  restorePurchases,
  type BillingPlanId,
} from '../lib/billing/iap'
import { PLAN_DISPLAY } from '../lib/billing/products'
import { useAuth } from '../contexts/AuthContext'

interface SubscriptionModalProps {
  open: boolean
  onClose: () => void
  onSelectPlan?: (planId: BillingPlanId) => void | Promise<void>
  /** When true, show Free vs Pro comparison (perks + pricing) at the top */
  showComparison?: boolean
}

export default function SubscriptionModal({
  open,
  onClose,
  onSelectPlan,
  showComparison = true,
}: SubscriptionModalProps) {
  const { user } = useAuth()
  const [busy, setBusy] = useState<BillingPlanId | 'restore' | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const handleSelect = async (planId: BillingPlanId) => {
    setError(null)
    setBusy(planId)
    try {
      await onSelectPlan?.(planId)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Purchase failed')
    } finally {
      setBusy(null)
    }
  }

  const handleRestore = async () => {
    setError(null)
    setBusy('restore')
    try {
      const res = await restorePurchases({ appUserId: user?.id })
      if (!res.ok || !res.planId) {
        setError(res.message)
        return
      }
      await onSelectPlan?.(res.planId)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed')
    } finally {
      setBusy(null)
    }
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
          Go Pro — unlock everything
        </h2>
        <p className="text-sm text-gray-400 mt-2 mb-4">
          Weekly or monthly subscription. Not a one-time buy — cancel anytime in the store.
        </p>

        {/* Scannable list of everything locked behind Pro */}
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">
            Locked behind Pro
          </p>
          <ul className="space-y-2.5">
            {PRO_LOCKED_FEATURES.map((f) => (
              <li key={f.id} className="flex gap-2.5 text-sm">
                <span className="text-amber-400 shrink-0 mt-0.5" aria-hidden>
                  ✓
                </span>
                <span>
                  <span className="font-semibold text-gray-50 block">{f.title}</span>
                  <span className="text-gray-400 text-xs leading-snug">{f.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {showComparison && (
          <div className="mb-4 space-y-3 rounded-xl border border-gray-600/50 p-4 bg-gray-900/50">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Free Plan
              </p>
              <ul className="text-sm text-gray-400 space-y-0.5">
                {FREE_TIER_PERKS.map((line) => (
                  <li key={line}>· {line}</li>
                ))}
              </ul>
            </div>
            <p className="text-amber-400 text-sm font-medium">
              From {PLAN_DISPLAY.weekly.priceLabel} or {PLAN_DISPLAY.monthly.priceLabel}
            </p>
          </div>
        )}

        <div className="space-y-3">
          {(['weekly', 'monthly'] as const).map((planId) => (
            <button
              key={planId}
              type="button"
              disabled={busy != null}
              onClick={() => void handleSelect(planId)}
              className="w-full rounded-xl glass border border-amber-500/20 p-4 text-left hover:border-amber-500/40 transition-colors disabled:opacity-60"
            >
              <p className="font-semibold text-gray-50">{PLAN_DISPLAY[planId].title}</p>
              <p className="text-amber-400 text-sm mt-0.5">
                {busy === planId ? 'Processing…' : PLAN_DISPLAY[planId].priceLabel}
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                Auto-renewing {planId === 'weekly' ? 'weekly' : 'monthly'} · not a one-time purchase
              </p>
            </button>
          ))}
        </div>

        {isIapConfigured() && (
          <button
            type="button"
            disabled={busy != null}
            onClick={() => void handleRestore()}
            className="mt-3 w-full py-2 rounded-lg text-sm text-gray-300 hover:text-gray-50 disabled:opacity-60"
          >
            {busy === 'restore' ? 'Restoring…' : 'Restore purchases'}
          </button>
        )}

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <p className="mt-3 text-[11px] text-gray-500 leading-snug">{billingStatusNotice()}</p>

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
