/**
 * Earn / spend points without a subscription — shared by web + mobile (mirrored by sync-shared).
 * Every balance change is a server RPC or a verified provider callback; nothing here trusts
 * the client with points.
 */
import { supabase } from '../supabase'

/** Mirrors claim_daily_checkin() in 20260927_earn_more.sql. */
export const CHECKIN_LADDER = [20, 30, 40, 50, 60, 80, 150] as const
export const PRO_PASS_COST = { 1: 1000, 7: 5000 } as const
export const SMART_FILL_PACK_COST = { 5: 200, 15: 500 } as const
/** Server defaults (admob-ssv secrets ADMOB_POINTS_PER_VIDEO / ADMOB_DAILY_CAP). */
export const REWARDED_VIDEO_POINTS = 20
export const REWARDED_VIDEO_DAILY_CAP = 30

export type ProPassDays = keyof typeof PRO_PASS_COST
export type SmartFillPack = keyof typeof SMART_FILL_PACK_COST

export interface RewardResult {
  ok: boolean
  reason?: string
  points_awarded?: number
  balance?: number
  streak?: number
  next_points?: number
  pro_pass_until?: string
  smart_fills_remaining?: number
  cost?: number
}

export interface Wall {
  id: 'bitlabs' | 'cpx' | 'adgem'
  title: string
  subtitle: string
  url: string
}

function utcToday(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export interface CheckinState {
  claimedToday: boolean
  /** Streak the next claim would reach (1–7 cycle shown in the ladder). */
  nextDay: number
  nextPoints: number
}

export function checkinState(
  profile: { checkin_streak?: number | null; last_checkin_on?: string | null } | null | undefined,
  now = new Date()
): CheckinState {
  const today = utcToday(now)
  const yesterday = utcToday(new Date(now.getTime() - 86_400_000))
  const last = profile?.last_checkin_on ?? null
  const streak = profile?.checkin_streak ?? 0
  const claimedToday = last === today
  const continuing = last === yesterday || claimedToday
  const nextStreak = claimedToday ? streak + 1 : continuing ? streak + 1 : 1
  const idx = (nextStreak - 1) % CHECKIN_LADDER.length
  return { claimedToday, nextDay: idx + 1, nextPoints: CHECKIN_LADDER[idx] }
}

export function proPassRemainingMs(until: string | null | undefined, now = Date.now()): number {
  const t = until ? Date.parse(until) : NaN
  return Number.isFinite(t) ? Math.max(0, t - now) : 0
}

export function formatPassRemaining(ms: number): string {
  if (ms <= 0) return ''
  const h = Math.floor(ms / 3_600_000)
  if (h >= 48) return `${Math.floor(h / 24)}d left`
  if (h >= 1) return `${h}h left`
  return `${Math.max(1, Math.round(ms / 60_000))}m left`
}

async function rpc(name: string, args?: Record<string, unknown>): Promise<RewardResult> {
  if (!supabase) return { ok: false, reason: 'offline' }
  const { data, error } = await supabase.rpc(name, args)
  if (error) return { ok: false, reason: error.message }
  return (data ?? { ok: false, reason: 'empty' }) as RewardResult
}

export const claimDailyCheckin = () => rpc('claim_daily_checkin')
export const redeemProPass = (days: ProPassDays) => rpc('redeem_pro_pass', { p_days: days })
export const buySmartFills = (pack: SmartFillPack) => rpc('buy_smart_fills', { p_pack: pack })

/** Signed, player-scoped survey / offer wall links (only walls you configured server-side). */
export async function fetchWalls(): Promise<Wall[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase.functions.invoke('offerwall-link')
    if (error || !data?.ok) return []
    return (data.walls ?? []) as Wall[]
  } catch {
    return []
  }
}

/** Rewarded videos credited today (for the "12 / 30 today" meter). */
export async function rewardedVideosToday(userId: string): Promise<number> {
  if (!supabase) return 0
  const start = `${utcToday()}T00:00:00.000Z`
  const { count } = await supabase
    .schema('tracking')
    .from('offerwall_completions')
    .select('id', { count: 'exact', head: true })
    .eq('player_id', userId)
    .eq('provider', 'admob')
    .gte('created_at', start)
  return count ?? 0
}

export function rewardErrorCopy(reason?: string): string {
  switch (reason) {
    case 'insufficient_points':
      return 'Not enough points yet — earn a few more below.'
    case 'already_claimed':
      return 'Already claimed today — come back tomorrow for a bigger bonus.'
    case 'offline':
    case 'not_authenticated':
      return 'Sign in to earn and spend points.'
    default:
      return 'Something went wrong — try again.'
  }
}
