/**
 * Legal / store-listing contact constants.
 *
 * CUSTOMIZE (Quinton): replace every `REPLACE_*` value before shipping store builds.
 * Host the static pages under `public/legal/` at LEGAL_SITE_ORIGIN so both
 * App Store Connect and Google Play Console can link a stable HTTPS URL.
 */

/** Public origin that serves `/legal/*.html` (no trailing slash). */
export const LEGAL_SITE_ORIGIN = 'REPLACE_WITH_HTTPS_ORIGIN' // e.g. https://looniewins.com

/** Support inbox shown in-app and on the Support page. */
export const SUPPORT_EMAIL = 'REPLACE_WITH_SUPPORT_EMAIL' // e.g. support@looniewins.com

/** Legal / privacy contact (can match SUPPORT_EMAIL). */
export const PRIVACY_EMAIL = 'REPLACE_WITH_PRIVACY_EMAIL' // e.g. privacy@looniewins.com

/** Display name for the operator / developer. */
export const OPERATOR_NAME = 'REPLACE_WITH_OPERATOR_NAME' // e.g. Quinton Atkinson / LoonieWins

/** App display name used in policies. */
export const APP_NAME = 'LoonieWins'

/** Bundle / application IDs used in store listings. */
export const IOS_BUNDLE_ID = 'com.quinton.looniewins'
export const ANDROID_PACKAGE = 'com.quinton.looniewins'

export function legalUrl(path: 'privacy' | 'terms' | 'support' | 'delete-account'): string {
  if (LEGAL_SITE_ORIGIN.startsWith('REPLACE_')) {
    return `/legal/${path}.html`
  }
  return `${LEGAL_SITE_ORIGIN}/legal/${path}.html`
}

export function isLegalConfigured(): boolean {
  return !LEGAL_SITE_ORIGIN.startsWith('REPLACE_') && !SUPPORT_EMAIL.startsWith('REPLACE_')
}
