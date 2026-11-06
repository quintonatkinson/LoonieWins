/** Notification preference shape stored under profiles.settings.notifications */

import {
  isInQuietHours,
  normalizeQuietTime,
} from './quietHours'

export interface NotificationPrefs {
  enabled: boolean
  newContestsCA: boolean
  newContestsUS: boolean
  endingTonight: boolean
  /** Weekly email digest via send-weekly-digest (Resend). Default off. */
  weeklyDigestEmail: boolean
  quietHoursEnabled: boolean
  quietHoursStart: string
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
