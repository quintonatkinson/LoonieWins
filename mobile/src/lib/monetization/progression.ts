import { supabase } from '../supabase'
import {
  XP_ENTERED,
  XP_SUBMITTED,
  COMEBACK_BONUS_XP,
  COMEBACK_BONUS_POINTS,
  levelForXp,
  startOfUtcWeek,
  type FeatureFlags,
} from './tiers'

const configured = Boolean(
  process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
)

export interface ProgressResult {
  ok: boolean
  xp_gained?: number
  xp?: number
  level?: number
  streak?: number
  reason?: string
  local?: boolean
  used_grace?: boolean
  comeback_points?: number
  comeback_xp?: number
  streak_grace_available?: boolean
}

export interface ConsumeEntryResult {
  ok: boolean
  reason?: string
  weekly_used?: number
  weekly_cap?: number | null
  is_pro?: boolean
  local?: boolean
}

type ProfileLike = {
  xp: number
  level: number
  streak: number
  last_streak_at?: string | null
  streak_grace_available?: boolean
  last_comeback_bonus_at?: string | null
  weekly_entries_used?: number
  weekly_entries_reset_at?: string | null
  smart_fills_remaining?: number
  subscription_tier?: string
  is_premium?: boolean
  feature_flags?: FeatureFlags
  points_balance?: number
}

function utcDateOffset(days: number, from = new Date()): string {
  const d = new Date(from)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function nextStreakWithGrace(
  lastStreakAt: string | null | undefined,
  current: number,
  graceAvailable = true,
  lastComebackAt?: string | null
): {
  streak: number
  last_streak_at: string
  streak_grace_available: boolean
  used_grace: boolean
  comeback_xp: number
  comeback_points: number
  last_comeback_bonus_at: string | null
} {
  const todayIso = utcDateOffset(0)
  const yIso = utcDateOffset(-1)
  const graceIso = utcDateOffset(-2)

  if (!lastStreakAt) {
    return {
      streak: 1,
      last_streak_at: todayIso,
      streak_grace_available: true,
      used_grace: false,
      comeback_xp: 0,
      comeback_points: 0,
      last_comeback_bonus_at: lastComebackAt ?? null,
    }
  }
  if (lastStreakAt === todayIso) {
    return {
      streak: Math.max(current, 1),
      last_streak_at: todayIso,
      streak_grace_available: graceAvailable,
      used_grace: false,
      comeback_xp: 0,
      comeback_points: 0,
      last_comeback_bonus_at: lastComebackAt ?? null,
    }
  }
  if (lastStreakAt === yIso) {
    return {
      streak: current + 1,
      last_streak_at: todayIso,
      streak_grace_available: graceAvailable,
      used_grace: false,
      comeback_xp: 0,
      comeback_points: 0,
      last_comeback_bonus_at: lastComebackAt ?? null,
    }
  }
  if (lastStreakAt === graceIso && graceAvailable) {
    return {
      streak: current + 1,
      last_streak_at: todayIso,
      streak_grace_available: false,
      used_grace: true,
      comeback_xp: 0,
      comeback_points: 0,
      last_comeback_bonus_at: lastComebackAt ?? null,
    }
  }

  const giveComeback = current >= 3 && (!lastComebackAt || lastComebackAt < todayIso)
  return {
    streak: 1,
    last_streak_at: todayIso,
    streak_grace_available: true,
    used_grace: false,
    comeback_xp: giveComeback ? COMEBACK_BONUS_XP : 0,
    comeback_points: giveComeback ? COMEBACK_BONUS_POINTS : 0,
    last_comeback_bonus_at: giveComeback ? todayIso : lastComebackAt ?? null,
  }
}

export function computeLocalProgress(
  profile: ProfileLike,
  opts: { firstEnter: boolean; firstSubmit: boolean }
): {
  xp: number
  level: number
  streak: number
  last_streak_at: string
  xp_gained: number
  streak_grace_available: boolean
  used_grace: boolean
  comeback_points: number
  comeback_xp: number
  last_comeback_bonus_at: string | null
  points_balance?: number
} {
  let xpGain = 0
  if (opts.firstEnter) xpGain += XP_ENTERED
  if (opts.firstSubmit) xpGain += XP_SUBMITTED

  if (xpGain <= 0) {
    return {
      xp: profile.xp,
      level: profile.level,
      streak: profile.streak,
      last_streak_at: profile.last_streak_at || utcDateOffset(0),
      xp_gained: 0,
      streak_grace_available: profile.streak_grace_available ?? true,
      used_grace: false,
      comeback_points: 0,
      comeback_xp: 0,
      last_comeback_bonus_at: profile.last_comeback_bonus_at ?? null,
      points_balance: profile.points_balance,
    }
  }

  const streakPatch = nextStreakWithGrace(
    profile.last_streak_at,
    profile.streak,
    profile.streak_grace_available ?? true,
    profile.last_comeback_bonus_at
  )
  const xp = profile.xp + xpGain + streakPatch.comeback_xp
  return {
    xp,
    level: levelForXp(xp),
    streak: streakPatch.streak,
    last_streak_at: streakPatch.last_streak_at,
    xp_gained: xpGain + streakPatch.comeback_xp,
    streak_grace_available: streakPatch.streak_grace_available,
    used_grace: streakPatch.used_grace,
    comeback_points: streakPatch.comeback_points,
    comeback_xp: streakPatch.comeback_xp,
    last_comeback_bonus_at: streakPatch.last_comeback_bonus_at,
    points_balance:
      profile.points_balance != null
        ? profile.points_balance + streakPatch.comeback_points
        : undefined,
  }
}

export async function rpcAwardEntryProgress(
  contestId: string,
  status: string
): Promise<ProgressResult> {
  if (!configured) return { ok: false, reason: 'no_supabase', local: true }
  const { data, error } = await supabase.rpc('award_entry_progress', {
    p_contest_id: contestId,
    p_status: status,
  })
  if (error) return { ok: false, reason: error.message, local: true }
  const row = (data ?? {}) as ProgressResult
  return { ...row, ok: Boolean(row.ok) }
}

export async function rpcConsumeFreeEntry(weeklyCap = 7): Promise<ConsumeEntryResult> {
  if (!configured) return { ok: false, reason: 'no_supabase', local: true }
  const { data, error } = await supabase.rpc('consume_free_entry', {
    p_weekly_cap: weeklyCap,
  })
  if (error) return { ok: false, reason: error.message, local: true }
  const row = (data ?? {}) as ConsumeEntryResult
  return { ...row, ok: Boolean(row.ok) }
}

export async function rpcConsumeSmartFill(): Promise<{
  ok: boolean
  remaining?: number | null
  unlimited?: boolean
  reason?: string
  local?: boolean
}> {
  if (!configured) return { ok: false, reason: 'no_supabase', local: true }
  const { data, error } = await supabase.rpc('consume_smart_fill')
  if (error) return { ok: false, reason: error.message, local: true }
  const row = (data ?? {}) as {
    ok?: boolean
    remaining?: number | null
    unlimited?: boolean
    reason?: string
  }
  return { ...row, ok: Boolean(row.ok) }
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
