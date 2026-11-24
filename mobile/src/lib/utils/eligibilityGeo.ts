/**
 * Geo feed rules (Quinton policy): default Canada-only feed.
 */

import type { GeoFilterValue } from '../../components/CountryToggle'

export type ContestEligibility = 'CA' | 'US' | 'NA' | 'Unknown'

export interface EligibilityFields {
  eligibility?: ContestEligibility | string | null
  eligibilityUnverified?: boolean | null
}

export function isCanadianFeedEligible(c: EligibilityFields): boolean {
  const elig = (c.eligibility ?? 'Unknown') as ContestEligibility
  if (elig === 'CA') return true
  if (elig === 'NA') return true
  return false
}

export function passesGeoFilter(c: EligibilityFields, geoFilter: GeoFilterValue): boolean {
  if (geoFilter === 'ANY') return true
  const elig = (c.eligibility ?? 'Unknown') as ContestEligibility
  if (geoFilter === 'CA') return isCanadianFeedEligible(c)
  if (geoFilter === 'US') {
    if (elig === 'US') return true
    if (elig === 'NA') return true
    return false
  }
  return true
}

export interface EligibilityBadge {
  label: string
  shortLabel: string
  title: string
  tone: 'ca' | 'na' | 'us' | 'unknown'
}

export function eligibilityBadge(c: EligibilityFields): EligibilityBadge {
  const elig = (c.eligibility ?? 'Unknown') as ContestEligibility
  const unverified = c.eligibilityUnverified ?? false
  if (elig === 'NA') {
    return {
      label: 'Also open to US',
      shortLabel: 'CA + US',
      title: 'Detected open to Canadian and US residents',
      tone: 'na',
    }
  }
  if (elig === 'CA') {
    return {
      label: 'Canada only',
      shortLabel: '🍁 CA',
      title: unverified
        ? 'Listed on a Canada-only source; confirm rules before entering'
        : 'Canada residents (detected in listing text)',
      tone: 'ca',
    }
  }
  if (elig === 'US') {
    return {
      label: 'US only',
      shortLabel: '🇺🇸 US',
      title: 'United States residents only',
      tone: 'us',
    }
  }
  return {
    label: 'Unknown region',
    shortLabel: '?',
    title: 'Eligibility not verified — hidden on Canada filter',
    tone: 'unknown',
  }
}