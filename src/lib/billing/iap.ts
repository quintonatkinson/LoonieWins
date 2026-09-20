/**
 * StoreKit / Play Billing stub.
 * Caps + paywall UX use subscription_tier / is_premium today.
 * Wire real IAP here later — do not block freemium UX on billing SDKs.
 */

import type { SubscriptionTier } from '../monetization/tiers'

export type BillingPlanId = Extract<SubscriptionTier, 'weekly' | 'monthly'>

export interface PurchaseResult {
  ok: boolean
  /** Always true until StoreKit/Play are wired */
  stubbed: true
  planId: BillingPlanId
  message: string
}

/**
 * TODO(wire-billing-later): replace with StoreKit 2 / Google Play Billing Library.
 * For now flipping premium flags locally / via profile update is intentional.
 */
export async function purchaseSubscription(planId: BillingPlanId): Promise<PurchaseResult> {
  return {
    ok: true,
    stubbed: true,
    planId,
    message:
      'Billing stub: subscription_tier updated in-app. Wire StoreKit/Play IAP before production charge.',
  }
}

export function billingStubNotice(): string {
  return 'In-app purchases are stubbed — Pro unlocks work via subscription_tier for UX testing.'
}
