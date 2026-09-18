/**
 * Server-side RSS ingest for LoonieWins.
 * Fetches active CA/US sources, normalizes lightly, upserts into `contests`.
 *
 * Deploy:
 *   supabase functions deploy ingest-giveaways
 * Schedule (Dashboard → Edge Functions → Cron, or config.toml):
 *   every 30 minutes
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: RSS2JSON_API_KEY for larger pages via rss2json fallback
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type SourceCountry = 'CA' | 'US' | 'BOTH'

interface Source {
  id: string
  name: string
  url: string
  country: SourceCountry
  enabled?: boolean
  includeKeywords?: string[]
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

/** Keep in sync with src/lib/data/sources.ts active entries */
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
  { id: 'sweeties-sweeps', name: 'Sweeties Sweeps', url: 'https://sweetiessweeps.com/feed/', country: 'US' },
  { id: 'sweepstakes-bible', name: 'Sweepstakes Bible', url: 'https://www.sweepstakesbible.com/feed/', country: 'US' },
  { id: 'sweepstakes-bible-daily', name: 'Sweepstakes Bible (Daily Entry)', url: 'https://www.sweepstakesbible.com/category/daily-entry/feed/', country: 'US' },
  { id: 'sweepstakes-bible-iw', name: 'Sweepstakes Bible (Instant Win)', url: 'https://www.sweepstakesbible.com/category/instant-win/feed/', country: 'US' },
  { id: 'freebieshark', name: 'FreebieShark (Sweeps)', url: 'https://www.freebieshark.com/category/sweepstakes/feed', country: 'US' },
  { id: 'hip2save-sweeps', name: 'Hip2Save (Sweepstakes)', url: 'https://www.hip2save.com/category/sweepstakes/feed/', country: 'US', includeKeywords: CONTEST_KEYWORDS },
  { id: 'online-sweepstakes', name: 'Online Sweepstakes', url: 'https://www.online-sweepstakes.com/feed/', country: 'US' },
  { id: 'contestbee', name: 'Contest Bee', url: 'https://www.contestbee.com/feed/', country: 'US' },
  { id: 'sweepstakes-lovers', name: 'Sweepstakes Lovers', url: 'https://www.sweepstakeslovers.com/feed/', country: 'US' },
  { id: 'sweepstakes-mag', name: 'Sweepstakes Mag', url: 'https://www.sweepstakesmag.com/feed/', country: 'US', includeKeywords: CONTEST_KEYWORDS },
  { id: 'reddit-sweepstakes', name: 'Reddit r/sweepstakes', url: 'https://www.reddit.com/r/sweepstakes/.rss', country: 'US', includeKeywords: CONTEST_KEYWORDS },
  { id: 'reddit-giveaways', name: 'Reddit r/giveaways', url: 'https://www.reddit.com/r/giveaways/.rss', country: 'US', includeKeywords: CONTEST_KEYWORDS },
  { id: 'reddit-freebies', name: 'Reddit r/Freebies', url: 'https://www.reddit.com/r/Freebies/.rss', country: 'US', includeKeywords: CONTEST_KEYWORDS },
]

interface FeedItem {
  title: string
  link: string
  description?: string
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseRssItems(xml: string): FeedItem[] {
  const items: FeedItem[] = []
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) ?? []
  for (const block of blocks) {
    const title = stripTags((block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/<!\[CDATA\[|\]\]>/g, ''))
    let link =
      block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] ??
      stripTags((block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? '').replace(/<!\[CDATA\[|\]\]>/g, ''))
    if (!link) link = block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1]?.trim() ?? ''
    const description = stripTags(
      (block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ??
        block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1] ??
        '').replace(/<!\[CDATA\[|\]\]>/g, '')
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

async function fetchFeedItems(source: Source): Promise<FeedItem[]> {
  const headers = {
    'User-Agent': 'LoonieWinsIngest/1.0 (+https://github.com/quintonatkinson/LoonieWins)',
    Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
  }

  try {
    const res = await fetch(source.url, { headers })
    if (res.ok) {
      const xml = await res.text()
      const items = parseRssItems(xml)
      if (items.length > 0) return items
    }
  } catch (_) {
    /* fall through */
  }

  const apiKey = Deno.env.get('RSS2JSON_API_KEY')
  const encoded = encodeURIComponent(source.url)
  const params = apiKey
    ? `rss_url=${encoded}&api_key=${apiKey}&count=100`
    : `rss_url=${encoded}`
  try {
    const res = await fetch(`https://api.rss2json.com/v1/api.json?${params}`)
    const json = await res.json()
    if (json.status === 'ok' && Array.isArray(json.items)) {
      return json.items
        .filter((i: { title?: string; link?: string }) => i.title && i.link)
        .map((i: { title: string; link: string; description?: string; content?: string }) => ({
          title: i.title,
          link: i.link,
          description: i.description ?? i.content,
        }))
    }
  } catch (_) {
    /* empty */
  }

  return []
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
        const id = `${source.id}-${index}-${item.link.slice(-50).replace(/\W/g, '')}`
        rows.push({
          id,
          title: item.title.slice(0, 500),
          url: item.link,
          source: source.name,
          eligibility: source.country === 'BOTH' ? 'NA' : source.country,
          tags: [],
          requirements: [],
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

  // Dedupe by URL before upsert
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
      at: new Date().toISOString(),
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
