/**
 * Server-side contest URL recheck → updates link_status + last_verified, and fills
 * expiry_date from the page (or a dated title) when the contest has none yet.
 *
 * Deploy:
 *   npx supabase functions deploy verify-contest-links --project-ref <ref>
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto on hosted)
 * Optional: CRON_SECRET (alternate bearer for schedules)
 *
 * Cron: supabase/cron_verify_links.sql or GitHub Action
 * Body (POST JSON):
 *   { "limit": 120, "olderThanHours": 12, "dryRun": false }
 *
 * Auth: Authorization: Bearer <service_role or CRON_SECRET>
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import {
  corsHeaders,
  fetchPublicUrl,
  json,
  requireServiceBearer,
} from '../_shared/http.ts'
import { extractEndDate, extractTitleEndDate, htmlToText } from '../_shared/endDate.ts'

const DEAD = new Set([403, 404, 410, 500, 502, 503, 520, 521, 522, 523, 524])
const CONCURRENCY = 8
const PROBE_TIMEOUT_MS = 10_000
const MAX_HTML_BYTES = 800_000

interface ContestProbeRow {
  id: string
  url: string
  title: string | null
  expiry_date: string | null
  link_status: number | null
  last_verified: string | null
}

interface Probe {
  /** null = unknown (network error, timeout, or a bot challenge rather than a real answer) */
  status: number | null
  challenged: boolean
  html: string | null
}

async function readCapped(res: Response, deadline: number): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (size < MAX_HTML_BYTES && Date.now() < deadline) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      size += value.length
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  const buf = new Uint8Array(size)
  let off = 0
  for (const c of chunks) {
    buf.set(c, off)
    off += c.length
  }
  return new TextDecoder().decode(buf)
}

/** Cloudflare / bot walls answer 403/503 to scripts while the page works for people. */
function isBotChallenge(res: Response): boolean {
  if (res.headers.get('cf-mitigated') === 'challenge') return true
  const server = res.headers.get('server') ?? ''
  return (res.status === 403 || res.status === 503 || res.status === 429) && /cloudflare|ddos-guard|sucuri/i.test(server)
}

async function probeUrl(url: string, wantHtml: boolean): Promise<Probe> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; LoonieWinsLinkHealth/1.1; +https://github.com/quintonatkinson/LoonieWins)',
    Accept: 'text/html,application/xhtml+xml,*/*',
  }
  try {
    let res = await fetchPublicUrl(url, {
      method: wantHtml ? 'GET' : 'HEAD',
      headers,
      timeoutMs: PROBE_TIMEOUT_MS,
    })
    if (!wantHtml && (res.status === 405 || res.status === 501)) {
      await res.body?.cancel()
      res = await fetchPublicUrl(url, { method: 'GET', headers, timeoutMs: PROBE_TIMEOUT_MS })
    }
    if (isBotChallenge(res)) {
      await res.body?.cancel()
      return { status: null, challenged: true, html: null }
    }
    const html =
      wantHtml && res.ok && /html/i.test(res.headers.get('content-type') ?? 'text/html')
        ? await readCapped(res, Date.now() + PROBE_TIMEOUT_MS)
        : (await res.body?.cancel(), null)
    return { status: res.status, challenged: false, html }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!/abort/i.test(msg)) {
      // Network / DNS / TLS — leave status unknown but still stamp last_verified
      console.warn('[verify-contest-links] probe fail', url.slice(0, 80), msg)
    }
    return { status: null, challenged: false, html: null }
  }
}

async function mapPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    })
  )
  return out
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
  const limit = Math.min(Math.max(Number(body.limit ?? 120), 1), 300)
  const olderThanHours = Math.min(Math.max(Number(body.olderThanHours ?? 12), 1), 168)
  const dryRun = body.dryRun === true
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString()

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const nowIso = new Date().toISOString()
  // Prefer never-verified, then oldest last_verified among live contests.
  const { data: rows, error: selErr } = await admin
    .from('contests')
    .select('id, url, title, expiry_date, link_status, last_verified')
    .or(`last_verified.is.null,last_verified.lt."${cutoff}"`)
    .or(`expiry_date.is.null,expiry_date.gt."${nowIso}"`)
    .order('last_verified', { ascending: true, nullsFirst: true })
    .limit(limit)

  if (selErr) {
    console.error('[verify-contest-links] select', selErr.message)
    return json(500, { ok: false, reason: 'select_error', detail: selErr.message })
  }

  const contests = ((rows ?? []) as ContestProbeRow[]).filter((c) => c.url?.trim())
  const started = Date.now()

  const results = await mapPool(contests, CONCURRENCY, async (c) => {
    const needsDate = !c.expiry_date
    const titleDate = needsDate && c.title ? extractTitleEndDate(c.title) : null
    const probe = dryRun
      ? { status: c.link_status, challenged: false, html: null }
      : await probeUrl(c.url.trim(), needsDate && !titleDate)
    const foundDate = titleDate ?? (probe.html ? extractEndDate(htmlToText(probe.html)) : null)
    const isDead = probe.status != null && DEAD.has(probe.status)

    if (!dryRun) {
      const now = new Date().toISOString()
      const patch: Record<string, unknown> = { last_verified: now, updated_at: now }
      if (probe.status != null) patch.link_status = probe.status
      // A bot wall is not evidence the contest is gone; drop any stale "dead" verdict.
      else if (probe.challenged && c.link_status != null && DEAD.has(c.link_status)) patch.link_status = null
      if (foundDate) {
        patch.expiry_date = foundDate
        patch.is_estimated_expiry = false
      }
      const { error: upErr } = await admin.from('contests').update(patch).eq('id', c.id)
      if (upErr) console.error('[verify-contest-links] update', c.id, upErr.message)
      return { id: c.id, status: probe.status, was: c.link_status, dead: isDead, challenged: probe.challenged, expiry: foundDate, ok: !upErr }
    }
    return { id: c.id, status: probe.status, was: c.link_status, dead: isDead, challenged: probe.challenged, expiry: foundDate, ok: true }
  })

  const dated = results.filter((r) => r.expiry)
  return json(200, {
    ok: true,
    dryRun,
    scanned: contests.length,
    updated: dryRun ? 0 : results.filter((r) => r.ok).length,
    dead: results.filter((r) => r.dead).length,
    challenged: results.filter((r) => r.challenged).length,
    unknown: results.filter((r) => r.status == null).length,
    datesFound: dated.length,
    alreadyEnded: dated.filter((r) => (r.expiry as string) <= nowIso).length,
    olderThanHours,
    limit,
    ms: Date.now() - started,
    sample: results.slice(0, 15),
    at: new Date().toISOString(),
  })
})
