/**
 * Auto-categorization: tags and restrictions from title/body.
 */

export interface TagResult {
  tags: string[]
  restrictions: string[]
}

const DAILY_PATTERNS = /\b(daily|every day|24h)\b/i
const INSTANT_PATTERNS = /\b(instant|iw)\b/i
const QUEBEC_EXCLUDED_PATTERNS = /\b(no qc|void in qc|excl quebec|excl\.?\s*quebec|rest of canada|quebec excluded|qc excluded)\b/i
const HIGH_VALUE_PATTERNS = /\b(car|trip|vacation|\$10,?000|cash)\b/i
const MATH_PATTERNS = /\b(math|skill testing|equation|answer correctly)\b/i
const PURCHASE_PATTERNS = /\b(purchase|receipt|buy|upc)\b/i
const SOCIAL_PATTERNS = /\b(instagram|tiktok|share|tag a friend)\b/i

/**
 * Derive tags and restrictions from contest title and body.
 * CRITICAL: Quebec-excluded contests get "no_quebec" in restrictions.
 */
export function autoCategorize(title: string, body: string): TagResult {
  const tags: string[] = []
  const restrictions: string[] = []
  const text = `${title} ${body}`.toLowerCase()

  if (DAILY_PATTERNS.test(text)) tags.push('Daily')
  if (INSTANT_PATTERNS.test(text)) tags.push('Instant Win')
  if (HIGH_VALUE_PATTERNS.test(text)) tags.push('High Value')
  if (MATH_PATTERNS.test(text)) tags.push('🧠 Math')
  if (PURCHASE_PATTERNS.test(text)) tags.push('🧾 Purchase')
  if (SOCIAL_PATTERNS.test(text)) tags.push('📱 Social')
  if (QUEBEC_EXCLUDED_PATTERNS.test(text)) restrictions.push('no_quebec')

  return { tags, restrictions }
}

// Eligibility: NA first (multi-country), then US (strict), then CA
const ELIG_NA = /\b(us and canada|north america|us\/ca|us\s*&\s*canada)\b/i
const ELIG_US = /\b(50 us|us only|united states only|residents of the us|us residents only)\b/i
const ELIG_CA = /\b(residents of canada|canada only|canadian residents)\b/i

const REQ_PURCHASE = /\b(purchase|buy|receipt|upc)\b/i
const REQ_SOCIAL = /\b(instagram|tiktok|tag|share|retweet)\b/i
const REQ_APP = /\b(download|app store|install)\b/i
const REQ_CREATIVE = /\b(photo|video|essay|story|recipe)\b/i
const REQ_NEWSLETTER = /\b(subscribe|email list)\b/i

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

  if (REQ_PURCHASE.test(text)) requirements.push('Purchase Required')
  if (REQ_SOCIAL.test(text)) requirements.push('Social Action')
  if (REQ_APP.test(text)) requirements.push('App Download')
  if (REQ_CREATIVE.test(text)) requirements.push('Creative Submission')
  if (REQ_NEWSLETTER.test(text)) requirements.push('Newsletter Signup')

  return { eligibility, eligibilityUnverified, requirements }
}
