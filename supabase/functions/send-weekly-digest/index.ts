/**
 * LoonieWins weekly digest email — Resend (preferred) or Supabase Auth SMTP fallback note.
 *
 * Body: “N new CA contests + M ending tonight” for the past 7 days / today.
 * Respects profiles.settings.notifications.weeklyDigestEmail (and master push is NOT required).
 *
 * Deploy:
 *   supabase functions deploy send-weekly-digest
 *
 * Secrets:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   RESEND_API_KEY          (required for live send)
 *   RESEND_FROM_EMAIL       (e.g. LoonieWins <digest@yourdomain.com>)
 * Optional:
 *   DIGEST_APP_URL          (link in email footer)
 *   DIGEST_DRY_RUN=true     (count only, no send)
 *
 * Schedule: Sundays ~14:00 UTC (see supabase/cron_weekly_digest.sql)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { isAuthorizedCronRequest, unauthorizedResponse } from '../_shared/cronAuth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationPrefs {
  weeklyDigestEmail: boolean
  newContestsCA: boolean
  endingTonight: boolean
}

interface ProfileRow {
  id: string
  email: string | null
  settings: Record<string, unknown> | null
}

function parseDigestPrefs(settings: Record<string, unknown> | null | undefined): NotificationPrefs {
  const raw = (settings?.notifications ?? {}) as Record<string, unknown>
  return {
    weeklyDigestEmail: raw.weeklyDigestEmail === true,
    newContestsCA: typeof raw.newContestsCA === 'boolean' ? raw.newContestsCA : true,
    endingTonight: typeof raw.endingTonight === 'boolean' ? raw.endingTonight : true,
  }
}

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

function weekKeyToronto(now = new Date()): string {
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const [y, m, d] = dateStr.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d))
  const dayNum = utc.getUTCDay() || 7
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

async function sendResendEmail(opts: {
  apiKey: string
  from: string
  to: string
  subject: string
  html: string
  text: string
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: opts.from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  })
  if (!res.ok) {
    return { ok: false, error: `${res.status} ${await res.text()}` }
  }
  return { ok: true }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (!isAuthorizedCronRequest(req)) return unauthorizedResponse(corsHeaders)

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const resendKey = Deno.env.get('RESEND_API_KEY') ?? ''
    const fromEmail =
      Deno.env.get('RESEND_FROM_EMAIL') ?? 'LoonieWins <onboarding@resend.dev>'
    const appUrl = Deno.env.get('DIGEST_APP_URL') ?? 'https://looniewins.app'
    const dryRun =
      Deno.env.get('DIGEST_DRY_RUN') === 'true' || body.dryRun === true

    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase env' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const sinceWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const nowIso = new Date().toISOString()
    const eodIso = torontoEndOfDayIso()
    const digestWeek = weekKeyToronto()

    // Counts: new CA (or Unknown) in last 7d; ending tonight window
    const { count: newCaCount, error: caErr } = await admin
      .from('contests')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sinceWeek)
      .or('eligibility.eq.CA,eligibility.eq.Unknown,eligibility.eq.NA,eligibility.is.null')
    if (caErr) throw caErr

    const { count: endingCount, error: endErr } = await admin
      .from('contests')
      .select('id', { count: 'exact', head: true })
      .gt('expiry_date', nowIso)
      .lte('expiry_date', eodIso)
    if (endErr) throw endErr

    const n = newCaCount ?? 0
    const m = endingCount ?? 0

    // Recipients: profiles with weeklyDigestEmail=true and a usable email
    const { data: profiles, error: pErr } = await admin
      .from('profiles')
      .select('id, email, settings')
      .not('email', 'is', null)
    if (pErr) throw pErr

    const recipients = ((profiles ?? []) as ProfileRow[]).filter((p) => {
      const prefs = parseDigestPrefs(p.settings)
      return prefs.weeklyDigestEmail && Boolean(p.email)
    })

    if (!resendKey && !dryRun) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'RESEND_API_KEY not set — set Edge secret or use dryRun',
          stats: { newCa: n, endingTonight: m, recipients: recipients.length },
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let sent = 0
    let skipped = 0
    let failed = 0
    const errors: string[] = []

    for (const p of recipients) {
      const email = p.email!
      // Dedupe per user/week
      const { data: existing } = await admin
        .from('email_digest_log')
        .select('id')
        .eq('user_id', p.id)
        .eq('digest_week', digestWeek)
        .maybeSingle()
      if (existing) {
        skipped++
        continue
      }

      const subject = `LoonieWins weekly: ${n} new CA contests + ${m} ending tonight`
      const text = [
        `Hey — here's your LoonieWins weekly digest.`,
        ``,
        `${n} new Canada contests landed this week.`,
        `${m} contests are ending tonight (America/Toronto).`,
        ``,
        `Open the app: ${appUrl}`,
        ``,
        `Manage prefs in Profile → Notifications (Weekly digest email).`,
      ].join('\n')
      const html = `
        <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#111">
          <h1 style="font-size:20px;margin-bottom:8px">LoonieWins weekly digest</h1>
          <p style="font-size:16px;line-height:1.5">
            <strong>${n}</strong> new CA contests this week<br/>
            <strong>${m}</strong> ending tonight (Toronto time)
          </p>
          <p><a href="${appUrl}" style="color:#0a7">Open LoonieWins</a></p>
          <p style="color:#666;font-size:12px">Turn this off anytime: Profile → Notifications → Weekly digest email.</p>
        </div>
      `

      if (dryRun) {
        sent++
        continue
      }

      const result = await sendResendEmail({
        apiKey: resendKey,
        from: fromEmail,
        to: email,
        subject,
        html,
        text,
      })
      if (!result.ok) {
        failed++
        errors.push(`${email}: ${result.error}`)
        continue
      }

      const { error: logErr } = await admin.from('email_digest_log').upsert(
        {
          user_id: p.id,
          digest_week: digestWeek,
          new_ca_count: n,
          ending_tonight_count: m,
        },
        { onConflict: 'user_id,digest_week', ignoreDuplicates: true }
      )
      if (logErr) console.error('[send-weekly-digest] log', logErr.message)
      sent++
    }

    return new Response(
      JSON.stringify({
        ok: true,
        dryRun,
        digestWeek,
        stats: { newCa: n, endingTonight: m },
        recipients: recipients.length,
        sent,
        skipped,
        failed,
        errors: errors.slice(0, 10),
        resendConfigured: Boolean(resendKey),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[send-weekly-digest]', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
