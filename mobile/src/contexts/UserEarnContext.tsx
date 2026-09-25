import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import { useAuth, type SubscriptionTier } from './AuthContext'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import {
  FREE_WEEKLY_ENTRY_CAP,
  isProTier,
  weeklyEntryCap,
} from '../lib/monetization/tiers'
import {
  localConsumeWeeklyEntry,
  rpcConsumeFreeEntry,
} from '../lib/monetization/progression'
import { purchaseSubscription, type BillingPlanId } from '../lib/billing/iap'

interface UserEarnContextValue {
  balance: number
  lastDailyEntryAt: string | null
  subscriptionTier: SubscriptionTier
  weeklyEntriesUsed: number
  weeklyEntryCapValue: number | null
  setBalance: (n: number | ((prev: number) => number)) => void
  setLastDailyEntryAt: (iso: string | null) => void
  setSubscriptionTier: (tier: SubscriptionTier) => void
  /**
   * Local-only credit (guest / sandbox demo). Returns false for signed-in cloud accounts:
   * their balance is server-owned and only changes via RPCs / provider postbacks.
   */
  addPoints: (amount: number, meta?: { type?: string; description?: string }) => boolean
  /** True when the balance lives in Supabase (signed in + configured). */
  isCloudAccount: boolean
  /** Consume one free weekly slot (RPC when signed in). Returns false if paywalled. */
  consumeFreeEntry: () => Promise<boolean>
  /** Optimistic sync check (so the entry window opens inside the click); debit settles via RPC. */
  spendPointsForEntry: (cost: number, contestId?: string) => boolean
  /** StoreKit/Play via RevenueCat (or QA stub) → flips subscription_tier / is_premium */
  upgradeToPro: (planId: BillingPlanId) => Promise<void>
}

const UserEarnContext = createContext<UserEarnContextValue | null>(null)

export function UserEarnProvider({ children }: { children: ReactNode }) {
  const { user, profile, updateProfile, refreshProfile } = useAuth()
  const balance = profile?.points_balance ?? 0
  const lastDailyEntryAt = profile?.last_daily_entry_at ?? null
  const subscriptionTier = profile?.subscription_tier ?? 'free'
  const weeklyEntriesUsed = profile?.weekly_entries_used ?? 0
  const weeklyEntryCapValue = weeklyEntryCap(profile?.feature_flags, {
    tier: subscriptionTier,
    isPremium: profile?.is_premium,
  })
  const syncing = useRef(false)
  const isCloudAccount = Boolean(user && isSupabaseConfigured && supabase)

  // Ensure new accounts start with a small welcome balance once (0 → 1250)
  useEffect(() => {
    if (!profile || syncing.current) return
    if (profile.points_balance !== 0 || profile.settings?.welcome_granted) return
    syncing.current = true
    if (isCloudAccount && supabase) {
      // Server grants once per account (ledger-keyed), so reloads / tabs cannot double-claim.
      void Promise.resolve(supabase.rpc('claim_welcome_bonus'))
        .then(({ error }) => {
          if (error) console.warn('[Earn] welcome bonus:', error.message)
          return refreshProfile()
        })
        .finally(() => {
          syncing.current = false
        })
      return
    }
    void updateProfile({
      points_balance: 1250,
      settings: { ...profile.settings, welcome_granted: true },
    }).finally(() => {
      syncing.current = false
    })
  }, [profile, updateProfile, refreshProfile, isCloudAccount])

  const setBalance = useCallback(
    (n: number | ((prev: number) => number)) => {
      if (!profile) return
      const next = typeof n === 'function' ? n(profile.points_balance) : n
      void updateProfile({ points_balance: Math.max(0, next) })
    },
    [profile, updateProfile]
  )

  const setLastDailyEntryAt = useCallback(
    (iso: string | null) => {
      void updateProfile({ last_daily_entry_at: iso })
    },
    [updateProfile]
  )

  const setSubscriptionTier = useCallback(
    (tier: SubscriptionTier) => {
      void updateProfile({
        subscription_tier: tier,
        is_premium: tier === 'weekly' || tier === 'monthly',
      })
    },
    [updateProfile]
  )

  const upgradeToPro = useCallback(
    async (planId: BillingPlanId) => {
      const result = await purchaseSubscription(planId, { appUserId: user?.id })
      if (!result.ok) {
        if (result.cancelled) return
        throw new Error(result.message)
      }
      if (isCloudAccount) {
        // Entitlement is written server-side by the RevenueCat webhook; pick it up as it lands.
        for (const delayMs of [0, 1500, 3000, 5000, 8000]) {
          if (delayMs) await new Promise((r) => setTimeout(r, delayMs))
          await refreshProfile()
        }
        return
      }
      await updateProfile({
        subscription_tier: planId,
        is_premium: true,
        feature_flags: {
          ...(profile?.feature_flags ?? {}),
          unlimited_entries: true,
          unlimited_smart_fills: true,
          priority_sources: true,
        },
        ...(result.productId ? { iap_product_id: result.productId } : {}),
      })
    },
    [user?.id, profile?.feature_flags, updateProfile, refreshProfile, isCloudAccount]
  )

  const addPoints = useCallback(
    (amount: number, meta?: { type?: string; description?: string }): boolean => {
      if (!profile) return false
      if (isCloudAccount) {
        console.warn('[Earn] cloud balances are server-owned; ignored local credit:', meta?.description)
        return false
      }
      void updateProfile({ points_balance: Math.max(0, profile.points_balance + amount) })
      return true
    },
    [profile, updateProfile, isCloudAccount]
  )

  const consumeFreeEntry = useCallback(async (): Promise<boolean> => {
    if (!profile) return false
    if (isProTier(profile.subscription_tier, profile.is_premium)) {
      void updateProfile({ last_daily_entry_at: new Date().toISOString() })
      return true
    }

    const cap = weeklyEntryCapValue ?? FREE_WEEKLY_ENTRY_CAP

    if (user && isSupabaseConfigured) {
      const res = await rpcConsumeFreeEntry(cap)
      if (!res.local) {
        await refreshProfile()
        return Boolean(res.ok)
      }
    }

    const local = localConsumeWeeklyEntry(
      profile.weekly_entries_used ?? 0,
      profile.weekly_entries_reset_at,
      cap
    )
    if (!local.ok) return false
    await updateProfile({
      weekly_entries_used: local.weekly_used,
      weekly_entries_reset_at: local.weekly_entries_reset_at,
      last_daily_entry_at: new Date().toISOString(),
    })
    return true
  }, [profile, user, weeklyEntryCapValue, updateProfile, refreshProfile])

  const spendPointsForEntry = useCallback(
    (cost: number, contestId?: string): boolean => {
      if (!profile) return false
      if (profile.points_balance < cost) return false
      if (isCloudAccount && supabase) {
        void Promise.resolve(
          supabase.rpc('spend_points_for_entry', { p_cost: cost, p_contest_id: contestId ?? null })
        ).then(({ data, error }) => {
          const res = (data ?? {}) as { ok?: boolean; reason?: string }
          if (error || !res.ok) console.warn('[Earn] spend:', error?.message ?? res.reason)
          return refreshProfile()
        })
        return true
      }
      void updateProfile({ points_balance: Math.max(0, profile.points_balance - cost) })
      return true
    },
    [profile, updateProfile, refreshProfile, isCloudAccount]
  )

  const value: UserEarnContextValue = {
    balance,
    lastDailyEntryAt,
    subscriptionTier,
    weeklyEntriesUsed,
    weeklyEntryCapValue,
    setBalance,
    setLastDailyEntryAt,
    setSubscriptionTier,
    addPoints,
    isCloudAccount,
    consumeFreeEntry,
    spendPointsForEntry,
    upgradeToPro,
  }

  return <UserEarnContext.Provider value={value}>{children}</UserEarnContext.Provider>
}

export function useUserEarn(): UserEarnContextValue {
  const ctx = useContext(UserEarnContext)
  if (!ctx) throw new Error('useUserEarn must be used within UserEarnProvider')
  return ctx
}

export type { SubscriptionTier }
