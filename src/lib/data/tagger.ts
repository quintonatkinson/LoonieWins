/**
 * Auto-categorization: tags and restrictions from title/body.
 */

export interface TagResult {
  tags: string[]
  restrictions: string[]
}

const DAILY_PATTERNS = /\b(daily|every day|24h|\[daily\])\b/i
const INSTANT_PATTERNS = /\b(instant|iw)\b/i
const QUEBEC_EXCLUDED_PATTERNS = /\b(no qc|void in qc|excl quebec|excl\.?\s*quebec|rest of canada|quebec excluded|qc excluded|\[no qc\])\b/i
const HIGH_VALUE_PATTERNS =
  /\b(car|truck|vehicle|trip|vacation|cruise|\$10,?000|\$1,?000,?000|cash|ram\b|f-?150|silverado)\b/i
const MATH_PATTERNS = /\b(math|skill testing|equation|answer correctly)\b/i
const AGE_PATTERNS = /\b(18\+|21\+|18 years|21 years|age of majority)\b/i
const SINGLE_ENTRY_PATTERNS = /\b(single entry|one time|one entry|1 entry per person|\[once\])\b/i
const WEEKLY_PATTERNS = /\b(weekly|every week)\b/i

/** Explicit buy-to-enter / purchase-required (avoid matching "No Purchase Necessary"). */
const NO_PURCHASE_NECESSARY =
  /\b(no purchase necessary|without purchase|purchase not (required|necessary)|no buy(ing)? (required|necessary))\b/i
const BUY_TO_ENTER_PATTERNS =
  /\b(buy to enter|buy-to-enter|purchase required|purchase-required|with purchase|proof of purchase|product purchase|buy any|buy a |buy one|upc code|receipt required|mail[- ]in entry with (proof|receipt)|purchase to enter)\b/i
const PURCHASE_LOOSE = /\b(upc|receipt)\b/i

const REQ_SOCIAL = /\b(instagram|tiktok|tag a friend|share on|retweet|follow us)\b/i
const REQ_APP = /\b(download (the )?app|app store|install the app)\b/i
const REQ_CREATIVE = /\b(photo (submit|submission|entry)|video (submit|submission|entry)|essay|story contest|recipe contest)\b/i
const REQ_NEWSLETTER = /\b(subscribe to (our )?newsletter|email list signup|join our email)\b/i

export function isPurchaseRequiredText(text: string): boolean {
  if (NO_PURCHASE_NECESSARY.test(text)) return false
  return BUY_TO_ENTER_PATTERNS.test(text) || PURCHASE_LOOSE.test(text)
}

function hasHeavyRequirements(text: string): boolean {
  return (
    isPurchaseRequiredText(text) ||
    REQ_SOCIAL.test(text) ||
    REQ_APP.test(text) ||
    REQ_CREATIVE.test(text) ||
    REQ_NEWSLETTER.test(text)
  )
}

/**
 * Derive tags and restrictions from contest title and body.
 * CRITICAL: Quebec-excluded contests get "no_quebec" in restrictions.
 * "Easy Entry" = autofill + maybe math only — no purchase, social, app, creative, newsletter.
 * Purchase / buy-to-enter is tagged for Entry UX badges.
 */
export function autoCategorize(title: string, body: string): TagResult {
  const tags: string[] = []
  const restrictions: string[] = []
  const text = `${title} ${body}`.toLowerCase()

  if (DAILY_PATTERNS.test(text)) tags.push('Daily')
  if (INSTANT_PATTERNS.test(text)) tags.push('Instant Win')
  if (HIGH_VALUE_PATTERNS.test(text)) tags.push('High Value')
  if (MATH_PATTERNS.test(text)) tags.push('🧠 Math')
  if (isPurchaseRequiredText(text)) {
    tags.push('🧾 Purchase')
    tags.push('Buy to Enter')
  }
  if (REQ_SOCIAL.test(text)) tags.push('📱 Social')
  if (AGE_PATTERNS.test(text)) tags.push('18+')
  if (SINGLE_ENTRY_PATTERNS.test(text)) tags.push('1 Single Entry')
  if (WEEKLY_PATTERNS.test(text)) tags.push('Weekly')
  if (!hasHeavyRequirements(text)) tags.push('⚡ Easy Entry')
  if (QUEBEC_EXCLUDED_PATTERNS.test(text)) restrictions.push('no_quebec')

  return { tags, restrictions }
}

// Eligibility: NA first (multi-country), then US (strict), then CA
const ELIG_NA = /\b(us and canada|north america|us\/ca|us\s*&\s*canada)\b/i
const ELIG_US = /\b(50 us|us only|united states only|residents of the us|us residents only)\b/i
const ELIG_CA = /\b(residents of canada|canada only|canadian residents)\b/i

export interface MetadataResult {
  eligibility: 'CA' | 'US' | 'NA' | 'Unknown'
  eligibilityUnverified?: boolean
  requirements: string[]
}

/**
 * Scan title and body for country eligibility and entry requirements.
 * USA detection is strict to avoid false positives for Canadian users.
 */
export function scanForMetadata(title: string, body: string): MetadataResult {
  const text = `${title} ${body}`.toLowerCase()
  let eligibility: 'CA' | 'US' | 'NA' | 'Unknown' = 'Unknown'
  let eligibilityUnverified = false
  const requirements: string[] = []

  if (ELIG_NA.test(text)) eligibility = 'NA'
  else if (ELIG_US.test(text)) eligibility = 'US'
  else if (ELIG_CA.test(text)) eligibility = 'CA'
  else {
    eligibility = 'Unknown'
    eligibilityUnverified = true
  }

  if (isPurchaseRequiredText(text)) requirements.push('Purchase Required')
  if (REQ_SOCIAL.test(text)) requirements.push('Social Action')
  if (REQ_APP.test(text)) requirements.push('App Download')
  if (REQ_CREATIVE.test(text)) requirements.push('Creative Submission')
  if (REQ_NEWSLETTER.test(text)) requirements.push('Newsletter Signup')

  return { eligibility, eligibilityUnverified, requirements }
}
