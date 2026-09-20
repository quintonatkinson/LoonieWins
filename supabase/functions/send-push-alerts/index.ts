/**
 * LoonieWins push alerts — Expo Push API.
 *
 * Modes:
 *   - new_contests: contests created recently matching CA / US prefs
 *   - ending_tonight: contests with expiry_date later today (America/Toronto)
 *       Pro (is_premium / weekly|monthly / priority_sources): priority + guaranteed (no free cap)
 *       Free: normal priority, capped per run (FREE_ENDING_CAP)
 *
 * Deploy:
 *   supabase functions deploy send-push-alerts
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: EXPO_ACCESS_TOKEN (recommended for production Expo push)
 *
 * Schedule: see supabase/cron_push_alerts.sql + docs/push-digest.md
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type AlertMode = 'new_contests' | 'ending_tonight'

interface NotificationPrefs {
  enabled: boolean
  newContestsCA: boolean
  newContestsUS: boolean
  endingTonight: boolean
}

interface ContestRow {
  id: string
  title: string
  eligibility: string | null
  expiry_date: string | null
  created_at: string
}

interface TokenRow {
  user_id: string
  expo_push_token: string
}

interface ProfileRow {
  id: string
  settings: Record<string, unknown> | null
  is_premium?: boolean | null
  subscription_tier?: string | null
  feature_flags?: Record<string, unknown> | null
  email?: string | null
}

interface ExpoMessage {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: string
  priority?: 'default' | 'normal' | 'high'
  channelId?: string
  interruptionLevel?: 'active' | 'timeSensitive' | 'critical'
}

/** Free users: max ending-tonight alerts per cron run (Pro = unlimited / guaranteed). */
const FREE_ENDING_CAP = 3

const DEFAULT_PREFS: NotificationPrefs = {
  enabled: true,
  newContestsCA: true,
  newContestsUS: false,
  endingTonight: true,
}

function parsePrefs(settings: Record<string, unknown> | null | undefined): NotificationPrefs {
  const raw = (settings?.notifications ?? {}) as Record<string, unknown>
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_PREFS.enabled,
    newContestsCA:
      typeof raw.newContestsCA === 'boolean' ? raw.newContestsCA : DEFAULT_PREFS.newContestsCA,
    newContestsUS:
      typeof raw.newContestsUS === 'boolean' ? raw.newContestsUS : DEFAULT_PREFS.newContestsUS,
    endingTonight:
      typeof raw.endingTonight === 'boolean' ? raw.endingTonight : DEFAULT_PREFS.endingTonight,
  }
}

function isProUser(p: ProfileRow | undefined): boolean {
  if (!p) return false
  if (p.is_premium) return true
  const tier = (p.subscription_tier ?? 'free').toLowerCase()
  if (tier === 'weekly' || tier === 'monthly') return true
  if (p.feature_flags?.priority_sources === true) return true
  return false
}

/** End of "today" in America/Toronto as ISO (UTC). */
function torontoEndOfDayIso(now = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = fmt.formatToParts(now)
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  const d = parts.find((p) => p.type === 'day')?.value
  const dateStr = `${y}-${m}-${d}`
  const probe = new Date(`${dateStr}T12:00:00Z`)
  const torontoHour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Toronto',
      hour: 'numeric',
      hour12: false,
    }).format(probe)
  )
  const utcMs =
    Date.UTC(Number(y), Number(m) - 1, Number(d), 23, 59, 59, 999) -
    (torontoHour - 12) * 60 * 60 * 1000
  return new Date(utcMs).toISOString()
}

function wantsNewContest(c: ContestRow, prefs: NotificationPrefs): boolean {
  if (!prefs.enabled) return false
  if (!prefs.newContestsCA && !prefs.newContestsUS) return false
  const elig = (c.eligibility ?? 'Unknown').toUpperCase()
  if (elig === 'CA' || elig === 'UNKNOWN') return prefs.newContestsCA
  if (elig === 'US') return prefs.newContestsUS
  if (elig === 'NA') return prefs.newContestsCA || prefs.newContestsUS
  return prefs.newContestsCA
}

async function sendExpoPush(messages: ExpoMessage[]): Promise<{ ok: number; failed: number }> {
  if (messages.length === 0) return { ok: 0, failed: 0 }
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  }
  const expoToken = Deno.env.get('EXPO_ACCESS_TOKEN')
  if (expoToken) headers.Authorization = `Bearer ${expoToken}`

  let ok = 0
  let failed = 0
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100)
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers,
      body: JSON.stringify(chunk),
    })
    if (!res.ok) {
      failed += chunk.length
      console.error('[send-push-alerts] Expo HTTP', res.status, await res.text())
      continue
    }
    const json = await res.json()
    const tickets = Array.isArray(json.data) ? json.data : [json.data]
    for (const t of tickets) {
      if (t?.status === 'ok') ok++
      else failed++
    }
  }
  return { ok, failed }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase env' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const modes: AlertMode[] = Array.isArray(body.modes)
      ? body.modes
      : (['new_contests', 'ending_tonight'] as AlertMode[])
    const lookbackMinutes = Number(body.lookbackMinutes ?? 90)
    const freeEndingCap = Number(body.freeEndingCap ?? FREE_ENDING_CAP)

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: tokens, error: tokenErr } = await admin
      .from('push_tokens')
      .select('user_id, expo_push_token')
    if (tokenErr) throw tokenErr
    const tokenRows = (tokens ?? []) as TokenRow[]
    if (tokenRows.length === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no_tokens' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userIds = [...new Set(tokenRows.map((t) => t.user_id))]
    const { data: profiles, error: profileErr } = await admin
      .from('profiles')
      .select('id, settings, is_premium, subscription_tier, feature_flags, email')
      .in('id', userIds)
    if (profileErr) throw profileErr

    const profileByUser = new Map<string, ProfileRow>()
    const prefsByUser = new Map<string, NotificationPrefs>()
    for (const p of (profiles ?? []) as ProfileRow[]) {
      profileByUser.set(p.id, p)
      prefsByUser.set(p.id, parsePrefs(p.settings))
    }

    const tokensByUser = new Map<string, string[]>()
    for (const t of tokenRows) {
      const list = tokensByUser.get(t.user_id) ?? []
      list.push(t.expo_push_token)
      tokensByUser.set(t.user_id, list)
    }

    // Pro first so ending-tonight priority batch goes out ahead of free-cap users
    const sortedUserIds = [...userIds].sort((a, b) => {
      const ap = isProUser(profileByUser.get(a)) ? 0 : 1
      const bp = isProUser(profileByUser.get(b)) ? 0 : 1
      return ap - bp
    })

    const messages: ExpoMessage[] = []
    const logRows: Array<{ user_id: string; contest_id: string; alert_type: string }> = []
    const freeEndingCount = new Map<string, number>()
    let proEndingQueued = 0
    let freeEndingQueued = 0

    // ---- New contests ----
    if (modes.includes('new_contests')) {
      const since = new Date(Date.now() - lookbackMinutes * 60 * 1000).toISOString()
      const { data: contests, error: cErr } = await admin
        .from('contests')
        .select('id, title, eligibility, expiry_date, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(200)
      if (cErr) throw cErr

      for (const c of (contests ?? []) as ContestRow[]) {
        for (const uid of sortedUserIds) {
          const prefs = prefsByUser.get(uid) ?? DEFAULT_PREFS
          if (!wantsNewContest(c, prefs)) continue

          const { data: existing } = await admin
            .from('push_alert_log')
            .select('id')
            .eq('user_id', uid)
            .eq('contest_id', c.id)
            .eq('alert_type', 'new_contest')
            .maybeSingle()
          if (existing) continue

          const region = (c.eligibility ?? 'CA').toUpperCase() === 'US' ? 'US' : 'CA'
          for (const to of tokensByUser.get(uid) ?? []) {
            messages.push({
              to,
              title: `New ${region} contest`,
              body: c.title?.slice(0, 120) || 'A new contest just landed',
              data: { type: 'new_contest', contestId: c.id },
              sound: 'default',
              channelId: 'looniewins-alerts',
              priority: 'default',
            })
          }
          logRows.push({ user_id: uid, contest_id: c.id, alert_type: 'new_contest' })
        }
      }
    }

    // ---- Ending tonight (Pro priority / guaranteed) ----
    if (modes.includes('ending_tonight')) {
      const nowIso = new Date().toISOString()
      const eodIso = torontoEndOfDayIso()
      const { data: ending, error: eErr } = await admin
        .from('contests')
        .select('id, title, eligibility, expiry_date, created_at')
        .gt('expiry_date', nowIso)
        .lte('expiry_date', eodIso)
        .order('expiry_date', { ascending: true })
        .limit(200)
      if (eErr) throw eErr

      for (const c of (ending ?? []) as ContestRow[]) {
        for (const uid of sortedUserIds) {
          const prefs = prefsByUser.get(uid) ?? DEFAULT_PREFS
          if (!prefs.enabled || !prefs.endingTonight) continue

          const pro = isProUser(profileByUser.get(uid))
          if (!pro) {
            const used = freeEndingCount.get(uid) ?? 0
            if (used >= freeEndingCap) continue
          }

          const { data: existing } = await admin
            .from('push_alert_log')
            .select('id')
            .eq('user_id', uid)
            .eq('contest_id', c.id)
            .eq('alert_type', 'ending_tonight')
            .maybeSingle()
          if (existing) continue

          for (const to of tokensByUser.get(uid) ?? []) {
            if (pro) {
              messages.push({
                to,
                title: 'Ending tonight · Pro',
                body: c.title?.slice(0, 120) || 'A contest expires tonight',
                data: { type: 'ending_tonight', contestId: c.id, priority: true },
                sound: 'default',
                priority: 'high',
                channelId: 'looniewins-ending-pro',
                interruptionLevel: 'timeSensitive',
              })
              proEndingQueued++
            } else {
              messages.push({
                to,
                title: 'Ending tonight',
                body: c.title?.slice(0, 120) || 'A contest expires tonight',
                data: { type: 'ending_tonight', contestId: c.id, priority: false },
                sound: 'default',
                priority: 'default',
                channelId: 'looniewins-alerts',
              })
              freeEndingQueued++
            }
          }
          logRows.push({ user_id: uid, contest_id: c.id, alert_type: 'ending_tonight' })
          if (!pro) {
            freeEndingCount.set(uid, (freeEndingCount.get(uid) ?? 0) + 1)
          }
        }
      }
    }

    const sendResult = await sendExpoPush(messages)

    if (logRows.length > 0) {
      const { error: logErr } = await admin.from('push_alert_log').upsert(logRows, {
        onConflict: 'user_id,contest_id,alert_type',
        ignoreDuplicates: true,
      })
      if (logErr) console.error('[send-push-alerts] log upsert', logErr.message)
    }

    return new Response(
      JSON.stringify({
        ok: true,
        modes,
        queued: messages.length,
        logRows: logRows.length,
        endingTonight: { pro: proEndingQueued, free: freeEndingQueued, freeCap: freeEndingCap },
        expo: sendResult,
        expoAccessTokenConfigured: Boolean(Deno.env.get('EXPO_ACCESS_TOKEN')),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[send-push-alerts]', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
