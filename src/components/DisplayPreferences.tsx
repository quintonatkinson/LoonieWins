import { useEffect, useMemo, useState } from 'react'
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
  DEFAULT_FEED_DISPLAY_PREFS,
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
    <label className="flex items-center justify-between gap-3 pt-2">
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-win/90 pt-3 first:pt-1">
      {children}
    </p>
  )
}

function countCustomizations(
  prefs: FeedDisplayPrefs,
  quebecSafe: boolean,
  homeMode: HomeMode
): string[] {
  const chips: string[] = []
  if (prefs.hidePurchaseRequired) chips.push('Hide purchase')
  if (prefs.hideAdult) chips.push('Hide 18+')
  else if (prefs.adultAlwaysConfirm) chips.push('Always confirm 18+')
  if (prefs.cardDensity !== DEFAULT_FEED_DISPLAY_PREFS.cardDensity) chips.push('Compact')
  if (prefs.sortDefault !== DEFAULT_FEED_DISPLAY_PREFS.sortDefault) {
    const label = SORT_DEFAULT_OPTIONS.find((o) => o.key === prefs.sortDefault)?.label
    chips.push(label ? `Sort: ${label}` : 'Custom sort')
  }
  if (prefs.openContestsIn !== DEFAULT_FEED_DISPLAY_PREFS.openContestsIn) {
    chips.push(prefs.openContestsIn === 'browser' ? 'System browser' : 'In-app browser')
  }
  if (quebecSafe) chips.push('Québec-safe')
  if (homeMode !== 'routine') chips.push('Browse home')
  return chips
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

  const chips = useMemo(
    () => countCustomizations(prefs, quebecSafe, homeMode),
    [prefs, quebecSafe, homeMode]
  )

  const patchPref = (patch: Partial<FeedDisplayPrefs>) => {
    setPrefs((prev) => ({ ...prev, ...patch }))
    saveFeedDisplayPrefsLocal(patch)
    void updateProfile({
      settings: withFeedDisplayPrefs(profile?.settings, patch),
    })
  }

  return (
    <div className="px-4 pb-4 space-y-1 border-t border-gray-600/40 bg-gray-900/40">
      <div className="rounded-xl border border-win/25 bg-win/5 p-3 mt-3">
        <p className="text-sm font-semibold text-white">Your feed fingerprint</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {chips.length === 0
            ? 'Defaults — tweak filters & layout below to make Home yours.'
            : `${chips.length} custom touch${chips.length === 1 ? '' : 'es'} active`}
        </p>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {chips.map((c) => (
              <span
                key={c}
                className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-win/15 text-win border border-win/30"
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      <SectionLabel>Feed filters</SectionLabel>
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

      <SectionLabel>Layout & sort</SectionLabel>
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
        <p className="text-sm text-gray-200 mb-2 pt-2">Default sort</p>
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

      <SectionLabel>How contests open</SectionLabel>
      <div>
        <div className="flex gap-2 pt-1">
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

      <SectionLabel>Home screen</SectionLabel>
      <div className="flex gap-2 pt-1">
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

      <div className="pt-3 border-t border-gray-600/40 mt-2">
        <SectionLabel>Invite friends</SectionLabel>
        <div className="pt-1">
          <ReferralInviteCard compact />
        </div>
      </div>

      <p className="text-xs text-gray-500 pt-2">
        Prefs sync to your account when signed in and stick in local storage for guests. Appearance
        accents stay under Appearance above. Quiet hours live under Notifications.
      </p>
    </div>
  )
}
