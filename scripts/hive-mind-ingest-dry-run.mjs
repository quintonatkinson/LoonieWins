#!/usr/bin/env node
/**
 * Offline ingest dry-run: same feeds as ingest-giveaways, URL dedupe, optional RSS2JSON merge.
 * Usage: RSS2JSON_API_KEY=… node scripts/hive-mind-ingest-dry-run.mjs
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const ingestSource = readFileSync(
  join(root, 'supabase/functions/ingest-giveaways/index.ts'),
  'utf8'
)

const ACTIVE_BLOCK = ingestSource.match(/const ACTIVE_SOURCES[\s\S]*?\n\]/)?.[0] ?? ''
const urls = [...ACTIVE_BLOCK.matchAll(/url:\s*'([^']+)'/g)].map((m) => m[1])
const countries = [...ACTIVE_BLOCK.matchAll(/country:\s*'(CA|US)'/g)].map((m) => m[1])
const sources = urls.map((url, i) => ({ url, country: countries[i] ?? 'US' }))

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

function matches(title, body) {
  const text = `${title} ${body}`.toLowerCase()
  return CONTEST_KEYWORDS.some((kw) => text.includes(kw))
}

async function fetchDirect(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'LoonieWinsIngestDryRun/1.0',
      Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
    },
    signal: AbortSignal.timeout(12_000),
  })
  if (!res.ok) return []
  const xml = await res.text()
  return parseItems(xml)
}

async function fetchRss2Json(url) {
  const apiKey = process.env.RSS2JSON_API_KEY
  const params = apiKey
    ? `rss_url=${encodeURIComponent(url)}&api_key=${apiKey}&count=100`
    : `rss_url=${encodeURIComponent(url)}`
  const res = await fetch(`https://api.rss2json.com/v1/api.json?${params}`, {
    signal: AbortSignal.timeout(12_000),
  })
  if (!res.ok) return []
  const json = await res.json()
  if (json.status !== 'ok' || !Array.isArray(json.items)) return []
  return json.items
    .filter((i) => i.title && i.link)
    .map((i) => ({ title: i.title, link: i.link, description: i.description ?? i.content ?? '' }))
}

function parseItems(xml) {
  const items = []
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) ?? []
  for (const block of blocks) {
    const title = (block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
      .replace(/<[^>]+>/g, ' ')
      .trim()
    let link =
      block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] ??
      (block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? '').replace(/<[^>]+>/g, '').trim()
    if (!link) {
      const guid = block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1]?.trim() ?? ''
      if (/^https?:\/\//i.test(guid)) link = guid
    }
    const description = (block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ?? '')
      .replace(/<[^>]+>/g, ' ')
      .trim()
    if (title && link && !/\/(feed|rss)(\/|$)|atom\.xml$/i.test(link)) {
      items.push({ title, link: link.trim(), description })
    }
  }
  return items
}

function merge(primary, secondary) {
  const by = new Map()
  for (const item of [...primary, ...secondary]) {
    if (!by.has(item.link)) by.set(item.link, item)
  }
  return [...by.values()]
}

async function main() {
  const hasKey = Boolean(process.env.RSS2JSON_API_KEY?.trim())
  const byUrl = new Map()
  let ca = 0
  let us = 0

  for (const source of sources) {
    const [direct, viaApi] = await Promise.all([
      fetchDirect(source.url),
      hasKey ? fetchRss2Json(source.url) : Promise.resolve([]),
    ])
    const items = hasKey ? merge(direct, viaApi) : direct.length ? direct : viaApi
    for (const item of items) {
      if (!matches(item.title, item.description ?? '')) continue
      if (!byUrl.has(item.link)) {
        byUrl.set(item.link, source.country)
        if (source.country === 'CA') ca += 1
        else us += 1
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        rss2jsonKey: hasKey,
        uniqueCandidates: byUrl.size,
        eligibilitySplit: { CA: ca, US: us },
        feeds: sources.length,
      },
      null,
      2
    )
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})