/**
 * Server-side RSS ingest for LoonieWins Hive Mind (`contests`).
 *
 * Deploy:  npx supabase functions deploy ingest-giveaways --project-ref <ref>
 * Secrets: SUPABASE_SERVICE_ROLE_KEY (auto), optional RSS2JSON_API_KEY, CRON_SECRET
 * Cron:    supabase/cron_ingest.sql or GitHub Action every 30 min
 *
 * Auth: Authorization: Bearer <service_role or CRON_SECRET>
 *
 * Keep ACTIVE_SOURCES in sync with enabled entries in src/lib/data/sources.ts
 * Disabled inventory IDs are listed in DISABLED_SOURCE_IDS (skipped, logged).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import {
  corsHeaders,
  fetchWithTimeout,
  json,
  requireServiceBearer,
} from '../_shared/http.ts'

type SourceCountry = 'CA' | 'US' | 'BOTH'
type FetchStrategy = 'direct_first' | 'rss2json_first'

interface Source {
  id: string
  name: string
  url: string
  country: SourceCountry
  enabled?: boolean
  includeKeywords?: string[]
  fetchStrategy?: FetchStrategy
  defaultRequirements?: string[]
  defaultTags?: string[]
}

const SOURCE_TIMEOUT_MS = 12_000

const CONTEST_KEYWORDS = [
  'contest',
  'sweepstake',
  'giveaway',
  'enter to win',
  'chance to win',
  'win a',
  'win the',
  'win $',
  'instant win',
  'prize',
]

/**
 * Known disabled / partnership-blocked source ids (from src/lib/data/sources.ts).
 * Not fetched — surfaced in response.skipped for ops visibility.
 */
const DISABLED_SOURCE_IDS: string[] = [
  'smartcanucks',
  'contestgirl-ca',
  'contestgirl-us',
  'sweeps-fanatics',
  'cbc-contests',
  'win-prizes-online',
  'true-sweepstakes',
  'save-a-loonie',
  // Overnight sources quality 2026-10-19 — persistently dead / empty / proxy-blocked
  'contestscoop',
  'contest-canada',
  'sweepstakes-lovers',
  'reddit-contestsofcanada',
  'reddit-canadian-contests',
  'reddit-contests-canada',
  'reddit-freebiescanada',
  'reddit-sweepstakes',
  'reddit-giveaways',
  'reddit-freebies',
  'gleam-directory',
  'viralsweep-directory',
  'woobox-directory',
  'retailer-bestbuy-ca',
  'retailer-walmart-ca',
  'retailer-costco-ca',
  'retailer-canadiantire',
  'retailer-metro-ca',
  'retailer-sobeys',
  'retailer-bestbuy-us',
  'retailer-target-us',
  'brand-oem-ford',
  'brand-oem-gm',
  'brand-oem-toyota',
  'brand-oem-honda',
  'brand-oem-hyundai',
  'brand-nike',
  'brand-apple-beats',
  'telecom-ca',
  'telecom-us',
  'bank-ca-loyalty',
  'dealdeal-contests',
  'contestlog-ca',
  'bargainmoose-contests',
  'contest-queen',
  'brand-official-api',
]

/** Keep in sync with getActiveSources() in src/lib/data/sources.ts */
const ACTIVE_SOURCES: Source[] = [
  { id: 'redflagdeals', name: 'RedFlagDeals (Contests)', url: 'https://forums.redflagdeals.com/feed/forum/34', country: 'CA', enabled: true },
  { id: 'contestcanada-net', name: 'Contest Canada (.net)', url: 'https://www.contestcanada.net/feed/', country: 'CA', enabled: true },
  { id: 'cfs-contests', name: 'Canadian Free Stuff (Contests)', url: 'https://www.canadianfreestuff.com/canadian-contests/feed/', country: 'CA', enabled: true },
  { id: 'cfs-daily', name: 'Canadian Free Stuff (Daily)', url: 'https://www.canadianfreestuff.com/canadian-contests/enter-daily/feed/', country: 'CA', enabled: true },
  { id: 'cfs-canadian-contests', name: 'Canadian Free Stuff (Category)', url: 'https://www.canadianfreestuff.com/category/canadian-contests/feed/', country: 'CA', enabled: true },
  { id: 'sweeties-sweeps', name: 'Sweeties Sweeps', url: 'https://sweetiessweeps.com/feed/', country: 'US', enabled: true },
  { id: 'sweepstakes-bible', name: 'Sweepstakes Bible', url: 'https://www.sweepstakesbible.com/feed/', country: 'US', enabled: true },
  { id: 'sweepstakes-bible-daily', name: 'Sweepstakes Bible (Daily Entry)', url: 'https://www.sweepstakesbible.com/category/daily-entry/feed/', country: 'US', enabled: true },
  { id: 'sweepstakes-bible-iw', name: 'Sweepstakes Bible (Instant Win)', url: 'https://www.sweepstakesbible.com/category/instant-win/feed/', country: 'US', enabled: true },
  { id: 'sweepstakes-bible-ending', name: 'Sweepstakes Bible (Ending Soon)', url: 'https://www.sweepstakesbible.com/category/ending-soon/feed/', country: 'US', enabled: true },
  { id: 'sweepstakes-bible-no-purchase', name: 'Sweepstakes Bible (No Purchase)', url: 'https://www.sweepstakesbible.com/category/no-purchase-necessary/feed/', country: 'US', enabled: true, defaultTags: ['⚡ Easy Entry'] },
  {
    id: 'sweepstakes-bible-purchase',
    name: 'Sweepstakes Bible (Purchase Required)',
    url: 'https://www.sweepstakesbible.com/category/purchase-required/feed/',
    country: 'US',
    enabled: true,
    defaultRequirements: ['Purchase Required'],
    defaultTags: ['🧾 Purchase', 'Buy to Enter'],
  },
  { id: 'freebieshark', name: 'FreebieShark (Sweeps)', url: 'https://www.freebieshark.com/category/sweepstakes/feed', country: 'US', enabled: true },
  { id: 'hip2save-sweeps', name: 'Hip2Save (Sweepstakes)', url: 'https://www.hip2save.com/category/sweepstakes/feed/', country: 'US', enabled: true, includeKeywords: CONTEST_KEYWORDS },
  { id: 'online-sweepstakes', name: 'Online Sweepstakes', url: 'https://www.online-sweepstakes.com/feed/', country: 'US', enabled: true },
  { id: 'online-sweepstakes-daily', name: 'Online Sweepstakes (Daily Entry)', url: 'https://www.online-sweepstakes.com/daily-entry-sweepstakes/feed/', country: 'US', enabled: true },
  { id: 'online-sweepstakes-weekly', name: 'Online Sweepstakes (Weekly Entry)', url: 'https://www.online-sweepstakes.com/weekly-entry-sweepstakes/feed/', country: 'US', enabled: true },
  { id: 'online-sweepstakes-monthly', name: 'Online Sweepstakes (Monthly Entry)', url: 'https://www.online-sweepstakes.com/monthly-entry-sweepstakes/feed/', country: 'US', enabled: true },
  { id: 'southern-savers-sweeps', name: 'Southern Savers (Sweepstakes)', url: 'https://www.southernsavers.com/category/sweepstakes/feed/', country: 'US', enabled: true, includeKeywords: CONTEST_KEYWORDS },
  { id: 'contestbee', name: 'Contest Bee', url: 'https://www.contestbee.com/feed/', country: 'US', enabled: true },
  { id: 'sweepstakes-lovers-daily', name: 'Sweepstakes Lovers (Daily Entry)', url: 'https://www.sweepstakeslovers.com/category/daily-entry/feed/', country: 'US', enabled: true },
  { id: 'sweepstakes-lovers-weekly', name: 'Sweepstakes Lovers (Weekly Entry)', url: 'https://www.sweepstakeslovers.com/category/weekly-entry/feed/', country: 'US', enabled: true },
  { id: 'sweepstakes-mag', name: 'Sweepstakes Mag', url: 'https://www.sweepstakesmag.com/feed/', country: 'US', enabled: true, includeKeywords: CONTEST_KEYWORDS },
  {
    id: 'freestufffinder-giveaways',
    name: 'FreeStuffFinder (Giveaways)',
    url: 'https://www.freestufffinder.com/category/giveaways/feed/',
    country: 'US',
    enabled: true,
    fetchStrategy: 'rss2json_first',
    includeKeywords: CONTEST_KEYWORDS,
  },
]

interface FeedItem {
  title: string
  link: string
  description?: string
}

type SourceResult = {
  country: string
  count: number
  fetched: number
  ms: number
  skipped?: boolean
  reason?: string
  error?: string
  httpStatus?: number
}

const NO_PURCHASE =
  /\b(no purchase necessary|without purchase|purchase not (required|necessary)|no buy(ing)? (required|necessary)|amo[eé]|alternate[- ]means of entry)\b/i
const BUY_TO_ENTER =
  /\b(buy to enter|buy-to-enter|purchase required|purchase-required|with purchase|proof of purchase|product purchase|upc code|receipt required|purchase to enter|must (buy|purchase))\b/i

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function isPurchaseRequired(text: string): boolean {
  if (NO_PURCHASE.test(text)) return false
  return BUY_TO_ENTER.test(text) || /\b(upc(\s*code)?|proof of purchase|original receipt)\b/i.test(text)
}

/** Soft-repair BOM / leading junk / bare ampersands before regex item split. */
function sanitizeFeedXml(raw: string): string {
  let xml = raw.replace(/^\uFEFF/, '').trim()
  const start = xml.search(/<\?xml|<rss[\s>]|<feed[\s>]|<rdf:RDF/i)
  if (start > 0) xml = xml.slice(start)
  if (/<!doctype html|<html[\s>]/i.test(xml.slice(0, 400))) return ''
  return xml.replace(/&(?!(?:[a-zA-Z][a-zA-Z0-9]*|#\d+|#x[\da-fA-F]+);)/g, '&amp;')
}

function parseRssItems(xml: string): FeedItem[] {
  const cleaned = sanitizeFeedXml(xml)
  if (!cleaned) return []
  const items: FeedItem[] = []
  const blocks = cleaned.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) ?? []
  for (const block of blocks) {
    const title = stripTags(
      (block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/<!\[CDATA\[|\]\]>/g, '')
    )
    let link =
      block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] ??
      stripTags((block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? '').replace(/<!\[CDATA\[|\]\]>/g, ''))
    if (!link) {
      const guid = block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1]?.trim() ?? ''
      if (/^https?:\/\//i.test(guid)) link = guid
    }
    if (!link) {
      const id = block.match(/<id[^>]*>([\s\S]*?)<\/id>/i)?.[1]?.trim() ?? ''
      if (/^https?:\/\//i.test(id)) link = id
    }
    const description = stripTags(
      (
        block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ??
        block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1] ??
        block.match(/<content[^>]*>([\s\S]*?)<\/content>/i)?.[1] ??
        ''
      ).replace(/<!\[CDATA\[|\]\]>/g, '')
    )
    if (title && link && !/\/(feed|rss)(\/|$)|atom\.xml$/i.test(link)) {
      items.push({ title, link: link.trim(), description })
    }
  }
  return items
}

function matchesKeywords(source: Source, title: string, body: string): boolean {
  if (!source.includeKeywords?.length) return true
  const text = `${title} ${body}`.toLowerCase()
  return source.includeKeywords.some((kw) => text.includes(kw.toLowerCase()))
}

function mergeUnique(base: string[], extras?: string[]): string[] {
  if (!extras?.length) return base
  const out = [...base]
  for (const x of extras) if (!out.includes(x)) out.push(x)
  return out
}

function isTimeoutError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /abort|timeout|timed out/i.test(msg)
}

async function fetchDirect(
  source: Source
): Promise<{ items: FeedItem[]; httpStatus?: number; error?: string }> {
  const headers = {
    'User-Agent': 'LoonieWinsIngest/1.1 (+https://github.com/quintonatkinson/LoonieWins)',
    Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
  }
  try {
    const res = await fetchWithTimeout(source.url, { headers, timeoutMs: SOURCE_TIMEOUT_MS })
    if (!res.ok) {
      return { items: [], httpStatus: res.status, error: `direct_http_${res.status}` }
    }
    return { items: parseRssItems(await res.text()), httpStatus: res.status }
  } catch (err) {
    return {
      items: [],
      error: isTimeoutError(err) ? 'direct_timeout' : `direct_${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

async function fetchRss2Json(
  source: Source
): Promise<{ items: FeedItem[]; httpStatus?: number; error?: string }> {
  const apiKey = Deno.env.get('RSS2JSON_API_KEY')
  const encoded = encodeURIComponent(source.url)
  const params = apiKey
    ? `rss_url=${encoded}&api_key=${apiKey}&count=100`
    : `rss_url=${encoded}`
  try {
    const res = await fetchWithTimeout(`https://api.rss2json.com/v1/api.json?${params}`, {
      timeoutMs: SOURCE_TIMEOUT_MS,
    })
    const httpStatus = res.status
    if (!res.ok) {
      return { items: [], httpStatus, error: `rss2json_http_${res.status}` }
    }
    const parsed = await res.json()
    if (parsed.status !== 'ok' || !Array.isArray(parsed.items)) {
      return {
        items: [],
        httpStatus,
        error: `rss2json_status_${String(parsed.status ?? 'unknown')}`,
      }
    }
    return {
      items: parsed.items
        .filter((i: { title?: string; link?: string }) => i.title && i.link)
        .map((i: { title: string; link: string; description?: string; content?: string }) => ({
          title: i.title,
          link: i.link,
          description: i.description ?? i.content,
        })),
      httpStatus,
    }
  } catch (err) {
    return {
      items: [],
      error: isTimeoutError(err)
        ? 'rss2json_timeout'
        : `rss2json_${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

async function fetchFeedItems(
  source: Source
): Promise<{ items: FeedItem[]; httpStatus?: number; error?: string }> {
  const strategy = source.fetchStrategy ?? 'direct_first'
  if (strategy === 'rss2json_first') {
    const viaApi = await fetchRss2Json(source)
    if (viaApi.items.length > 0) return viaApi
    const direct = await fetchDirect(source)
    if (direct.items.length > 0) return direct
    return {
      items: [],
      httpStatus: direct.httpStatus ?? viaApi.httpStatus,
      error: direct.error ?? viaApi.error ?? 'empty',
    }
  }
  const direct = await fetchDirect(source)
  if (direct.items.length > 0) return direct
  const viaApi = await fetchRss2Json(source)
  if (viaApi.items.length > 0) return viaApi
  return {
    items: [],
    httpStatus: viaApi.httpStatus ?? direct.httpStatus,
    error: viaApi.error ?? direct.error ?? 'empty',
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
      hint: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
    })
  }

  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
  const dryRun = body.dryRun === true
  const onlyIds: string[] | null = Array.isArray(body.sourceIds)
    ? body.sourceIds.map(String)
    : null

  const runStarted = Date.now()
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const sources = ACTIVE_SOURCES.filter((s) => {
    if (s.enabled === false) return false
    if (onlyIds && !onlyIds.includes(s.id)) return false
    return true
  })

  const perSource: Record<string, SourceResult> = {}
  const rows: Record<string, unknown>[] = []
  let timeouts = 0
  let fetchErrors = 0

  // Explicit skip log for disabled inventory (not fetched)
  for (const id of DISABLED_SOURCE_IDS) {
    if (onlyIds && !onlyIds.includes(id)) continue
    perSource[id] = {
      country: '—',
      count: 0,
      fetched: 0,
      ms: 0,
      skipped: true,
      reason: 'disabled_in_sources_ts',
    }
  }

  for (const source of sources) {
    const t0 = Date.now()
    try {
      const { items, httpStatus, error } = await fetchFeedItems(source)
      let kept = 0
      items.forEach((item, index) => {
        const itemBody = item.description ?? ''
        if (!matchesKeywords(source, item.title, itemBody)) return
        kept += 1
        const text = `${item.title} ${itemBody}`
        let tags = [...(source.defaultTags ?? [])]
        let requirements = [...(source.defaultRequirements ?? [])]
        if (isPurchaseRequired(text)) {
          tags = mergeUnique(tags, ['🧾 Purchase', 'Buy to Enter'])
          requirements = mergeUnique(requirements, ['Purchase Required'])
        }
        if (/\b(daily|\[daily\])\b/i.test(text)) tags = mergeUnique(tags, ['Daily'])
        const id = `${source.id}-${index}-${item.link.slice(-50).replace(/\W/g, '')}`
        rows.push({
          id,
          title: item.title.slice(0, 500),
          url: item.link,
          source: source.name,
          eligibility: source.country === 'BOTH' ? 'NA' : source.country,
          tags,
          requirements,
          is_estimated_expiry: true,
          updated_at: new Date().toISOString(),
        })
      })
      const ms = Date.now() - t0
      if (error?.includes('timeout')) timeouts += 1
      else if (error && kept === 0) fetchErrors += 1
      perSource[source.id] = {
        country: source.country,
        count: kept,
        fetched: items.length,
        ms,
        httpStatus,
        error: kept === 0 ? error : undefined,
      }
      console.log(
        `[ingest-giveaways] ${source.id} kept=${kept} fetched=${items.length} ms=${ms}` +
          (error && kept === 0 ? ` err=${error}` : '')
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (isTimeoutError(err)) timeouts += 1
      else fetchErrors += 1
      perSource[source.id] = {
        country: source.country,
        count: 0,
        fetched: 0,
        ms: Date.now() - t0,
        error: msg,
      }
      console.error(`[ingest-giveaways] ${source.id} failed`, msg)
    }
  }

  const byUrl = new Map<string, (typeof rows)[0]>()
  for (const row of rows) {
    const url = String(row.url)
    if (!byUrl.has(url)) byUrl.set(url, row)
  }
  const unique = [...byUrl.values()]

  let upserted = 0
  let upsertError: string | undefined
  if (!dryRun && unique.length > 0) {
    const { error } = await supabase.from('contests').upsert(unique, { onConflict: 'id' })
    if (error) {
      upsertError = error.message
      console.error('[ingest-giveaways] upsert', error.message)
    } else {
      upserted = unique.length
    }
  }

  const enabled = sources
  const ca = enabled.filter((s) => s.country === 'CA').length
  const us = enabled.filter((s) => s.country === 'US').length
  const skippedDisabled = DISABLED_SOURCE_IDS.length

  return json(upsertError ? 500 : 200, {
    ok: !upsertError,
    dryRun,
    fetched: rows.length,
    upserted: dryRun ? 0 : upserted,
    upsertError,
    sources: {
      ca,
      us,
      total: enabled.length,
      skippedDisabled,
    },
    health: { timeouts, fetchErrors, ms: Date.now() - runStarted },
    perSource,
    rss2jsonKey: Boolean(Deno.env.get('RSS2JSON_API_KEY')),
    at: new Date().toISOString(),
  })
})
