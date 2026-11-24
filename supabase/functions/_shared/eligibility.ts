/**
 * Shared ingest eligibility heuristics — keep aligned with src/lib/data/tagger.ts
 */

export type Eligibility = 'CA' | 'US' | 'NA' | 'Unknown'

const ELIG_NA =
  /\b(us and canada|u\.s\. and canada|usa and canada|united states and canada|canada and (the )?(u\.s\.|us|united states)|north america|us\/ca|ca\/us|us\s*&\s*canada|canada\s*&\s*(us|u\.s\.|united states)|(?:open|available|legal) to (?:legal )?residents of (?:the )?(?:u\.s\.|us|united states)(?:,| and) canada|residents of canada(?:,| and) (?:the )?(?:u\.s\.|us|united states))\b/i
const ELIG_US =
  /\b(50 united states|50 u\.s\.(?:\s+states)?|contiguous united states|u\.s\. only|us only|united states only|residents of the (?:u\.s\.|us|united states) only|(?:open|available) to (?:legal )?residents of the (?:u\.s\.|us|united states)(?!\s*(?:,| and) canada)|excluding canada|not (?:open|available) (?:in|to) canada|void (?:in|where )?canada|(?:u\.s\.|us) residents only)\b/i
const ELIG_CA =
  /\b(residents of canada|legal residents of canada|canadian residents|canada only|open to canada|open to canadians|(?:across|throughout) canada|must be (?:a )?(?:legal )?canadian|canada\/canadian|prizes? (?:shipped |delivered )?to canada)\b/i
const ELIG_CA_PROVINCE =
  /\b(?:resident of |legal resident of )?(ontario|quebec|qu[eé]bec|british columbia|alberta|manitoba|saskatchewan|nova scotia|new brunswick|newfoundland|prince edward island|yukon|northwest territories|nunavut)\b/i
const ELIG_CA_HOST = /\.(ca)(?:\/|$|\?)/i

export function scanEligibility(
  title: string,
  body: string,
  link?: string
): { eligibility: Eligibility; eligibilityUnverified: boolean } {
  const text = `${title} ${body} ${link ?? ''}`.toLowerCase()
  const hasNA = ELIG_NA.test(text)
  const hasUS = ELIG_US.test(text) && !hasNA
  const hasCA =
    ELIG_CA.test(text) || ELIG_CA_PROVINCE.test(text) || (link ? ELIG_CA_HOST.test(link) : false)

  if (hasNA) return { eligibility: 'NA', eligibilityUnverified: false }
  if (hasUS) return { eligibility: 'US', eligibilityUnverified: false }
  if (hasCA) return { eligibility: 'CA', eligibilityUnverified: false }
  return { eligibility: 'Unknown', eligibilityUnverified: true }
}

export function resolveIngestEligibility(
  scanned: { eligibility: Eligibility; eligibilityUnverified: boolean },
  sourceCountry: 'CA' | 'US' | 'BOTH'
): { eligibility: Eligibility; eligibilityUnverified: boolean } {
  if (scanned.eligibility !== 'Unknown') return scanned
  if (sourceCountry === 'CA') {
    return { eligibility: 'CA', eligibilityUnverified: true }
  }
  if (sourceCountry === 'US') {
    return { eligibility: 'US', eligibilityUnverified: true }
  }
  return { eligibility: 'Unknown', eligibilityUnverified: true }
}