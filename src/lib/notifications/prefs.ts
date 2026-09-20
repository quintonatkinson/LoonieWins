/** Notification preference shape stored under profiles.settings.notifications */

import {
  isInQuietHours,
  normalizeQuietTime,
} from './quietHours'

export interface NotificationPrefs {
  /** Master switch — when false, no push alerts are sent */
  enabled: boolean
  /** Alert when new Canada-eligible contests land in Hive Mind */
  newContestsCA: boolean
  /** Alert when new US-eligible contests land (opt-in; CA default) */
  newContestsUS: boolean
  /** Alert for contests whose expiry is later today (America/Toronto) */
  endingTonight: boolean
  /**
   * Weekly email digest: “N new CA contests + M ending tonight”.
   * Delivered by Edge Function `send-weekly-digest` (Resend). Default off.
   */
  weeklyDigestEmail: boolean
  /** Suppress push (not email) between quietHoursStart and quietHoursEnd (Toronto) */
  quietHoursEnabled: boolean
  /** HH:mm local to America/Toronto */
  quietHoursStart: string
  /** HH:mm local to America/Toronto */
  quietHoursEnd: string
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  enabled: true,
  newContestsCA: true,
  newContestsUS: false,
  endingTonight: true,
  weeklyDigestEmail: false,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
}

export function parseNotificationPrefs(
  settings: Record<string, unknown> | null | undefined
): NotificationPrefs {
  const raw = (settings?.notifications ?? {}) as Record<string, unknown>
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_NOTIFICATION_PREFS.enabled,
    newContestsCA:
      typeof raw.newContestsCA === 'boolean'
        ? raw.newContestsCA
        : DEFAULT_NOTIFICATION_PREFS.newContestsCA,
    newContestsUS:
      typeof raw.newContestsUS === 'boolean'
        ? raw.newContestsUS
        : DEFAULT_NOTIFICATION_PREFS.newContestsUS,
    endingTonight:
      typeof raw.endingTonight === 'boolean'
        ? raw.endingTonight
        : DEFAULT_NOTIFICATION_PREFS.endingTonight,
    weeklyDigestEmail:
      typeof raw.weeklyDigestEmail === 'boolean'
        ? raw.weeklyDigestEmail
        : DEFAULT_NOTIFICATION_PREFS.weeklyDigestEmail,
    quietHoursEnabled:
      typeof raw.quietHoursEnabled === 'boolean'
        ? raw.quietHoursEnabled
        : DEFAULT_NOTIFICATION_PREFS.quietHoursEnabled,
    quietHoursStart: normalizeQuietTime(
      raw.quietHoursStart,
      DEFAULT_NOTIFICATION_PREFS.quietHoursStart
    ),
    quietHoursEnd: normalizeQuietTime(
      raw.quietHoursEnd,
      DEFAULT_NOTIFICATION_PREFS.quietHoursEnd
    ),
  }
}

/** Merge notification prefs into existing profiles.settings jsonb. */
export function withNotificationPrefs(
  settings: Record<string, unknown> | null | undefined,
  patch: Partial<NotificationPrefs>
): Record<string, unknown> {
  const current = parseNotificationPrefs(settings)
  return {
    ...(settings ?? {}),
    notifications: { ...current, ...patch },
  }
}

/** True when push should be suppressed for quiet hours. */
export function shouldSuppressPushForQuietHours(
  settings: Record<string, unknown> | null | undefined,
  now = new Date()
): boolean {
  const prefs = parseNotificationPrefs(settings)
  return isInQuietHours(
    {
      enabled: prefs.quietHoursEnabled,
      start: prefs.quietHoursStart,
      end: prefs.quietHoursEnd,
    },
    now
  )
}
