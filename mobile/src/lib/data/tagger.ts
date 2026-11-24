/**
 * Auto-categorization: tags and restrictions from title/body.
 * Honesty rules:
 * - Purchase / 18+ only when age-gate or buy-to-enter language is clear
 * - Never treat “No Purchase Necessary” / AMOE as purchase-required
 * - Québec exclusions cover common CA sponsor phrasing (incl. accents)
 */

export interface TagResult {
  tags: string[]
  restrictions: string[]
}

const DAILY_PATTERNS = /\b(daily|every day|24h|\[daily\])\b/i
const INSTANT_PATTERNS = /\b(instant|iw)\b/i
/** Québec / QC void — keep in sync with Dashboard Québec-safe filter */
const QUEBEC_EXCLUDED_PATTERNS =
  /\b(no[\s-]?qc|void in qc|void (in|where) qu[eé]bec|excl\.?\s*qu[eé]bec|excluding qu[eé]bec|qu[eé]bec excluded|qc excluded|\[no qc\]|\[qc(\/pei)? excluded\]|\(qc(\/pei)? excluded\)|rest of canada|open (only )?to (residents of )?canada (except|excluding|outside) qu[eé]bec|not (open|available) (to|in) qu[eé]bec|qu[eé]bec residents (are )?excluded|void (in|for) (the )?province of qu[eé]bec)\b/i
const HIGH_VALUE_PATTERNS =
  /\b(car|truck|vehicle|trip|vacation|cruise|\$10,?000|\$1,?000,?000|cash|ram\b|f-?150|silverado)\b/i
const MATH_PATTERNS = /\b(math|skill[- ]testing|equation|answer correctly)\b/i
/**
 * Age-gate only — avoid tagging mere “18” in prize copy.
 * 19+/21+ still surface as 18+ filter (adult) so hide-18+ stays conservative.
 */
const AGE_PATTERNS =
  /\b((must be|open to (persons?|entrants?)|entrants? must be|you must be)\s+)?(18|19|21)\+|\b(18|19|21)\s*years(\s*of\s*age)?(\s*or\s*older)?\b|\bage of majority\b|\blegal (drinking )?age\b/i
const SINGLE_ENTRY_PATTERNS = /\b(single entry|one time|one entry|1 entry per person|\[once\])\b/i
const WEEKLY_PATTERNS = /\b(weekly|every week)\b/i

/** Explicit buy-to-enter / purchase-required (avoid matching "No Purchase Necessary"). */
const NO_PURCHASE_NECESSARY =
  /\b(no purchase necessary|without purchase|purchase not (required|necessary)|no buy(ing)? (required|necessary)|amo[eé]|alternate[- ]means of entry)\b/i
const BUY_TO_ENTER_PATTERNS =
  /\b(buy to enter|buy-to-enter|purchase required|purchase-required|with purchase|proof of purchase|product purchase|buy any|buy a |buy one|upc code|receipt required|mail[- ]in entry with (proof|receipt)|purchase to enter|must (buy|purchase)|require(s|d)? (a )?(purchase|receipt|upc))\b/i
/** Loose UPC/receipt only when not in a “no purchase” / AMOE clause */
const PURCHASE_LOOSE = /\b(upc(\s*code)?|proof of purchase|original receipt)\b/i

const REQ_SOCIAL = /\b(instagram|tiktok|tag a friend|share on|retweet|follow us)\b/i
const REQ_APP = /\b(download (the )?app|app store|install the app)\b/i
const REQ_CREATIVE =
  /\b(photo (submit|submission|entry)|video (submit|submission|entry)|essay|story contest|recipe contest)\b/i
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

// Eligibility: NA (both countries in text), US-only signals, Canadian signals
const ELIG_NA =
  /\b(us and canada|u\.s\. and canada|usa and canada|united states and canada|canada and (the )?(u\.s\.|us|united states|usa)|north america|us\/ca|ca\/us|us\s*\+\s*ca|ca\s*\+\s*us|us\s*&\s*canada|canada\s*&\s*(us|u\.s\.|united states)|(?:open|available|legal) to (?:legal )?residents of (?:the )?(?:u\.s\.|us|united states)(?:,| and\/or| and) canada|residents of canada(?:,| and\/or| and) (?:the )?(?:u\.s\.|us|united states)|(?:fifty \(50\) )?united states(?:,| and\/or| and) (?:the )?canada|canada(?:,| and\/or| and) (?:the )?(?:fifty \(50\) )?united states|(?:contiguous )?u\.s\.(?:,| and) canada)\b/i
const ELIG_US =
  /\b(50 united states|50 u\.s\.(?:\s+states)?|contiguous united states|u\.s\. only|us only|united states only|residents of the (?:u\.s\.|us|united states) only|(?:open|available) to (?:legal )?residents of the (?:u\.s\.|us|united states)(?!\s*(?:,| and\/or| and) canada)|excluding canada|not (?:open|available) (?:in|to) canada|void (?:in|where )?canada|(?:u\.s\.|us) residents only)\b/i
const ELIG_CA =
  /\b(residents of canada|legal residents of canada|canadian residents|canada only|open to canada|open to canadians|(?:across|throughout) canada|must be (?:a )?(?:legal )?canadian|canada\/canadian|prizes? (?:shipped |delivered )?to canada|open (?:in|to) (?:the )?canada)\b/i
const ELIG_CA_PROVINCE =
  /\b(?:resident of |legal resident of )?(ontario|quebec|qu[eé]bec|british columbia|alberta|manitoba|saskatchewan|nova scotia|new brunswick|newfoundland|prince edward island|yukon|northwest territories|nunavut)\b/i
const ELIG_CA_HOST = /\.(ca)(?:\/|$|\?)/i
const ELIG_CA_VOID =
  /\b(void|excluding|not (?:open|available) (?:to|in)|not valid in) (?:where )?canada\b/i

function titleCanadianSignal(title: string, fullText: string): boolean {
  if (ELIG_CA_VOID.test(fullText)) return false
  if (ELIG_US.test(fullText)) return false
  if (/🇨🇦|🍁/.test(title)) return true
  if (/\[(?:ca|canada)\]|\((?:ca|canada)\)/i.test(title)) return true
  if (/\bcanada\b|\bcanadian\b/i.test(title)) return true
  return false
}

export interface MetadataResult {
  eligibility: 'CA' | 'US' | 'NA' | 'Unknown'
  eligibilityUnverified?: boolean
  requirements: string[]
}

/**
 * Scan title, body, and optional link URL for country eligibility and entry requirements.
 * NA only when both-country language is present. Unknown when no Canadian proof in text.
 */
export function scanForMetadata(title: string, body: string, link?: string): MetadataResult {
  const text = `${title} ${body} ${link ?? ''}`.toLowerCase()
  let eligibility: 'CA' | 'US' | 'NA' | 'Unknown' = 'Unknown'
  let eligibilityUnverified = true
  const requirements: string[] = []

  const hasNA = ELIG_NA.test(text)
  const hasUS = ELIG_US.test(text) && !hasNA
  const hasCA =
    ELIG_CA.test(text) ||
    ELIG_CA_PROVINCE.test(text) ||
    (link ? ELIG_CA_HOST.test(link) : false) ||
    titleCanadianSignal(title, text)

  if (hasNA) {
    eligibility = 'NA'
    eligibilityUnverified = false
  } else if (hasUS) {
    eligibility = 'US'
    eligibilityUnverified = false
  } else if (hasCA) {
    eligibility = 'CA'
    eligibilityUnverified = false
  } else {
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
