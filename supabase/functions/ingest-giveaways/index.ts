/**
 * Server-side RSS ingest for LoonieWins Hive Mind (`contests`).
 *
 * Project: oftunznsumfidavvbqz
 * Deploy:  supabase functions deploy ingest-giveaways --project-ref oftunznsumfidavvbqz
 * Secrets: SUPABASE_SERVICE_ROLE_KEY (auto), optional RSS2JSON_API_KEY
 * Cron:    supabase/cron_ingest.sql or GitHub Action every 30 min
 *
 * Keep ACTIVE_SOURCES in sync with enabled entries in src/lib/data/sources.ts
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type SourceCountry = 'CA' | 'US' | 'BOTH'
type FetchStrategy = 'direct_first' | 'rss2json_first'

interface Source {
  id: string
  name: string
  url: string
  country: SourceCountry
  includeKeywords?: string[]
  fetchStrategy?: FetchStrategy
  defaultRequirements?: string[]
  defaultTags?: string[]
}

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

/** Keep in sync with getActiveSources() in src/lib/data/sources.ts */
const ACTIVE_SOURCES: Source[] = [
  { id: 'redflagdeals', name: 'RedFlagDeals (Contests)', url: 'https://forums.redflagdeals.com/feed/forum/34', country: 'CA' },
  { id: 'contestcanada-net', name: 'Contest Canada (.net)', url: 'https://www.contestcanada.net/feed/', country: 'CA' },
  { id: 'cfs-contests', name: 'Canadian Free Stuff (Contests)', url: 'https://www.canadianfreestuff.com/canadian-contests/feed/', country: 'CA' },
  { id: 'cfs-daily', name: 'Canadian Free Stuff (Daily)', url: 'https://www.canadianfreestuff.com/canadian-contests/enter-daily/feed/', country: 'CA' },
  { id: 'cfs-canadian-contests', name: 'Canadian Free Stuff (Category)', url: 'https://www.canadianfreestuff.com/category/canadian-contests/feed/', country: 'CA' },
  { id: 'contestscoop', name: 'ContestScoop', url: 'https://contestscoop.com/feed/', country: 'CA' },
  { id: 'contest-canada', name: 'Contest Canada (.ca)', url: 'https://contestcanada.ca/feed/', country: 'CA' },
  { id: 'reddit-contestsofcanada', name: 'Reddit r/contestsofcanada', url: 'https://www.reddit.com/r/contestsofcanada/.rss', country: 'CA', includeKeywords: CONTEST_KEYWORDS },
  { id: 'reddit-canadian-contests', name: 'Reddit r/CanadianContests', url: 'https://www.reddit.com/r/CanadianContests/.rss', country: 'CA', includeKeywords: CONTEST_KEYWORDS },
  { id: 'reddit-contests-canada', name: 'Reddit r/contestsCanada', url: 'https://www.reddit.com/r/contestsCanada/.rss', country: 'CA', includeKeywords: CONTEST_KEYWORDS },
  { id: 'reddit-freebiescanada', name: 'Reddit r/FreebiesCanada', url: 'https://www.reddit.com/r/FreebiesCanada/.rss', country: 'CA', includeKeywords: CONTEST_KEYWORDS },
  { id: 'sweeties-sweeps', name: 'Sweeties Sweeps', url: 'https://sweetiessweeps.com/feed/', country: 'US' },
  { id: 'sweepstakes-bible', name: 'Sweepstakes Bible', url: 'https://www.sweepstakesbible.com/feed/', country: 'US' },
  { id: 'sweepstakes-bible-daily', name: 'Sweepstakes Bible (Daily Entry)', url: 'https://www.sweepstakesbible.com/category/daily-entry/feed/', country: 'US' },
  { id: 'sweepstakes-bible-iw', name: 'Sweepstakes Bible (Instant Win)', url: 'https://www.sweepstakesbible.com/category/instant-win/feed/', country: 'US' },
  { id: 'sweepstakes-bible-ending', name: 'Sweepstakes Bible (Ending Soon)', url: 'https://www.sweepstakesbible.com/category/ending-soon/feed/', country: 'US' },
  { id: 'sweepstakes-bible-no-purchase', name: 'Sweepstakes Bible (No Purchase)', url: 'https://www.sweepstakesbible.com/category/no-purchase-necessary/feed/', country: 'US', defaultTags: ['⚡ Easy Entry'] },
  {
    id: 'sweepstakes-bible-purchase',
    name: 'Sweepstakes Bible (Purchase Required)',
    url: 'https://www.sweepstakesbible.com/category/purchase-required/feed/',
    country: 'US',
    defaultRequirements: ['Purchase Required'],
    defaultTags: ['🧾 Purchase', 'Buy to Enter'],
  },
  { id: 'freebieshark', name: 'FreebieShark (Sweeps)', url: 'https://www.freebieshark.com/category/sweepstakes/feed', country: 'US' },
  { id: 'hip2save-sweeps', name: 'Hip2Save (Sweepstakes)', url: 'https://www.hip2save.com/category/sweepstakes/feed/', country: 'US', includeKeywords: CONTEST_KEYWORDS },
  { id: 'online-sweepstakes', name: 'Online Sweepstakes', url: 'https://www.online-sweepstakes.com/feed/', country: 'US' },
  { id: 'online-sweepstakes-daily', name: 'Online Sweepstakes (Daily Entry)', url: 'https://www.online-sweepstakes.com/daily-entry-sweepstakes/feed/', country: 'US' },
  { id: 'online-sweepstakes-weekly', name: 'Online Sweepstakes (Weekly Entry)', url: 'https://www.online-sweepstakes.com/weekly-entry-sweepstakes/feed/', country: 'US' },
  { id: 'online-sweepstakes-monthly', name: 'Online Sweepstakes (Monthly Entry)', url: 'https://www.online-sweepstakes.com/monthly-entry-sweepstakes/feed/', country: 'US' },
  { id: 'southern-savers-sweeps', name: 'Southern Savers (Sweepstakes)', url: 'https://www.southernsavers.com/category/sweepstakes/feed/', country: 'US', includeKeywords: CONTEST_KEYWORDS },
  { id: 'contestbee', name: 'Contest Bee', url: 'https://www.contestbee.com/feed/', country: 'US' },
  { id: 'sweepstakes-lovers', name: 'Sweepstakes Lovers', url: 'https://www.sweepstakeslovers.com/feed/', country: 'US' },
  { id: 'sweepstakes-lovers-daily', name: 'Sweepstakes Lovers (Daily Entry)', url: 'https://www.sweepstakeslovers.com/category/daily-entry/feed/', country: 'US' },
  { id: 'sweepstakes-lovers-weekly', name: 'Sweepstakes Lovers (Weekly Entry)', url: 'https://www.sweepstakeslovers.com/category/weekly-entry/feed/', country: 'US' },
  { id: 'sweepstakes-mag', name: 'Sweepstakes Mag', url: 'https://www.sweepstakesmag.com/feed/', country: 'US', includeKeywords: CONTEST_KEYWORDS },
  { id: 'reddit-sweepstakes', name: 'Reddit r/sweepstakes', url: 'https://www.reddit.com/r/sweepstakes/.rss', country: 'US', includeKeywords: CONTEST_KEYWORDS },
  { id: 'reddit-giveaways', name: 'Reddit r/giveaways', url: 'https://www.reddit.com/r/giveaways/.rss', country: 'US', includeKeywords: CONTEST_KEYWORDS },
  { id: 'reddit-freebies', name: 'Reddit r/Freebies', url: 'https://www.reddit.com/r/Freebies/.rss', country: 'US', includeKeywords: CONTEST_KEYWORDS },
  {
    id: 'freestufffinder-giveaways',
    name: 'FreeStuffFinder (Giveaways)',
    url: 'https://www.freestufffinder.com/category/giveaways/feed/',
    country: 'US',
    fetchStrategy: 'rss2json_first',
    includeKeywords: CONTEST_KEYWORDS,
  },
]

interface FeedItem {
  title: string
  link: string
  description?: string
}

const NO_PURCHASE =
  /\b(no purchase necessary|without purchase|purchase not (required|necessary))\b/i
const BUY_TO_ENTER =
  /\b(buy to enter|buy-to-enter|purchase required|purchase-required|with purchase|proof of purchase|upc code|receipt required|purchase to enter)\b/i

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function isPurchaseRequired(text: string): boolean {
  if (NO_PURCHASE.test(text)) return false
  return BUY_TO_ENTER.test(text) || /\b(upc|receipt)\b/i.test(text)
}

function parseRssItems(xml: string): FeedItem[] {
  const items: FeedItem[] = []
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) ?? []
  for (const block of blocks) {
    const title = stripTags(
      (block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/<!\[CDATA\[|\]\]>/g, '')
    )
    let link =
      block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] ??
      stripTags((block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? '').replace(/<!\[CDATA\[|\]\]>/g, ''))
    if (!link) link = block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1]?.trim() ?? ''
    const description = stripTags(
      (
        block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ??
        block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1] ??
        block.match(/<content[^>]*>([\s\S]*?)<\/content>/i)?.[1] ??
        ''
      ).replace(/<!\[CDATA\[|\]\]>/g, '')
    )
    if (title && link && !/\/(feed|rss)(\/|$)/i.test(link)) {
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

async function fetchDirect(source: Source): Promise<FeedItem[]> {
  const headers = {
    'User-Agent': 'LoonieWinsIngest/1.0 (+https://github.com/quintonatkinson/LoonieWins)',
    Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
  }
  const res = await fetch(source.url, { headers })
  if (!res.ok) return []
  return parseRssItems(await res.text())
}

async function fetchRss2Json(source: Source): Promise<FeedItem[]> {
  const apiKey = Deno.env.get('RSS2JSON_API_KEY')
  const encoded = encodeURIComponent(source.url)
  const params = apiKey
    ? `rss_url=${encoded}&api_key=${apiKey}&count=100`
    : `rss_url=${encoded}`
  const res = await fetch(`https://api.rss2json.com/v1/api.json?${params}`)
  const json = await res.json()
  if (json.status !== 'ok' || !Array.isArray(json.items)) return []
  return json.items
    .filter((i: { title?: string; link?: string }) => i.title && i.link)
    .map((i: { title: string; link: string; description?: string; content?: string }) => ({
      title: i.title,
      link: i.link,
      description: i.description ?? i.content,
    }))
}

async function fetchFeedItems(source: Source): Promise<FeedItem[]> {
  const strategy = source.fetchStrategy ?? 'direct_first'
  try {
    if (strategy === 'rss2json_first') {
      const viaApi = await fetchRss2Json(source)
      if (viaApi.length > 0) return viaApi
      return await fetchDirect(source)
    }
    const direct = await fetchDirect(source)
    if (direct.length > 0) return direct
    return await fetchRss2Json(source)
  } catch (_) {
    try {
      return strategy === 'rss2json_first' ? await fetchDirect(source) : await fetchRss2Json(source)
    } catch {
      return []
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Missing Supabase env' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const perSource: Record<string, { country: string; count: number; error?: string }> = {}
  const rows: Record<string, unknown>[] = []

  for (const source of ACTIVE_SOURCES) {
    try {
      const items = await fetchFeedItems(source)
      let kept = 0
      items.forEach((item, index) => {
        const body = item.description ?? ''
        if (!matchesKeywords(source, item.title, body)) return
        kept += 1
        const text = `${item.title} ${body}`
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
      perSource[source.id] = { country: source.country, count: kept }
    } catch (err) {
      perSource[source.id] = {
        country: source.country,
        count: 0,
        error: err instanceof Error ? err.message : String(err),
      }
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
  if (unique.length > 0) {
    const { error } = await supabase.from('contests').upsert(unique, { onConflict: 'id' })
    if (error) upsertError = error.message
    else upserted = unique.length
  }

  const ca = ACTIVE_SOURCES.filter((s) => s.country === 'CA').length
  const us = ACTIVE_SOURCES.filter((s) => s.country === 'US').length

  return new Response(
    JSON.stringify({
      ok: !upsertError,
      fetched: rows.length,
      upserted,
      upsertError,
      sources: { ca, us, total: ACTIVE_SOURCES.length },
      perSource,
      rss2jsonKey: Boolean(Deno.env.get('RSS2JSON_API_KEY')),
      at: new Date().toISOString(),
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
