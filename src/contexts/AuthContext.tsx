import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { AutoFillData } from '../types/profile'
import type { FeatureFlags } from '../lib/monetization/tiers'
import { FREE_SMART_FILLS_DEFAULT } from '../lib/monetization/tiers'

export type SubscriptionTier = 'free' | 'weekly' | 'monthly'

export interface UserProfile {
  id: string
  email: string | null
  display_name: string | null
  is_premium: boolean
  points_balance: number
  xp: number
  level: number
  streak: number
  auto_fill_data: AutoFillData
  settings: Record<string, unknown>
  smart_fills_remaining: number
  last_daily_entry_at: string | null
  subscription_tier: SubscriptionTier
  referral_code: string | null
  referred_by: string | null
  weekly_entries_used: number
  weekly_entries_reset_at: string | null
  last_streak_at: string | null
  feature_flags: FeatureFlags
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  loading: boolean
  authReady: boolean
  needsEmailConfirm: boolean
  pendingEmail: string | null
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  updateProfile: (patch: Partial<UserProfile>) => Promise<{ error: string | null }>
  clearEmailConfirm: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function mapProfile(row: Record<string, unknown>): UserProfile {
  const tier = row.subscription_tier
  const subscription_tier: SubscriptionTier =
    tier === 'weekly' || tier === 'monthly' || tier === 'free' ? tier : 'free'
  const auto = (row.auto_fill_data ?? {}) as AutoFillData
  return {
    id: String(row.id),
    email: (row.email as string | null) ?? null,
    display_name: (row.display_name as string | null) ?? null,
    is_premium: Boolean(row.is_premium),
    points_balance: Number(row.points_balance ?? 0),
    xp: Number(row.xp ?? 0),
    level: Number(row.level ?? 1),
    streak: Number(row.streak ?? 0),
    auto_fill_data: auto,
    settings: (row.settings as Record<string, unknown>) ?? {},
    smart_fills_remaining: Number(row.smart_fills_remaining ?? FREE_SMART_FILLS_DEFAULT),
    last_daily_entry_at: (row.last_daily_entry_at as string | null) ?? null,
    subscription_tier,
    referral_code: (row.referral_code as string | null) ?? null,
    referred_by: (row.referred_by as string | null) ?? null,
    weekly_entries_used: Number(row.weekly_entries_used ?? 0),
    weekly_entries_reset_at: (row.weekly_entries_reset_at as string | null) ?? null,
    last_streak_at: (row.last_streak_at as string | null) ?? null,
    feature_flags: (row.feature_flags as FeatureFlags) ?? {},
  }
}

function guestProfile(): UserProfile {
  return {
    id: 'local-guest',
    email: null,
    display_name: 'Guest',
    is_premium: false,
    points_balance: 1250,
    xp: 0,
    level: 1,
    streak: 0,
    auto_fill_data: {},
    settings: { welcome_granted: true },
    smart_fills_remaining: FREE_SMART_FILLS_DEFAULT,
    last_daily_entry_at: null,
    subscription_tier: 'free',
    referral_code: null,
    referred_by: null,
    weekly_entries_used: 0,
    weekly_entries_reset_at: null,
    last_streak_at: null,
    feature_flags: {},
  }
}

async function ensureProfile(user: User): Promise<UserProfile | null> {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.warn('[Auth] load profile:', error.message)
  }
  if (data) return mapProfile(data as Record<string, unknown>)

  const display =
    (user.user_metadata?.display_name as string | undefined) ||
    user.email?.split('@')[0] ||
    'Contester'

  const { data: inserted, error: insertErr } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        email: user.email,
        display_name: display,
      },
      { onConflict: 'id' }
    )
    .select('*')
    .maybeSingle()

  if (insertErr) {
    console.warn('[Auth] ensure profile:', insertErr.message)
    return null
  }
  return inserted ? mapProfile(inserted as Record<string, unknown>) : null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [authReady, setAuthReady] = useState(false)
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)

  const loadForSession = useCallback(async (next: Session | null) => {
    setSession(next)
    setUser(next?.user ?? null)
    if (!next?.user) {
      setProfile(null)
      return
    }
    const p = await ensureProfile(next.user)
    setProfile(p)
  }, [])

  useEffect(() => {
    let mounted = true
    if (!supabase || !isSupabaseConfigured) {
      // Guest demo profile so earn/autofill/entry limits work offline
      setProfile(guestProfile())
      setLoading(false)
      setAuthReady(true)
      return () => {
        mounted = false
      }
    }

    ;(async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) console.warn('[Auth] getSession:', error.message)
        if (!mounted) return
        await loadForSession(data.session)
      } finally {
        if (mounted) {
          setLoading(false)
          setAuthReady(true)
        }
      }
    })()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      void loadForSession(next)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [loadForSession])

  const refreshProfile = useCallback(async () => {
    if (!user || !supabase) {
      setProfile(null)
      return
    }
    const p = await ensureProfile(user)
    setProfile(p)
  }, [user])

  const signUp = useCallback(
    async (email: string, password: string, displayName?: string) => {
      if (!supabase) return { error: 'Supabase is not configured' }
      setNeedsEmailConfirm(false)
      setPendingEmail(null)
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { display_name: displayName?.trim() || email.trim().split('@')[0] },
        },
      })
      if (error) return { error: error.message }
      if (data.session) {
        await loadForSession(data.session)
        return { error: null }
      }
      // Confirm-email enabled: no session until user confirms
      setNeedsEmailConfirm(true)
      setPendingEmail(email.trim())
      return { error: null }
    },
    [loadForSession]
  )

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!supabase) return { error: 'Supabase is not configured' }
      setNeedsEmailConfirm(false)
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) return { error: error.message }
      await loadForSession(data.session)
      return { error: null }
    },
    [loadForSession]
  )

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setProfile(null)
  }, [])

  const updateProfile = useCallback(
    async (patch: Partial<UserProfile>) => {
      // Guest / offline profile lives in memory (+ autofill mirrored to localStorage by callers)
      if (!user || !supabase) {
        setProfile((prev) => {
          const base = prev ?? guestProfile()
          return {
            ...base,
            ...patch,
            auto_fill_data: patch.auto_fill_data ?? base.auto_fill_data,
            settings: patch.settings ?? base.settings,
            feature_flags: patch.feature_flags ?? base.feature_flags,
          }
        })
        return { error: null }
      }
      const payload: Record<string, unknown> = {}
      if (patch.display_name !== undefined) payload.display_name = patch.display_name
      if (patch.points_balance !== undefined) payload.points_balance = patch.points_balance
      if (patch.xp !== undefined) payload.xp = patch.xp
      if (patch.level !== undefined) payload.level = patch.level
      if (patch.streak !== undefined) payload.streak = patch.streak
      if (patch.auto_fill_data !== undefined) payload.auto_fill_data = patch.auto_fill_data
      if (patch.settings !== undefined) payload.settings = patch.settings
      if (patch.smart_fills_remaining !== undefined)
        payload.smart_fills_remaining = patch.smart_fills_remaining
      if (patch.last_daily_entry_at !== undefined)
        payload.last_daily_entry_at = patch.last_daily_entry_at
      if (patch.subscription_tier !== undefined) payload.subscription_tier = patch.subscription_tier
      if (patch.is_premium !== undefined) payload.is_premium = patch.is_premium
      if (patch.email !== undefined) payload.email = patch.email
      if (patch.referral_code !== undefined) payload.referral_code = patch.referral_code
      if (patch.referred_by !== undefined) payload.referred_by = patch.referred_by
      if (patch.weekly_entries_used !== undefined)
        payload.weekly_entries_used = patch.weekly_entries_used
      if (patch.weekly_entries_reset_at !== undefined)
        payload.weekly_entries_reset_at = patch.weekly_entries_reset_at
      if (patch.last_streak_at !== undefined) payload.last_streak_at = patch.last_streak_at
      if (patch.feature_flags !== undefined) payload.feature_flags = patch.feature_flags

      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.id)
        .select('*')
        .maybeSingle()

      if (error) return { error: error.message }
      if (data) setProfile(mapProfile(data as Record<string, unknown>))
      return { error: null }
    },
    [user]
  )

  const clearEmailConfirm = useCallback(() => {
    setNeedsEmailConfirm(false)
    setPendingEmail(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      loading,
      authReady,
      needsEmailConfirm,
      pendingEmail,
      signUp,
      signIn,
      signOut,
      refreshProfile,
      updateProfile,
      clearEmailConfirm,
    }),
    [
      session,
      user,
      profile,
      loading,
      authReady,
      needsEmailConfirm,
      pendingEmail,
      signUp,
      signIn,
      signOut,
      refreshProfile,
      updateProfile,
      clearEmailConfirm,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
