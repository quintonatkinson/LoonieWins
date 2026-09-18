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

interface UserEarnContextValue {
  balance: number
  lastDailyEntryAt: string | null
  subscriptionTier: SubscriptionTier
  setBalance: (n: number | ((prev: number) => number)) => void
  setLastDailyEntryAt: (iso: string | null) => void
  setSubscriptionTier: (tier: SubscriptionTier) => void
  addPoints: (amount: number, meta?: { type?: string; description?: string }) => void
  useFreeEntry: () => void
  spendPointsForEntry: (cost: number) => boolean
}

const UserEarnContext = createContext<UserEarnContextValue | null>(null)

export function UserEarnProvider({ children }: { children: ReactNode }) {
  const { user, profile, updateProfile } = useAuth()
  const balance = profile?.points_balance ?? 0
  const lastDailyEntryAt = profile?.last_daily_entry_at ?? null
  const subscriptionTier = profile?.subscription_tier ?? 'free'
  const syncing = useRef(false)

  // Ensure new accounts start with a small welcome balance once (0 → 1250)
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

  const addPoints = useCallback(
    (amount: number, meta?: { type?: string; description?: string }) => {
      if (!user || !profile) return
      const next = Math.max(0, profile.points_balance + amount)
      void updateProfile({ points_balance: next })
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

  const useFreeEntry = useCallback(() => {
    void updateProfile({ last_daily_entry_at: new Date().toISOString() })
  }, [updateProfile])

  const spendPointsForEntry = useCallback(
    (cost: number): boolean => {
      if (!user || !profile) return false
      if (profile.points_balance < cost) return false
      const next = Math.max(0, profile.points_balance - cost)
      void updateProfile({ points_balance: next })
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

  const value: UserEarnContextValue = {
    balance,
    lastDailyEntryAt,
    subscriptionTier,
    setBalance,
    setLastDailyEntryAt,
    setSubscriptionTier,
    addPoints,
    useFreeEntry,
    spendPointsForEntry,
  }

  return <UserEarnContext.Provider value={value}>{children}</UserEarnContext.Provider>
}

export function useUserEarn(): UserEarnContextValue {
  const ctx = useContext(UserEarnContext)
  if (!ctx) throw new Error('useUserEarn must be used within UserEarnProvider')
  return ctx
}

export type { SubscriptionTier }
