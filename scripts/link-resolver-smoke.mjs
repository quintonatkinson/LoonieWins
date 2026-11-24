#!/usr/bin/env node
/**
 * Smoke tests for supabase/functions/_shared/linkResolver.ts (pure helpers).
 * Run: node scripts/link-resolver-smoke.mjs
 */

import assert from 'node:assert/strict'

// Inline copies of regex helpers — keep aligned with linkResolver.ts extractFromText / isAggregatorListingUrl.
const WIDGET = /(?:gleam\.io|woobox\.com|rafflecopter\.com|kingsumo\.com)/i
const AGGREGATOR_HOST =
  /(?:canadianfreestuff|contestcanada|contestscoop|sweetiessweeps|sweepstakesbible)\./i

function extractFromText(text) {
  const urlRe = /https?:\/\/[^\s"'<>)\]]+/gi
  let m
  while ((m = urlRe.exec(text)) !== null) {
    const url = m[0].replace(/[.,;:!?)\]]+$/, '')
    if (WIDGET.test(url)) return url
  }
  return null
}

function isAggregatorListingUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (WIDGET.test(host)) return false
    return AGGREGATOR_HOST.test(host)
  } catch {
    return false
  }
}

assert.equal(
  extractFromText('Enter here: https://gleam.io/AbCd/brand-sweepstakes today'),
  'https://gleam.io/AbCd/brand-sweepstakes'
)
assert.equal(extractFromText('no links'), null)
assert.equal(isAggregatorListingUrl('https://www.sweepstakesbible.com/foo'), true)
assert.equal(isAggregatorListingUrl('https://gleam.io/x/y'), false)

console.log('link-resolver-smoke: ok')