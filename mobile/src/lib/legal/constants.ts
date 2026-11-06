/**
 * Legal / store-listing contact constants (mobile).
 * CUSTOMIZE: keep in sync with src/lib/legal/constants.ts and public/legal/*.html
 */

export const LEGAL_SITE_ORIGIN = 'REPLACE_WITH_HTTPS_ORIGIN'
export const SUPPORT_EMAIL = 'REPLACE_WITH_SUPPORT_EMAIL'
export const PRIVACY_EMAIL = 'REPLACE_WITH_PRIVACY_EMAIL'
export const OPERATOR_NAME = 'REPLACE_WITH_OPERATOR_NAME'
export const APP_NAME = 'LoonieWins'

export function legalUrl(path: 'privacy' | 'terms' | 'support' | 'delete-account'): string {
  if (LEGAL_SITE_ORIGIN.startsWith('REPLACE_')) {
    // Relative paths only work on web hosting; for native, Quinton must set LEGAL_SITE_ORIGIN.
    return `https://example.com/legal/${path}.html`
  }
  return `${LEGAL_SITE_ORIGIN}/legal/${path}.html`
}

export function mailtoSupport(subject = 'LoonieWins support'): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`
}
