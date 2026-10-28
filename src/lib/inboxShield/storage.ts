import type { InboxShieldConsentStatus, InboxShieldPrefs } from './types'
import { DEFAULT_INBOX_SHIELD_PREFS } from './types'

export const INBOX_SHIELD_STORAGE_KEY = 'looniewins_inbox_shield'

export function loadInboxShieldPrefs(): InboxShieldPrefs {
  try {
    const raw = localStorage.getItem(INBOX_SHIELD_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_INBOX_SHIELD_PREFS }
    const parsed = JSON.parse(raw) as Partial<InboxShieldPrefs>
    return {
      ...DEFAULT_INBOX_SHIELD_PREFS,
      ...parsed,
      entry_email_for_giveaways: parsed.entry_email_for_giveaways ?? '',
    }
  } catch {
    return { ...DEFAULT_INBOX_SHIELD_PREFS }
  }
}

export function saveInboxShieldPrefs(prefs: InboxShieldPrefs): void {
  try {
    localStorage.setItem(INBOX_SHIELD_STORAGE_KEY, JSON.stringify(prefs))
    window.dispatchEvent(new CustomEvent('looniewins_inbox_shield_updated'))
  } catch {
    /* quota / private mode */
  }
}

export function hasInboxShieldConsentDecision(prefs?: InboxShieldPrefs): boolean {
  const p = prefs ?? loadInboxShieldPrefs()
  return p.consent_status !== 'unset'
}

export function mergeProfileInboxShield(
  profile: {
    inbox_shield_enabled?: boolean | null
    entry_email_for_giveaways?: string | null
    inbox_shield_consent_at?: string | null
    inbox_shield_mode?: string | null
  } | null | undefined
): InboxShieldPrefs {
  const local = loadInboxShieldPrefs()
  if (!profile) return local

  const mode =
    profile.inbox_shield_mode === 'local' ||
    profile.inbox_shield_mode === 'gmail' ||
    profile.inbox_shield_mode === 'none'
      ? profile.inbox_shield_mode
      : local.inbox_shield_mode

  const cloudConsentAt = profile.inbox_shield_consent_at ?? null
  const useCloud =
    cloudConsentAt &&
    (!local.inbox_shield_consent_at ||
      Date.parse(cloudConsentAt) >= Date.parse(local.inbox_shield_consent_at))

  if (!useCloud) return local

  let consent_status: InboxShieldConsentStatus = local.consent_status
  if (mode === 'local' && profile.inbox_shield_enabled) consent_status = 'local'
  else if (mode === 'gmail') consent_status = 'gmail_wishlist'
  else if (!profile.inbox_shield_enabled && cloudConsentAt) consent_status = 'skipped'

  return {
    inbox_shield_enabled: Boolean(profile.inbox_shield_enabled),
    entry_email_for_giveaways:
      profile.entry_email_for_giveaways?.trim() || local.entry_email_for_giveaways,
    inbox_shield_consent_at: cloudConsentAt,
    inbox_shield_mode: mode,
    consent_status,
  }
}

export function prefsToProfilePatch(prefs: InboxShieldPrefs): Record<string, unknown> {
  return {
    inbox_shield_enabled: prefs.inbox_shield_enabled,
    entry_email_for_giveaways: prefs.entry_email_for_giveaways || null,
    inbox_shield_consent_at: prefs.inbox_shield_consent_at,
    inbox_shield_mode: prefs.inbox_shield_mode,
  }
}

export function applyConsentChoice(
  choice: 'local' | 'skipped' | 'gmail_wishlist',
  entryEmail: string
): InboxShieldPrefs {
  const at = new Date().toISOString()
  if (choice === 'skipped') {
    return {
      inbox_shield_enabled: false,
      entry_email_for_giveaways: entryEmail.trim(),
      inbox_shield_consent_at: at,
      inbox_shield_mode: 'none',
      consent_status: 'skipped',
    }
  }
  if (choice === 'gmail_wishlist') {
    return {
      inbox_shield_enabled: false,
      entry_email_for_giveaways: entryEmail.trim(),
      inbox_shield_consent_at: at,
      inbox_shield_mode: 'gmail',
      consent_status: 'gmail_wishlist',
    }
  }
  return {
    inbox_shield_enabled: true,
    entry_email_for_giveaways: entryEmail.trim(),
    inbox_shield_consent_at: at,
    inbox_shield_mode: 'local',
    consent_status: 'local',
  }
}
