import type { SubscriptionTier } from '../monetization/tiers'

export type BillingPlanId = Extract<SubscriptionTier, 'weekly' | 'monthly'>

export interface PurchaseResult {
  ok: boolean
  stubbed: true
  planId: BillingPlanId
  message: string
}

/** TODO(wire-billing-later): StoreKit / Play Billing */
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
