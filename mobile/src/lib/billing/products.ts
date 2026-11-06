/**
 * Store product catalog for LoonieWins Pro (Expo).
 * Quinton creates these IDs in App Store Connect + Play Console, then maps them in RevenueCat.
 */

export type BillingPlanId = 'weekly' | 'monthly'

export const APPLE_PRODUCT_IDS = {
  weekly: 'com.quinton.looniewins.pro.weekly',
  monthly: 'com.quinton.looniewins.pro.monthly',
} as const

export const GOOGLE_PRODUCT_IDS = {
  weekly: 'looniewins_pro_weekly',
  monthly: 'looniewins_pro_monthly',
} as const

export const REVENUECAT_ENTITLEMENT_ID = 'pro'

export const REVENUECAT_PACKAGE_IDS: Record<BillingPlanId, string> = {
  weekly: '$rc_weekly',
  monthly: '$rc_monthly',
}

export const PLAN_DISPLAY = {
  weekly: { title: 'Bi-Weekly Coffee', priceLabel: '$1.49 / week' },
  monthly: { title: 'Monthly Saver', priceLabel: '$4.99 / mo' },
} as const

export function storeProductIdForPlatform(
  planId: BillingPlanId,
  platform: 'ios' | 'android' | 'web'
): string {
  if (platform === 'android') return GOOGLE_PRODUCT_IDS[planId]
  return APPLE_PRODUCT_IDS[planId]
}
