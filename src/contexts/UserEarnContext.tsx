import { createContext, useContext, useCallback, useState, useEffect, type ReactNode } from 'react'

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

function loadNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    const n = parseInt(raw, 10)
    return Number.isNaN(n) ? fallback : n
  } catch {
    return fallback
  }
}

function loadString(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const UserEarnContext = createContext<UserEarnContextValue | null>(null)

export function UserEarnProvider({ children }: { children: ReactNode }) {
  const [balance, setBalanceState] = useState<number>(() =>
    loadNumber(STORAGE_BALANCE, defaultState.balance)
  )
  const [lastDailyEntryAt, setLastDailyEntryAtState] = useState<string | null>(() =>
    loadString(STORAGE_LAST_DAILY_ENTRY)
  )
  const [subscriptionTier, setSubscriptionTierState] = useState<SubscriptionTier>(() => {
    const t = loadString(STORAGE_SUBSCRIPTION_TIER)
    if (t === 'weekly' || t === 'monthly' || t === 'free') return t
    return defaultState.subscriptionTier
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_BALANCE, String(balance))
  }, [balance])
  useEffect(() => {
    localStorage.setItem(STORAGE_LAST_DAILY_ENTRY, lastDailyEntryAt ?? '')
  }, [lastDailyEntryAt])
  useEffect(() => {
    localStorage.setItem(STORAGE_SUBSCRIPTION_TIER, subscriptionTier)
  }, [subscriptionTier])

  const setBalance = useCallback((n: number | ((prev: number) => number)) => {
    setBalanceState((prev) => (typeof n === 'function' ? n(prev) : n))
  }, [])
  const setLastDailyEntryAt = useCallback((iso: string | null) => {
    setLastDailyEntryAtState(iso)
  }, [])
  const setSubscriptionTier = useCallback((tier: SubscriptionTier) => {
    setSubscriptionTierState(tier)
  }, [])

  const addPoints = useCallback((amount: number) => {
    setBalanceState((prev) => Math.max(0, prev + amount))
  }, [])

  const useFreeEntry = useCallback(() => {
    setLastDailyEntryAtState(new Date().toISOString())
  }, [])

  const spendPointsForEntry = useCallback(
    (cost: number): boolean => {
      if (balance < cost) return false
      setBalanceState((prev) => Math.max(0, prev - cost))
      return true
    },
    [balance]
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
