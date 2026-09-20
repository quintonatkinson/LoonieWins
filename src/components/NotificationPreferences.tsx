import { useState } from 'react'
import { Bell } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  parseNotificationPrefs,
  withNotificationPrefs,
  type NotificationPrefs,
} from '../lib/notifications/prefs'

type PrefKey = keyof NotificationPrefs

const TOGGLES: { key: PrefKey; label: string; hint: string }[] = [
  {
    key: 'enabled',
    label: 'Push alerts master',
    hint: 'Turn all contest push alerts on or off',
  },
  {
    key: 'newContestsCA',
    label: 'New Canada contests',
    hint: 'When new CA (or untagged) contests land',
  },
  {
    key: 'newContestsUS',
    label: 'New US contests',
    hint: 'Optional — US sweepstakes feed alerts',
  },
  {
    key: 'endingTonight',
    label: 'Ending tonight',
    hint: 'Contests that expire later today (Toronto time). Pro gets priority / guaranteed delivery.',
  },
  {
    key: 'weeklyDigestEmail',
    label: 'Weekly digest email',
    hint: 'Email summary: N new CA contests + M ending tonight (Sundays)',
  },
]

/**
 * Profile / Settings notification preference toggles.
 * Persists to profiles.settings.notifications (web stores prefs only —
 * delivery is via Expo on mobile; see push-notifications docs).
 */
export default function NotificationPreferences() {
  const { profile, updateProfile, user } = useAuth()
  const prefs = parseNotificationPrefs(profile?.settings)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const setPref = async (key: PrefKey, value: boolean) => {
    if (!user) {
      setMsg('Sign in to sync notification preferences to your account.')
      return
    }
    setBusy(true)
    setMsg(null)
    const nextSettings = withNotificationPrefs(profile?.settings, { [key]: value })
    const { error } = await updateProfile({ settings: nextSettings })
    setBusy(false)
    if (error) setMsg(error)
    else setMsg('Saved.')
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Bell className="w-5 h-5 text-win" />
        <h2 className="text-sm font-semibold text-white uppercase tracking-wide">
          Notifications
        </h2>
      </div>
      <p className="text-xs text-gray-500">
        Alerts deliver on the Expo mobile app. Web saves preferences only — browser
        Web Push is not enabled yet.
      </p>
      <ul className="rounded-xl bg-gray-800/80 border border-gray-600/50 divide-y divide-gray-600/50 overflow-hidden">
        {TOGGLES.map(({ key, label, hint }) => {
          const on = prefs[key]
          const disabledMaster =
            key !== 'enabled' && key !== 'weeklyDigestEmail' && !prefs.enabled
          return (
            <li key={key} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p
                  className={`text-sm font-medium ${disabledMaster ? 'text-gray-500' : 'text-white'}`}
                >
                  {label}
                </p>
                <p className="text-xs text-gray-500">{hint}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                disabled={busy || disabledMaster}
                onClick={() => void setPref(key, !on)}
                className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
                  on ? 'bg-win' : 'bg-gray-600'
                } ${busy || disabledMaster ? 'opacity-50' : ''}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    on ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </li>
          )
        })}
      </ul>
      {msg && <p className="text-xs text-gray-400">{msg}</p>}
    </section>
  )
}
