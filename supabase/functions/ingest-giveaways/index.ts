/**
 * Server-side ingest for the LoonieWins Hive Mind (`public.contests`).
 *
 * The apps read this table on open, so this function does all the slow work once for
 * everyone: fetch every active source (several pages deep for WordPress feeds), normalize
 * with the SAME tagger / expiry / eligibility code the apps use (synced into _shared/feed),
 * upsert with stable URL-based ids, and retire stale rows.
 *
 * Deploy:  supabase functions deploy ingest-giveaways   (or the deploy-supabase workflow)
 * Secrets: SUPABASE_SERVICE_ROLE_KEY (auto); optional RSS2JSON_API_KEY, CRON_SECRET
 * Cron:    every 30 min — GitHub Action (.github/workflows/ingest-giveaways.yml) or pg_cron
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { isAuthorizedCronRequest, unauthorizedResponse } from '../_shared/cronAuth.ts'
import {
  SOURCE_CONCURRENCY,
  getActiveSources,
  ingestSource,
  mapPool,
  type ContestRow,
} from './ingest.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (!isAuthorizedCronRequest(req)) return unauthorizedResponse(corsHeaders)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing Supabase env' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const supabase = createClient(supabaseUrl, serviceKey)
  const now = Date.now()
  const sources = getActiveSources()

  const results = await mapPool(sources, SOURCE_CONCURRENCY, async (source) => {
    try {
      return { source, ...(await ingestSource(source, now)) }
    } catch (err) {
      return {
        source,
        rows: [] as ContestRow[],
        report: { country: source.country, pages: 0, items: 0, kept: 0, error: String(err) },
      }
    }
  })

  const byId = new Map<string, ContestRow>()
  for (const r of results) for (const row of r.rows) if (!byId.has(row.id)) byId.set(row.id, row)
  const unique = [...byId.values()]

  const errors: string[] = []
  for (let i = 0; i < unique.length; i += 500) {
    const { error } = await supabase.from('contests').upsert(unique.slice(i, i + 500), { onConflict: 'id' })
    if (error) errors.push(error.message)
  }

  // Retire stale rows (SQL function from the 20260926 migration); keep going if absent.
  const { data: retired, error: retireError } = await supabase.rpc('retire_stale_contests')
  if (retireError) errors.push(`retire: ${retireError.message}`)

  const { count: live } = await supabase
    .from('contests')
    .select('id', { count: 'exact', head: true })
    .or(`expiry_date.is.null,expiry_date.gt.${new Date(now).toISOString()}`)

  const perSource = Object.fromEntries(results.map((r) => [r.source.id, r.report]))
  return new Response(
    JSON.stringify({
      ok: errors.length === 0,
      upserted: unique.length,
      live,
      retired: retired ?? null,
      errors,
      sources: { total: sources.length, withItems: results.filter((r) => r.report.items > 0).length },
      perSource,
      rss2jsonKey: Boolean(Deno.env.get('RSS2JSON_API_KEY')),
      tookMs: Date.now() - now,
      at: new Date(now).toISOString(),
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
