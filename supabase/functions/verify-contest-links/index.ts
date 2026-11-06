/**
 * Server-side contest URL recheck → updates link_status + last_verified.
 *
 * Deploy:
 *   npx supabase functions deploy verify-contest-links --project-ref <ref>
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto on hosted)
 * Optional: CRON_SECRET (alternate bearer for schedules)
 *
 * Cron: supabase/cron_verify_links.sql or GitHub Action
 * Body (POST JSON):
 *   { "limit": 40, "olderThanHours": 24, "dryRun": false }
 *
 * Auth: Authorization: Bearer <service_role or CRON_SECRET>
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import {
  corsHeaders,
  fetchWithTimeout,
  json,
  requireServiceBearer,
} from '../_shared/http.ts'

const DEAD = new Set([403, 404, 410, 500, 502, 503, 520, 521, 522, 523, 524])

interface ContestProbeRow {
  id: string
  url: string
  link_status: number | null
  last_verified: string | null
}

async function probeUrl(url: string): Promise<number | null> {
  const headers = {
    'User-Agent': 'LoonieWinsLinkHealth/1.0 (+https://github.com/quintonatkinson/LoonieWins)',
    Accept: 'text/html,application/xhtml+xml,*/*',
  }
  try {
    // Prefer HEAD; some hosts reject HEAD — fall back to GET
    let res = await fetchWithTimeout(url, {
      method: 'HEAD',
      headers,
      redirect: 'follow',
      timeoutMs: 10_000,
    })
    if (res.status === 405 || res.status === 501) {
      res = await fetchWithTimeout(url, {
        method: 'GET',
        headers,
        redirect: 'follow',
        timeoutMs: 10_000,
      })
    }
    return res.status
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/abort/i.test(msg)) return null
    // Network / DNS / TLS — leave status unknown but still stamp last_verified
    console.warn('[verify-contest-links] probe fail', url.slice(0, 80), msg)
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST' && req.method !== 'GET') {
    return json(405, { ok: false, reason: 'method_not_allowed' })
  }

  const denied = requireServiceBearer(req)
  if (denied) return denied

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return json(500, {
      ok: false,
      reason: 'server_misconfigured',
      hint: 'SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required',
    })
  }

  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
  const limit = Math.min(Math.max(Number(body.limit ?? 40), 1), 200)
  const olderThanHours = Math.min(Math.max(Number(body.olderThanHours ?? 24), 1), 168)
  const dryRun = body.dryRun === true
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString()

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const nowIso = new Date().toISOString()
  // Prefer never-verified, then oldest last_verified among live contests.
  // Filter: (last_verified is null OR older than cutoff) AND (not expired).
  const { data: rows, error: selErr } = await admin
    .from('contests')
    .select('id, url, link_status, last_verified')
    .or(`last_verified.is.null,last_verified.lt."${cutoff}"`)
    .or(`expiry_date.is.null,expiry_date.gt."${nowIso}"`)
    .order('last_verified', { ascending: true, nullsFirst: true })
    .limit(limit)

  if (selErr) {
    console.error('[verify-contest-links] select', selErr.message)
    return json(500, { ok: false, reason: 'select_error', detail: selErr.message })
  }

  const contests = (rows ?? []) as ContestProbeRow[]
  const results: Array<{
    id: string
    status: number | null
    was: number | null
    dead: boolean
  }> = []
  let updated = 0
  let dead = 0
  let unknown = 0

  const started = Date.now()

  for (const c of contests) {
    if (!c.url?.trim()) continue
    const status = dryRun ? c.link_status : await probeUrl(c.url.trim())
    const isDead = status != null && DEAD.has(status)
    if (status == null) unknown++
    if (isDead) dead++

    results.push({
      id: c.id,
      status,
      was: c.link_status,
      dead: isDead,
    })

    if (dryRun) continue

    const patch: Record<string, unknown> = {
      last_verified: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    if (status != null) patch.link_status = status

    const { error: upErr } = await admin.from('contests').update(patch).eq('id', c.id)
    if (upErr) {
      console.error('[verify-contest-links] update', c.id, upErr.message)
    } else {
      updated++
    }
  }

  return json(200, {
    ok: true,
    dryRun,
    scanned: contests.length,
    updated,
    dead,
    unknown,
    olderThanHours,
    limit,
    ms: Date.now() - started,
    sample: results.slice(0, 15),
    at: new Date().toISOString(),
  })
})
