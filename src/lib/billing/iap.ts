/**
 * Web / Capacitor IAP bridge.
 * Real StoreKit/Play charges happen in the Expo app via RevenueCat (`mobile/src/lib/billing/iap.ts`).
 * This module: QA stub in DEV, optional Capacitor Purchases plugin when present.
 *
 * Never put service_role or RevenueCat secret keys in the client — public SDK keys only.
 */

import type { SubscriptionTier } from '../monetization/tiers'
import {
  APPLE_PRODUCT_IDS,
  GOOGLE_PRODUCT_IDS,
  PLAN_DISPLAY,
  REVENUECAT_ENTITLEMENT_ID,
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
  try {
    const v = (import.meta.env as Record<string, string | undefined>)[key]
    return v?.trim() || undefined
  } catch {
    return undefined
  }
}

export function isIapConfigured(): boolean {
  return Boolean(
    readEnv('VITE_REVENUECAT_APPLE_API_KEY') ||
      readEnv('VITE_REVENUECAT_GOOGLE_API_KEY') ||
      readEnv('VITE_REVENUECAT_API_KEY')
  )
}

export function allowIapStub(): boolean {
  const flag = (readEnv('VITE_IAP_ALLOW_STUB') || '').toLowerCase()
  if (flag === '1' || flag === 'true' || flag === 'yes') return true
  try {
    return Boolean(import.meta.env.DEV)
  } catch {
    return false
  }
}

export function billingStatusNotice(): string {
  if (isIapConfigured()) {
    return 'Native builds charge via App Store / Play (RevenueCat). Web uses the same product IDs for restore UX.'
  }
  if (allowIapStub()) {
    return 'Dev stub: Pro unlocks locally. Ship the Expo app with RevenueCat public SDK keys to charge for real.'
  }
  return 'In-app purchase requires the iOS/Android app with RevenueCat configured.'
}

/** @deprecated use billingStatusNotice */
export function billingStubNotice(): string {
  return billingStatusNotice()
}

function detectPlatform(): 'ios' | 'android' | 'web' {
  try {
    const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor
    const p = cap?.getPlatform?.()
    if (p === 'ios') return 'ios'
    if (p === 'android') return 'android'
  } catch {
    /* ignore */
  }
  return 'web'
}

function productIdFor(planId: BillingPlanId): string {
  return detectPlatform() === 'android' ? GOOGLE_PRODUCT_IDS[planId] : APPLE_PRODUCT_IDS[planId]
}

/**
 * Attempt Capacitor Purchases plugin if the host shell registered it on window.
 * Keeps Vite web builds free of react-native-purchases imports.
 */
async function tryNativePurchase(
  planId: BillingPlanId,
  productId: string,
  appUserId?: string | null
): Promise<PurchaseResult | null> {
  const w = window as unknown as {
    Purchases?: {
      configure?: (opts: { apiKey: string; appUserID?: string }) => Promise<void>
      getOfferings?: () => Promise<{
        current?: { availablePackages?: Array<{ identifier: string; product: { identifier: string } }> }
      }>
      purchasePackage?: (pkg: unknown) => Promise<{
        customerInfo: { entitlements: { active: Record<string, { productIdentifier?: string }> } }
      }>
      logIn?: (id: string) => Promise<unknown>
    }
  }
  const Purchases = w.Purchases
  const apiKey =
    (detectPlatform() === 'ios'
      ? readEnv('VITE_REVENUECAT_APPLE_API_KEY')
      : readEnv('VITE_REVENUECAT_GOOGLE_API_KEY')) ?? readEnv('VITE_REVENUECAT_API_KEY')
  if (!Purchases?.configure || !Purchases.getOfferings || !Purchases.purchasePackage || !apiKey) {
    return null
  }
  try {
    await Purchases.configure({ apiKey, appUserID: appUserId || undefined })
    if (appUserId && Purchases.logIn) await Purchases.logIn(appUserId)
    const offerings = await Purchases.getOfferings()
    const pkgs = offerings.current?.availablePackages ?? []
    const pkg =
      pkgs.find((p) => p.product.identifier === productId) ||
      pkgs.find((p) => p.identifier.includes(planId))
    if (!pkg) {
      return {
        ok: false,
        stubbed: false,
        planId,
        productId,
        message: `No store package for ${productId}. Map it in RevenueCat.`,
      }
    }
    const { customerInfo } = await Purchases.purchasePackage(pkg)
    const ent = customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID]
    if (!ent) {
      return {
        ok: false,
        stubbed: false,
        planId,
        productId,
        message: `Missing entitlement "${REVENUECAT_ENTITLEMENT_ID}".`,
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
    const err = e as { userCancelled?: boolean; message?: string }
    if (err?.userCancelled || /cancel/i.test(err?.message ?? '')) {
      return { ok: false, stubbed: false, cancelled: true, planId, productId, message: 'Purchase cancelled.' }
    }
    return { ok: false, stubbed: false, planId, productId, message: err?.message || 'Purchase failed.' }
  }
}

export async function purchaseSubscription(
  planId: BillingPlanId,
  opts?: { appUserId?: string | null }
): Promise<PurchaseResult> {
  const productId = productIdFor(planId)
  const native = await tryNativePurchase(planId, productId, opts?.appUserId)
  if (native) return native

  if (allowIapStub()) {
    return {
      ok: true,
      stubbed: true,
      planId,
      productId,
      message:
        'Billing stub: subscription_tier updated in-app. Use the Expo app + RevenueCat for real StoreKit/Play charges.',
    }
  }

  return {
    ok: false,
    stubbed: false,
    planId,
    productId,
    message: 'Real IAP requires the native LoonieWins app with RevenueCat public SDK keys.',
  }
}

export async function restorePurchases(opts?: {
  appUserId?: string | null
}): Promise<{ ok: boolean; planId: BillingPlanId | null; message: string }> {
  void opts
  const w = window as unknown as {
    Purchases?: {
      configure?: (opts: { apiKey: string; appUserID?: string }) => Promise<void>
      restorePurchases?: () => Promise<{
        entitlements: { active: Record<string, { productIdentifier?: string }> }
      }>
    }
  }
  const apiKey =
    readEnv('VITE_REVENUECAT_APPLE_API_KEY') ||
    readEnv('VITE_REVENUECAT_GOOGLE_API_KEY') ||
    readEnv('VITE_REVENUECAT_API_KEY')
  if (!w.Purchases?.restorePurchases || !apiKey) {
    return {
      ok: false,
      planId: null,
      message: 'Restore purchases in the iOS/Android app.',
    }
  }
  try {
    await w.Purchases.configure?.({ apiKey, appUserID: opts?.appUserId || undefined })
    const info = await w.Purchases.restorePurchases()
    const ent = info.entitlements.active[REVENUECAT_ENTITLEMENT_ID]
    if (!ent) return { ok: false, planId: null, message: 'No active Pro entitlement to restore.' }
    const id = (ent.productIdentifier ?? '').toLowerCase()
    const planId: BillingPlanId = id.includes('weekly') ? 'weekly' : 'monthly'
    return { ok: true, planId, message: 'Purchases restored.' }
  } catch (e: unknown) {
    return { ok: false, planId: null, message: e instanceof Error ? e.message : 'Restore failed.' }
  }
}

export function tierFromPlan(planId: BillingPlanId): SubscriptionTier {
  return planId
}
