/**
 * Expo IAP via RevenueCat (StoreKit + Play Billing).
 * Public SDK keys only — never ship secret/server RevenueCat keys or Supabase service_role.
 */

import { Platform } from 'react-native'
import type { SubscriptionTier } from '../monetization/tiers'
import {
  APPLE_PRODUCT_IDS,
  GOOGLE_PRODUCT_IDS,
  PLAN_DISPLAY,
  REVENUECAT_ENTITLEMENT_ID,
  REVENUECAT_PACKAGE_IDS,
  type BillingPlanId,
} from './products'

export type { BillingPlanId }
export { PLAN_DISPLAY, APPLE_PRODUCT_IDS, GOOGLE_PRODUCT_IDS, REVENUECAT_ENTITLEMENT_ID }

export interface PurchaseResult {
  ok: boolean
  stubbed: boolean
  cancelled?: boolean
  planId: BillingPlanId
  productId?: string
  message: string
}

function readEnv(key: string): string | undefined {
  const v = (process.env as Record<string, string | undefined>)[key]
  return v?.trim() || undefined
}

export function isIapConfigured(): boolean {
  return Boolean(
    readEnv('EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY') ||
      readEnv('EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY') ||
      readEnv('EXPO_PUBLIC_REVENUECAT_API_KEY')
  )
}

export function allowIapStub(): boolean {
  const flag = (readEnv('EXPO_PUBLIC_IAP_ALLOW_STUB') || '').toLowerCase()
  return flag === '1' || flag === 'true' || flag === 'yes' || __DEV__
}

export function billingStatusNotice(): string {
  if (isIapConfigured()) {
    return 'Purchases run through the App Store / Google Play via RevenueCat.'
  }
  if (allowIapStub()) {
    return 'Dev stub: Pro unlocks locally. Add RevenueCat public SDK keys for real charges.'
  }
  return 'Configure EXPO_PUBLIC_REVENUECAT_* keys to enable purchases.'
}

export function billingStubNotice(): string {
  return billingStatusNotice()
}

function apiKey(): string | null {
  if (Platform.OS === 'ios') {
    return (
      readEnv('EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY') ??
      readEnv('EXPO_PUBLIC_REVENUECAT_API_KEY') ??
      null
    )
  }
  if (Platform.OS === 'android') {
    return (
      readEnv('EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY') ??
      readEnv('EXPO_PUBLIC_REVENUECAT_API_KEY') ??
      null
    )
  }
  return readEnv('EXPO_PUBLIC_REVENUECAT_API_KEY') ?? null
}

function productIdFor(planId: BillingPlanId): string {
  return Platform.OS === 'android' ? GOOGLE_PRODUCT_IDS[planId] : APPLE_PRODUCT_IDS[planId]
}

function planFromProductId(productId: string): BillingPlanId | null {
  const id = productId.toLowerCase()
  if (id.includes('weekly') || id === APPLE_PRODUCT_IDS.weekly || id === GOOGLE_PRODUCT_IDS.weekly) {
    return 'weekly'
  }
  if (id.includes('monthly') || id === APPLE_PRODUCT_IDS.monthly || id === GOOGLE_PRODUCT_IDS.monthly) {
    return 'monthly'
  }
  return null
}

type PurchasesModule = typeof import('react-native-purchases')

let Purchases: PurchasesModule['default'] | null = null
let configured = false

async function getPurchases(): Promise<PurchasesModule['default'] | null> {
  if (Purchases) return Purchases
  try {
    const mod = await import('react-native-purchases')
    Purchases = mod.default
    return Purchases
  } catch {
    return null
  }
}

export async function ensureIapConfigured(appUserId?: string | null): Promise<boolean> {
  const key = apiKey()
  const P = await getPurchases()
  if (!key || !P) return false
  if (!configured) {
    P.configure({ apiKey: key, appUserID: appUserId || undefined })
    configured = true
  } else if (appUserId) {
    try {
      await P.logIn(appUserId)
    } catch {
      /* ignore */
    }
  }
  return true
}

export async function purchaseSubscription(
  planId: BillingPlanId,
  opts?: { appUserId?: string | null }
): Promise<PurchaseResult> {
  const productId = productIdFor(planId)
  const ready = await ensureIapConfigured(opts?.appUserId)
  const P = await getPurchases()

  if (ready && P) {
    try {
      const offerings = await P.getOfferings()
      const pkgs = offerings.current?.availablePackages ?? []
      const wantPkg = REVENUECAT_PACKAGE_IDS[planId]
      const pkg =
        pkgs.find((p) => p.identifier === wantPkg) ||
        pkgs.find((p) => p.product.identifier === productId) ||
        pkgs.find((p) => planFromProductId(p.product.identifier) === planId)

      if (!pkg) {
        return {
          ok: false,
          stubbed: false,
          planId,
          productId,
          message: `No RevenueCat package for ${planId}. Map ${productId} in the dashboard.`,
        }
      }

      const { customerInfo } = await P.purchasePackage(pkg)
      const ent = customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID]
      if (!ent) {
        return {
          ok: false,
          stubbed: false,
          planId,
          productId,
          message: `Purchase finished but entitlement "${REVENUECAT_ENTITLEMENT_ID}" is inactive.`,
        }
      }
      return {
        ok: true,
        stubbed: false,
        planId,
        productId: ent.productIdentifier ?? productId,
        message: 'Purchase successful.',
      }
    } catch (e: unknown) {
      const err = e as { userCancelled?: boolean; code?: string; message?: string }
      if (err?.userCancelled || String(err?.code) === '1' || /cancel/i.test(err?.message ?? '')) {
        return {
          ok: false,
          stubbed: false,
          cancelled: true,
          planId,
          productId,
          message: 'Purchase cancelled.',
        }
      }
      return {
        ok: false,
        stubbed: false,
        planId,
        productId,
        message: err?.message || 'Purchase failed.',
      }
    }
  }

  if (allowIapStub()) {
    return {
      ok: true,
      stubbed: true,
      planId,
      productId,
      message:
        'Billing stub: subscription_tier updated in-app. Add EXPO_PUBLIC_REVENUECAT_* for real StoreKit/Play charges.',
    }
  }

  return {
    ok: false,
    stubbed: false,
    planId,
    productId,
    message: 'RevenueCat SDK / API key not configured.',
  }
}

export async function restorePurchases(opts?: {
  appUserId?: string | null
}): Promise<{ ok: boolean; planId: BillingPlanId | null; message: string }> {
  const ready = await ensureIapConfigured(opts?.appUserId)
  const P = await getPurchases()
  if (!ready || !P) {
    return { ok: false, planId: null, message: 'Restore requires RevenueCat on device.' }
  }
  try {
    const info = await P.restorePurchases()
    const ent = info.entitlements.active[REVENUECAT_ENTITLEMENT_ID]
    if (!ent) {
      return { ok: false, planId: null, message: 'No active Pro entitlement to restore.' }
    }
    const planId = planFromProductId(ent.productIdentifier ?? '') ?? 'monthly'
    return { ok: true, planId, message: 'Purchases restored.' }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Restore failed.'
    return { ok: false, planId: null, message: msg }
  }
}

export function tierFromPlan(planId: BillingPlanId): SubscriptionTier {
  return planId
}
