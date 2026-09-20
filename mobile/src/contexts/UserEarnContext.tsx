import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import { useAuth, type SubscriptionTier } from './AuthContext'
import { tracking } from '../lib/supabase'
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
  addPoints: (amount: number, meta?: { type?: string; description?: string }) => void
  useFreeEntry: () => Promise<boolean>
  spendPointsForEntry: (cost: number) => boolean
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

  useEffect(() => {
    if (!user || !profile || syncing.current) return
    if (profile.points_balance === 0 && !profile.settings?.welcome_granted) {
      syncing.current = true
      void updateProfile({
        points_balance: 1250,
        settings: { ...profile.settings, welcome_granted: true },
      }).finally(() => {
        syncing.current = false
      })
    }
  }, [user, profile, updateProfile])

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
    [user?.id, profile?.feature_flags, updateProfile]
  )

  const addPoints = useCallback(
    (amount: number, meta?: { type?: string; description?: string }) => {
      if (!user || !profile) return
      void updateProfile({ points_balance: Math.max(0, profile.points_balance + amount) })
      void tracking()
        .from('transactions')
        .insert({
          user_id: user.id,
          amount,
          type: meta?.type ?? 'bonus',
          description: meta?.description ?? 'Points earned',
        })
    },
    [user, profile, updateProfile]
  )

  const useFreeEntry = useCallback(async (): Promise<boolean> => {
    if (!profile) return false
    if (isProTier(profile.subscription_tier, profile.is_premium)) {
      void updateProfile({ last_daily_entry_at: new Date().toISOString() })
      return true
    }
    const cap = weeklyEntryCapValue ?? FREE_WEEKLY_ENTRY_CAP
    if (user) {
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
    (cost: number): boolean => {
      if (!user || !profile || profile.points_balance < cost) return false
      void updateProfile({ points_balance: Math.max(0, profile.points_balance - cost) })
      void tracking()
        .from('transactions')
        .insert({
          user_id: user.id,
          amount: -cost,
          type: 'entry_spend',
          description: 'Contest entry',
        })
      return true
    },
    [user, profile, updateProfile]
  )

  return (
    <UserEarnContext.Provider
      value={{
        balance,
        lastDailyEntryAt,
        subscriptionTier,
        weeklyEntriesUsed,
        weeklyEntryCapValue,
        setBalance,
        setLastDailyEntryAt,
        setSubscriptionTier,
        addPoints,
        useFreeEntry,
        spendPointsForEntry,
        upgradeToPro,
      }}
    >
      {children}
    </UserEarnContext.Provider>
  )
}

export function useUserEarn(): UserEarnContextValue {
  const ctx = useContext(UserEarnContext)
  if (!ctx) throw new Error('useUserEarn must be used within UserEarnProvider')
  return ctx
}

export type { SubscriptionTier }
