import { createContext, useContext, useCallback, useState, useEffect, type ReactNode } from 'react'
import { storage } from '../lib/utils/storage'

const STORAGE_BALANCE = 'looniewins_balance'
const STORAGE_LAST_DAILY_ENTRY = 'looniewins_last_daily_entry_at'
const STORAGE_SUBSCRIPTION_TIER = 'looniewins_subscription_tier'

export type SubscriptionTier = 'free' | 'weekly' | 'monthly'

interface UserEarnState {
  balance: number
  lastDailyEntryAt: string | null
  subscriptionTier: SubscriptionTier
}

interface UserEarnContextValue extends UserEarnState {
  setBalance: (n: number | ((prev: number) => number)) => void
  setLastDailyEntryAt: (iso: string | null) => void
  setSubscriptionTier: (tier: SubscriptionTier) => void
  addPoints: (amount: number) => void
  useFreeEntry: () => void
  spendPointsForEntry: (cost: number) => boolean
}

const defaultState: UserEarnState = {
  balance: 1250,
  lastDailyEntryAt: null,
  subscriptionTier: 'free',
}

export function UserEarnProvider({ children }: { children: ReactNode }) {
  const [balance, setBalanceState] = useState(defaultState.balance)
  const [lastDailyEntryAt, setLastDailyEntryAtState] = useState<string | null>(null)
  const [subscriptionTier, setSubscriptionTierState] = useState<SubscriptionTier>(defaultState.subscriptionTier)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const [balRaw, entryRaw, tierRaw] = await Promise.all([
          storage.getItem(STORAGE_BALANCE),
          storage.getItem(STORAGE_LAST_DAILY_ENTRY),
          storage.getItem(STORAGE_SUBSCRIPTION_TIER),
        ])
        if (!mounted) return
        if (balRaw != null) {
          const n = parseInt(balRaw, 10)
          if (!Number.isNaN(n)) setBalanceState(n)
        }
        if (entryRaw) setLastDailyEntryAtState(entryRaw)
        if (tierRaw === 'weekly' || tierRaw === 'monthly' || tierRaw === 'free') setSubscriptionTierState(tierRaw)
      } finally {
        if (mounted) setHydrated(true)
      }
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    storage.setItem(STORAGE_BALANCE, String(balance))
  }, [balance, hydrated])

  useEffect(() => {
    if (!hydrated) return
    storage.setItem(STORAGE_LAST_DAILY_ENTRY, lastDailyEntryAt ?? '')
  }, [lastDailyEntryAt, hydrated])

  useEffect(() => {
    if (!hydrated) return
    storage.setItem(STORAGE_SUBSCRIPTION_TIER, subscriptionTier)
  }, [subscriptionTier, hydrated])

  const setBalance = useCallback((n: number | ((prev: number) => number)) => {
    setBalanceState((prev) => (typeof n === 'function' ? n(prev) : n))
  }, [])

  const setLastDailyEntryAt = useCallback((iso: string | null) => setLastDailyEntryAtState(iso), [])
  const setSubscriptionTier = useCallback((tier: SubscriptionTier) => setSubscriptionTierState(tier), [])

  const addPoints = useCallback((amount: number) => {
    setBalanceState((prev) => Math.max(0, prev + amount))
  }, [])

  const useFreeEntry = useCallback(() => setLastDailyEntryAtState(new Date().toISOString()), [])

  const spendPointsForEntry = useCallback((cost: number): boolean => {
    if (balance < cost) return false
    setBalanceState((prev) => Math.max(0, prev - cost))
    return true
  }, [balance])

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

const UserEarnContext = createContext<UserEarnContextValue | null>(null)

export function useUserEarn(): UserEarnContextValue {
  const ctx = useContext(UserEarnContext)
  if (!ctx) throw new Error('useUserEarn must be used within UserEarnProvider')
  return ctx
}
