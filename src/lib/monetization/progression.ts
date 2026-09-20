import { isSupabaseConfigured, supabase } from '../supabase'
import {
  XP_ENTERED,
  XP_SUBMITTED,
  levelForXp,
  startOfUtcWeek,
  type FeatureFlags,
} from './tiers'

export interface ProgressResult {
  ok: boolean
  xp_gained?: number
  xp?: number
  level?: number
  streak?: number
  reason?: string
  local?: boolean
}

export interface ConsumeEntryResult {
  ok: boolean
  reason?: string
  weekly_used?: number
  weekly_cap?: number | null
  is_pro?: boolean
  local?: boolean
}

export interface ConsumeSmartFillResult {
  ok: boolean
  remaining?: number | null
  unlimited?: boolean
  reason?: string
  local?: boolean
}

type ProfileLike = {
  xp: number
  level: number
  streak: number
  last_streak_at?: string | null
  weekly_entries_used?: number
  weekly_entries_reset_at?: string | null
  smart_fills_remaining?: number
  subscription_tier?: string
  is_premium?: boolean
  feature_flags?: FeatureFlags
}

function nextStreak(lastStreakAt: string | null | undefined, current: number): {
  streak: number
  last_streak_at: string
} {
  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)
  const yesterday = new Date(today)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const yIso = yesterday.toISOString().slice(0, 10)

  if (!lastStreakAt) return { streak: 1, last_streak_at: todayIso }
  if (lastStreakAt === todayIso) return { streak: Math.max(current, 1), last_streak_at: todayIso }
  if (lastStreakAt === yIso) return { streak: current + 1, last_streak_at: todayIso }
  return { streak: 1, last_streak_at: todayIso }
}

/** Local/guest fallback mirroring RPC award_entry_progress rules. */
export function computeLocalProgress(
  profile: ProfileLike,
  opts: { firstEnter: boolean; firstSubmit: boolean }
): { xp: number; level: number; streak: number; last_streak_at: string; xp_gained: number } {
  let xpGain = 0
  if (opts.firstEnter) xpGain += XP_ENTERED
  if (opts.firstSubmit) xpGain += XP_SUBMITTED
  const xp = profile.xp + xpGain
  const streakPatch =
    xpGain > 0
      ? nextStreak(profile.last_streak_at, profile.streak)
      : {
          streak: profile.streak,
          last_streak_at: profile.last_streak_at || new Date().toISOString().slice(0, 10),
        }
  return {
    xp,
    level: levelForXp(xp),
    streak: streakPatch.streak,
    last_streak_at: streakPatch.last_streak_at,
    xp_gained: xpGain,
  }
}

export async function rpcAwardEntryProgress(
  contestId: string,
  status: string
): Promise<ProgressResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, reason: 'no_supabase', local: true }
  }
  const { data, error } = await supabase.rpc('award_entry_progress', {
    p_contest_id: contestId,
    p_status: status,
  })
  if (error) {
    console.warn('[Progress] RPC:', error.message)
    return { ok: false, reason: error.message, local: true }
  }
  const row = (data ?? {}) as ProgressResult
  return { ...row, ok: Boolean(row.ok) }
}

export async function rpcConsumeFreeEntry(weeklyCap = 7): Promise<ConsumeEntryResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, reason: 'no_supabase', local: true }
  }
  const { data, error } = await supabase.rpc('consume_free_entry', {
    p_weekly_cap: weeklyCap,
  })
  if (error) {
    console.warn('[Limits] consume_free_entry:', error.message)
    return { ok: false, reason: error.message, local: true }
  }
  const row = (data ?? {}) as ConsumeEntryResult
  return { ...row, ok: Boolean(row.ok) }
}

export async function rpcConsumeSmartFill(): Promise<ConsumeSmartFillResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, reason: 'no_supabase', local: true }
  }
  const { data, error } = await supabase.rpc('consume_smart_fill')
  if (error) {
    console.warn('[Limits] consume_smart_fill:', error.message)
    return { ok: false, reason: error.message, local: true }
  }
  const row = (data ?? {}) as ConsumeSmartFillResult
  return { ...row, ok: Boolean(row.ok) }
}

export async function rpcCreditReferralClick(referralId: string): Promise<{
  ok: boolean
  reason?: string
  points_awarded?: number
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, reason: 'no_supabase' }
  }
  const { data, error } = await supabase.rpc('credit_referral_click', {
    p_referral_id: referralId,
  })
  if (error) return { ok: false, reason: error.message }
  const row = (data ?? {}) as { ok?: boolean; reason?: string; points_awarded?: number }
  return { ok: Boolean(row.ok), reason: row.reason, points_awarded: row.points_awarded }
}

export async function rpcApplyReferralCode(code: string): Promise<{
  ok: boolean
  reason?: string
  referee_points?: number
  referrer_points?: number
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, reason: 'no_supabase' }
  }
  const { data, error } = await supabase.rpc('apply_referral_code', { p_code: code })
  if (error) return { ok: false, reason: error.message }
  const row = (data ?? {}) as {
    ok?: boolean
    reason?: string
    referee_points?: number
    referrer_points?: number
  }
  return {
    ok: Boolean(row.ok),
    reason: row.reason,
    referee_points: row.referee_points,
    referrer_points: row.referrer_points,
  }
}

export async function rpcEnsureReferralCode(): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null
  const { data, error } = await supabase.rpc('ensure_referral_code')
  if (error) {
    console.warn('[Referral] ensure code:', error.message)
    return null
  }
  return typeof data === 'string' ? data : null
}

export function localConsumeWeeklyEntry(
  used: number,
  resetAt: string | null | undefined,
  cap: number
): { ok: boolean; weekly_used: number; weekly_entries_reset_at: string; reason?: string } {
  const weekStart = startOfUtcWeek().toISOString()
  const normalized =
    !resetAt || new Date(resetAt) < startOfUtcWeek() ? 0 : Math.max(0, used)
  if (normalized >= cap) {
    return {
      ok: false,
      weekly_used: normalized,
      weekly_entries_reset_at: resetAt || weekStart,
      reason: 'weekly_cap_reached',
    }
  }
  return {
    ok: true,
    weekly_used: normalized + 1,
    weekly_entries_reset_at: weekStart,
  }
}
