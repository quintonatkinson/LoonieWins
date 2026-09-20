import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  loadHomeMode,
  loadQuebecSafe,
  saveHomeMode,
  saveQuebecSafe,
  type HomeMode,
} from '../lib/utils/feedPrefs'
import {
  resolveFeedDisplayPrefs,
  saveFeedDisplayPrefsLocal,
  withFeedDisplayPrefs,
  SORT_DEFAULT_OPTIONS,
  type CardDensity,
  type FeedDisplayPrefs,
  type OpenContestsIn,
  type SortDefault,
} from '../lib/utils/userSettings'
import ReferralInviteCard from './ReferralInviteCard'

function SwitchRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 pt-3">
      <span className="text-sm text-gray-200">
        {label}
        <span className="block text-xs text-gray-500">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
          checked ? 'bg-win' : 'bg-gray-600'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </label>
  )
}

/**
 * Profile → Preferences: feed filters, density, sort, open-in, Québec-safe, home mode, referral.
 */
export default function DisplayPreferences() {
  const { profile, updateProfile } = useAuth()
  const initial = resolveFeedDisplayPrefs({ settings: profile?.settings })
  const [quebecSafe, setQuebecSafe] = useState(() => loadQuebecSafe(false))
  const [homeMode, setHomeMode] = useState<HomeMode>(() => loadHomeMode('routine'))
  const [prefs, setPrefs] = useState<FeedDisplayPrefs>(initial)

  useEffect(() => {
    setPrefs(resolveFeedDisplayPrefs({ settings: profile?.settings }))
  }, [profile?.settings])

  const patchPref = (patch: Partial<FeedDisplayPrefs>) => {
    setPrefs((prev) => ({ ...prev, ...patch }))
    saveFeedDisplayPrefsLocal(patch)
    void updateProfile({
      settings: withFeedDisplayPrefs(profile?.settings, patch),
    })
  }

  return (
    <div className="px-4 pb-4 space-y-3 border-t border-gray-600/40 bg-gray-900/40">
      <SwitchRow
        label="Québec-safe"
        hint="Hide contests that exclude Quebec"
        checked={quebecSafe}
        onChange={() => {
          const next = !quebecSafe
          setQuebecSafe(next)
          saveQuebecSafe(next)
          void updateProfile({
            settings: { ...(profile?.settings ?? {}), quebecSafe: next },
          })
        }}
      />
      <SwitchRow
        label="Hide purchase-required"
        hint="Exclude contests that need a receipt or purchase"
        checked={prefs.hidePurchaseRequired}
        onChange={() => patchPref({ hidePurchaseRequired: !prefs.hidePurchaseRequired })}
      />
      <SwitchRow
        label="Hide 18+ contests"
        hint="Exclude age-gated contests from Home"
        checked={prefs.hideAdult}
        onChange={() => patchPref({ hideAdult: !prefs.hideAdult })}
      />
      {!prefs.hideAdult && (
        <SwitchRow
          label="Always confirm 18+"
          hint="Re-prompt age gate every time you enter an 18+ contest"
          checked={prefs.adultAlwaysConfirm}
          onChange={() => patchPref({ adultAlwaysConfirm: !prefs.adultAlwaysConfirm })}
        />
      )}

      <div>
        <p className="text-sm text-gray-200 mb-2 pt-1">Card density</p>
        <div className="flex gap-2">
          {(
            [
              ['comfortable', 'Comfortable'],
              ['compact', 'Compact'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => patchPref({ cardDensity: key as CardDensity })}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold ${
                prefs.cardDensity === key
                  ? 'bg-win text-on-win'
                  : 'bg-gray-800 text-gray-400 border border-gray-600/50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm text-gray-200 mb-2">Default sort</p>
        <div className="flex flex-wrap gap-2">
          {SORT_DEFAULT_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => patchPref({ sortDefault: key as SortDefault })}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                prefs.sortDefault === key
                  ? 'bg-win text-on-win'
                  : 'bg-gray-800 text-gray-400 border border-gray-600/50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm text-gray-200 mb-2">Open contests in</p>
        <div className="flex gap-2">
          {(
            [
              ['webview', 'In-app browser'],
              ['browser', 'System browser'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => patchPref({ openContestsIn: key as OpenContestsIn })}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold ${
                prefs.openContestsIn === key
                  ? 'bg-win text-on-win'
                  : 'bg-gray-800 text-gray-400 border border-gray-600/50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Applies on mobile / native shells. Web desktop already opens in a new tab when not native.
        </p>
      </div>

      <div>
        <p className="text-sm text-gray-200 mb-2">Home screen</p>
        <div className="flex gap-2">
          {(
            [
              ['routine', 'Daily Routine'],
              ['browse', 'Browse all'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setHomeMode(key)
                saveHomeMode(key)
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold ${
                homeMode === key
                  ? 'bg-win text-on-win'
                  : 'bg-gray-800 text-gray-400 border border-gray-600/50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-gray-600/40">
        <p className="text-sm text-gray-200 mb-1">Invite friends</p>
        <ReferralInviteCard compact />
      </div>

      <p className="text-xs text-gray-500">
        Prefs sync to your account when signed in and stick in local storage for guests. Appearance
        accents stay under Appearance above.
      </p>
    </div>
  )
}
