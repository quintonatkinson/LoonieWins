/** Notification preference shape stored under profiles.settings.notifications */

export interface NotificationPrefs {
  /** Master switch — when false, no push alerts are sent */
  enabled: boolean
  /** Alert when new Canada-eligible contests land in Hive Mind */
  newContestsCA: boolean
  /** Alert when new US-eligible contests land (opt-in; CA default) */
  newContestsUS: boolean
  /** Alert for contests whose expiry is later today (America/Toronto) */
  endingTonight: boolean
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  enabled: true,
  newContestsCA: true,
  newContestsUS: false,
  endingTonight: true,
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
