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
const AGE_PATTERNS = /\b(18\+|21\+|18 years|21 years|age of majority)\b/i
const SINGLE_ENTRY_PATTERNS = /\b(single entry|one time|one entry|1 entry per person)\b/i
const WEEKLY_PATTERNS = /\b(weekly|every week)\b/i

const REQ_PURCHASE = /\b(purchase|buy|receipt|upc)\b/i
const REQ_SOCIAL = /\b(instagram|tiktok|tag|share|retweet)\b/i
const REQ_APP = /\b(download|app store|install)\b/i
const REQ_CREATIVE = /\b(photo|video|essay|story|recipe)\b/i
const REQ_NEWSLETTER = /\b(subscribe|email list)\b/i

function hasHeavyRequirements(text: string): boolean {
  return (
    REQ_PURCHASE.test(text) ||
    REQ_SOCIAL.test(text) ||
    REQ_APP.test(text) ||
    REQ_CREATIVE.test(text) ||
    REQ_NEWSLETTER.test(text)
  )
}

export function autoCategorize(title: string, body: string): TagResult {
  const tags: string[] = []
  const restrictions: string[] = []
  const text = `${title} ${body}`.toLowerCase()

  if (DAILY_PATTERNS.test(text)) tags.push('Daily')
  if (INSTANT_PATTERNS.test(text)) tags.push('Instant Win')
  if (HIGH_VALUE_PATTERNS.test(text)) tags.push('High Value')
  if (MATH_PATTERNS.test(text)) tags.push('🧠 Math')
  if (PURCHASE_PATTERNS.test(text)) tags.push('🧾 Purchase')
  if (REQ_SOCIAL.test(text)) tags.push('📱 Social')
  if (AGE_PATTERNS.test(text)) tags.push('18+')
  if (SINGLE_ENTRY_PATTERNS.test(text)) tags.push('1 Single Entry')
  if (WEEKLY_PATTERNS.test(text)) tags.push('Weekly')
  if (!hasHeavyRequirements(text)) tags.push('⚡ Easy Entry')
  if (QUEBEC_EXCLUDED_PATTERNS.test(text)) restrictions.push('no_quebec')

  return { tags, restrictions }
}

const ELIG_NA = /\b(us and canada|north america|us\/ca|us\s*&\s*canada)\b/i
const ELIG_US = /\b(50 us|us only|united states only|residents of the us|us residents only)\b/i
const ELIG_CA = /\b(residents of canada|canada only|canadian residents)\b/i

export interface MetadataResult {
  eligibility: 'CA' | 'US' | 'NA' | 'Unknown'
  eligibilityUnverified?: boolean
  requirements: string[]
}

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
