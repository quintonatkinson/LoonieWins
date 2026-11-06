/** Inbox Shield — Phase 1 prefs (local + optional Supabase profile columns). */

export type InboxShieldConsentStatus = 'unset' | 'skipped' | 'local' | 'gmail_wishlist'

export type InboxShieldTab = 'primary' | 'promotions' | 'spam'

export interface InboxShieldPrefs {
  inbox_shield_enabled: boolean
  entry_email_for_giveaways: string
  inbox_shield_consent_at: string | null
  /** How the user chose to use Inbox Shield (Gmail connect is Phase 2). */
  inbox_shield_mode: 'none' | 'local' | 'gmail'
  consent_status: InboxShieldConsentStatus
}

export interface InboxShieldMailItem {
  id: string
  from: string
  subject: string
  preview: string
  receivedAt: string
  tab: InboxShieldTab
  /** Phase 1 placeholders until Gmail sync. */
  isPlaceholder?: boolean
}

export const DEFAULT_INBOX_SHIELD_PREFS: InboxShieldPrefs = {
  inbox_shield_enabled: false,
  entry_email_for_giveaways: '',
  inbox_shield_consent_at: null,
  inbox_shield_mode: 'none',
  consent_status: 'unset',
}
