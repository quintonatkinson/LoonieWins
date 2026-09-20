/** Notification preference shape stored under profiles.settings.notifications */

export interface NotificationPrefs {
  enabled: boolean
  newContestsCA: boolean
  newContestsUS: boolean
  endingTonight: boolean
  /** Weekly email digest via send-weekly-digest (Resend). Default off. */
  weeklyDigestEmail: boolean
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  enabled: true,
  newContestsCA: true,
  newContestsUS: false,
  endingTonight: true,
  weeklyDigestEmail: false,
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
