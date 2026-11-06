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
import { supabase } from '../lib/supabase'
import type { AutoFillData } from '../types/profile'
import type { FeatureFlags } from '../lib/monetization/tiers'
import { FREE_SMART_FILLS_DEFAULT } from '../lib/monetization/tiers'
import { getItem, setItem, removeItem } from '../lib/utils/storage'

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
  streak_grace_available: boolean
  last_comeback_bonus_at: string | null
  iap_product_id: string | null
  iap_expires_at: string | null
  feature_flags: FeatureFlags
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  loading: boolean
  authReady: boolean
  isGuest: boolean
  needsEmailConfirm: boolean
  pendingEmail: string | null
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  continueAsGuest: () => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  updateProfile: (patch: Partial<UserProfile>) => Promise<{ error: string | null }>
  clearEmailConfirm: () => void
}

const GUEST_LS_KEY = 'looniewins_guest_profile'
const GUEST_MODE_KEY = 'looniewins_guest_mode'

async function readGuestLocal(): Promise<Partial<UserProfile>> {
  try {
    const raw = await getItem(GUEST_LS_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Partial<UserProfile>
  } catch {
    return {}
  }
}

async function writeGuestLocal(profile: UserProfile): Promise<void> {
  try {
    const slim = {
      points_balance: profile.points_balance,
      weekly_entries_used: profile.weekly_entries_used,
      weekly_entries_reset_at: profile.weekly_entries_reset_at,
      subscription_tier: profile.subscription_tier,
      is_premium: profile.is_premium,
      xp: profile.xp,
      level: profile.level,
      streak: profile.streak,
      last_streak_at: profile.last_streak_at,
      streak_grace_available: profile.streak_grace_available,
      last_comeback_bonus_at: profile.last_comeback_bonus_at,
      smart_fills_remaining: profile.smart_fills_remaining,
      settings: profile.settings,
      feature_flags: profile.feature_flags,
      auto_fill_data: profile.auto_fill_data,
    }
    await setItem(GUEST_LS_KEY, JSON.stringify(slim))
  } catch {
    /* quota */
  }
}

async function guestProfile(): Promise<UserProfile> {
  const local = await readGuestLocal()
  const tier = local.subscription_tier
  const subscription_tier: SubscriptionTier =
    tier === 'weekly' || tier === 'monthly' || tier === 'free' ? tier : 'free'
  const weeklyUsed = local.weekly_entries_used ?? 0
  const weeklyReset =
    local.weekly_entries_reset_at ??
    (weeklyUsed > 0 ? new Date().toISOString() : null)
  return {
    id: 'local-guest',
    email: null,
    display_name: 'Guest',
    is_premium: local.is_premium ?? subscription_tier !== 'free',
    points_balance: local.points_balance ?? 1250,
    xp: local.xp ?? 0,
    level: local.level ?? 1,
    streak: local.streak ?? 0,
    auto_fill_data: local.auto_fill_data ?? {},
    settings: { welcome_granted: true, ...(local.settings ?? {}) },
    smart_fills_remaining: local.smart_fills_remaining ?? FREE_SMART_FILLS_DEFAULT,
    last_daily_entry_at: local.last_daily_entry_at ?? null,
    subscription_tier,
    referral_code: null,
    referred_by: null,
    weekly_entries_used: weeklyUsed,
    weekly_entries_reset_at: weeklyReset,
    last_streak_at: local.last_streak_at ?? null,
    streak_grace_available: local.streak_grace_available !== false,
    last_comeback_bonus_at: local.last_comeback_bonus_at ?? null,
    iap_product_id: local.iap_product_id ?? null,
    iap_expires_at: local.iap_expires_at ?? null,
    feature_flags: local.feature_flags ?? {},
  }
}

const AuthContext = createContext<AuthContextValue | null>(null)

function mapProfile(row: Record<string, unknown>): UserProfile {
  const tier = row.subscription_tier
  const subscription_tier: SubscriptionTier =
    tier === 'weekly' || tier === 'monthly' || tier === 'free' ? tier : 'free'
  return {
    id: String(row.id),
    email: (row.email as string | null) ?? null,
    display_name: (row.display_name as string | null) ?? null,
    is_premium: Boolean(row.is_premium),
    points_balance: Number(row.points_balance ?? 0),
    xp: Number(row.xp ?? 0),
    level: Number(row.level ?? 1),
    streak: Number(row.streak ?? 0),
    auto_fill_data: (row.auto_fill_data ?? {}) as AutoFillData,
    settings: (row.settings as Record<string, unknown>) ?? {},
    smart_fills_remaining: Number(row.smart_fills_remaining ?? FREE_SMART_FILLS_DEFAULT),
    last_daily_entry_at: (row.last_daily_entry_at as string | null) ?? null,
    subscription_tier,
    referral_code: (row.referral_code as string | null) ?? null,
    referred_by: (row.referred_by as string | null) ?? null,
    weekly_entries_used: Number(row.weekly_entries_used ?? 0),
    weekly_entries_reset_at: (row.weekly_entries_reset_at as string | null) ?? null,
    last_streak_at: (row.last_streak_at as string | null) ?? null,
    streak_grace_available: row.streak_grace_available !== false,
    last_comeback_bonus_at: (row.last_comeback_bonus_at as string | null) ?? null,
    iap_product_id: (row.iap_product_id as string | null) ?? null,
    iap_expires_at: (row.iap_expires_at as string | null) ?? null,
    feature_flags: (row.feature_flags as FeatureFlags) ?? {},
  }
}

async function ensureProfile(user: User): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (error) console.warn('[Auth] load profile:', error.message)
  if (data) return mapProfile(data as Record<string, unknown>)

  const display =
    (user.user_metadata?.display_name as string | undefined) ||
    user.email?.split('@')[0] ||
    'Contester'

  const { data: inserted, error: insertErr } = await supabase
    .from('profiles')
    .upsert({ id: user.id, email: user.email, display_name: display }, { onConflict: 'id' })
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
  const [isGuest, setIsGuest] = useState(false)
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)

  const loadForSession = useCallback(async (next: Session | null) => {
    setSession(next)
    setUser(next?.user ?? null)
    if (next?.user) {
      setIsGuest(false)
      await removeItem(GUEST_MODE_KEY)
      setProfile(await ensureProfile(next.user))
      return
    }
    const guestFlag = await getItem(GUEST_MODE_KEY)
    if (guestFlag === '1') {
      setIsGuest(true)
      setProfile(await guestProfile())
      return
    }
    setIsGuest(false)
    setProfile(null)
  }, [])

  useEffect(() => {
    let mounted = true
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
    if (!user) {
      if (isGuest) setProfile(await guestProfile())
      else setProfile(null)
      return
    }
    setProfile(await ensureProfile(user))
  }, [user, isGuest])

  const signUp = useCallback(
    async (email: string, password: string, displayName?: string) => {
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
      setNeedsEmailConfirm(true)
      setPendingEmail(email.trim())
      return { error: null }
    },
    [loadForSession]
  )

  const signIn = useCallback(
    async (email: string, password: string) => {
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

  const continueAsGuest = useCallback(async () => {
    await setItem(GUEST_MODE_KEY, '1')
    setIsGuest(true)
    setSession(null)
    setUser(null)
    setProfile(await guestProfile())
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    await removeItem(GUEST_MODE_KEY)
    setIsGuest(false)
    setSession(null)
    setUser(null)
    setProfile(null)
  }, [])

  const updateProfile = useCallback(
    async (patch: Partial<UserProfile>) => {
      if (!user) {
        setProfile((prev) => {
          const base = prev ?? {
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
            subscription_tier: 'free' as const,
            referral_code: null,
            referred_by: null,
            weekly_entries_used: 0,
            weekly_entries_reset_at: null,
            last_streak_at: null,
            streak_grace_available: true,
            last_comeback_bonus_at: null,
            iap_product_id: null,
            iap_expires_at: null,
            feature_flags: {},
          }
          const next: UserProfile = {
            ...base,
            ...patch,
            auto_fill_data: patch.auto_fill_data ?? base.auto_fill_data,
            settings: patch.settings ?? base.settings,
            feature_flags: patch.feature_flags ?? base.feature_flags,
          }
          void writeGuestLocal(next)
          return next
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
      if (patch.weekly_entries_used !== undefined)
        payload.weekly_entries_used = patch.weekly_entries_used
      if (patch.weekly_entries_reset_at !== undefined)
        payload.weekly_entries_reset_at = patch.weekly_entries_reset_at
      if (patch.last_streak_at !== undefined) payload.last_streak_at = patch.last_streak_at
      if (patch.streak_grace_available !== undefined)
        payload.streak_grace_available = patch.streak_grace_available
      if (patch.last_comeback_bonus_at !== undefined)
        payload.last_comeback_bonus_at = patch.last_comeback_bonus_at
      if (patch.iap_product_id !== undefined) payload.iap_product_id = patch.iap_product_id
      if (patch.iap_expires_at !== undefined) payload.iap_expires_at = patch.iap_expires_at
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

  const value = useMemo(
    () => ({
      session,
      user,
      profile,
      loading,
      authReady,
      isGuest,
      needsEmailConfirm,
      pendingEmail,
      signUp,
      signIn,
      continueAsGuest,
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
      isGuest,
      needsEmailConfirm,
      pendingEmail,
      signUp,
      signIn,
      continueAsGuest,
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
