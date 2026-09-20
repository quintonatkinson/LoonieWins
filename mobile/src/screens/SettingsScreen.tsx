import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  ActivityIndicator,
  Share,
  Switch,
} from 'react-native'
import { SUPPORT_EMAIL, LEGAL_SITE_ORIGIN, legalUrl, mailtoSupport } from '../lib/legal/constants'
import { deleteAccountAndLocalData } from '../lib/account/deleteAccount'
import NotificationPreferences from '../components/NotificationPreferences'
import AccentPicker from '../components/AccentPicker'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { registerForPushNotifications } from '../lib/notifications/registerPush'
import { isSupabaseConfigured } from '../lib/supabase'
import { rpcEnsureReferralCode } from '../lib/monetization/progression'
import {
  resolveFeedDisplayPrefs,
  saveFeedDisplayPrefsLocal,
  withFeedDisplayPrefs,
  SORT_DEFAULT_OPTIONS,
  type FeedDisplayPrefs,
  type CardDensity,
  type OpenContestsIn,
  type SortDefault,
} from '../lib/utils/userSettings'
import { loadQuebecSafe, saveQuebecSafe } from '../lib/utils/feedPrefs'

interface SettingsScreenProps {
  onClose: () => void
}

function openLegal(path: 'privacy' | 'terms' | 'support' | 'delete-account') {
  const url = legalUrl(path)
  if (LEGAL_SITE_ORIGIN.startsWith('REPLACE_')) {
    Alert.alert(
      'Hosted URL not set',
      'Set LEGAL_SITE_ORIGIN in mobile/src/lib/legal/constants.ts (and ship public/legal/*.html) so store listing links open. You can still use Delete Account below.'
    )
    return
  }
  Linking.openURL(url)
}

export default function SettingsScreen({ onClose }: SettingsScreenProps) {
  const { user, profile, updateProfile } = useAuth()
  const { accentColor } = useTheme()
  const [busy, setBusy] = useState(false)
  const [pushMsg, setPushMsg] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<FeedDisplayPrefs>(DEFAULT_SYNC)
  const [quebecSafe, setQuebecSafe] = useState(false)
  const [inviteCode, setInviteCode] = useState<string | null>(profile?.referral_code ?? null)
  const [inviteMsg, setInviteMsg] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const next = await resolveFeedDisplayPrefs({ settings: profile?.settings })
      setPrefs(next)
      setQuebecSafe(await loadQuebecSafe(Boolean(profile?.settings?.quebecSafe)))
    })()
  }, [profile?.settings])

  useEffect(() => {
    if (!user || !isSupabaseConfigured) {
      setInviteCode(profile?.referral_code ?? null)
      return
    }
    void (async () => {
      const code = await rpcEnsureReferralCode()
      setInviteCode(code || profile?.referral_code || null)
    })()
  }, [user, profile?.referral_code])

  const patchPref = useCallback(
    (patch: Partial<FeedDisplayPrefs>) => {
      setPrefs((prev) => ({ ...prev, ...patch }))
      void saveFeedDisplayPrefsLocal(patch)
      void updateProfile({
        settings: withFeedDisplayPrefs(profile?.settings, patch),
      })
    },
    [profile?.settings, updateProfile]
  )

  const enableDevicePush = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Log in to register this device for push alerts.')
      return
    }
    setBusy(true)
    setPushMsg(null)
    try {
      const result = await registerForPushNotifications(user.id, { force: true })
      if (result.error && !result.token) {
        Alert.alert('Push registration', result.error)
      } else {
        setPushMsg(
          result.error
            ? `Token saved with warning: ${result.error}`
            : 'Device registered. Tokens stored in Supabase.'
        )
      }
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = () => {
    Alert.alert(
      'Delete account & data?',
      'This permanently clears LoonieWins data on this device and deletes your cloud account if you are signed in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true)
            try {
              const result = await deleteAccountAndLocalData()
              Alert.alert('Done', result.message, [{ text: 'OK', onPress: onClose }])
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : String(err))
            } finally {
              setBusy(false)
            }
          },
        },
      ]
    )
  }

  const copyInvite = async () => {
    if (!inviteCode) return
    try {
      await Share.share({ message: inviteCode })
      setInviteMsg('Share sheet opened (or copy from there).')
    } catch {
      setInviteMsg('Could not open share sheet.')
    }
  }

  const shareInvite = async () => {
    if (!inviteCode) return
    try {
      await Share.share({
        message: `Join me on LoonieWins — use my invite code ${inviteCode} when you sign up.`,
      })
    } catch {
      /* dismissed */
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#111827' }}>
      <View
        style={{
          paddingTop: 56,
          paddingHorizontal: 16,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#374151',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>Settings</Text>
        <TouchableOpacity onPress={onClose} accessibilityRole="button">
          <Text style={{ color: accentColor, fontSize: 16 }}>Close</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <Text style={{ color: '#9ca3af', fontSize: 13, marginBottom: 12 }}>
          Appearance, feed filters, notifications, invite code, and account controls.
        </Text>

        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14, marginBottom: 8 }}>
          APPEARANCE
        </Text>
        <AccentPicker />

        <Text
          style={{
            color: '#fff',
            fontWeight: '700',
            fontSize: 14,
            marginTop: 16,
            marginBottom: 8,
          }}
        >
          PREFERENCES
        </Text>

        <PrefSwitch
          label="Québec-safe"
          hint="Hide contests that exclude Quebec"
          value={quebecSafe}
          accent={accentColor}
          onChange={(next) => {
            setQuebecSafe(next)
            void saveQuebecSafe(next)
            void updateProfile({
              settings: { ...(profile?.settings ?? {}), quebecSafe: next },
            })
          }}
        />
        <PrefSwitch
          label="Hide purchase-required"
          hint="Exclude receipt / purchase contests"
          value={prefs.hidePurchaseRequired}
          accent={accentColor}
          onChange={(v) => patchPref({ hidePurchaseRequired: v })}
        />
        <PrefSwitch
          label="Hide 18+ contests"
          hint="Exclude age-gated contests from Home"
          value={prefs.hideAdult}
          accent={accentColor}
          onChange={(v) => patchPref({ hideAdult: v })}
        />
        {!prefs.hideAdult ? (
          <PrefSwitch
            label="Always confirm 18+"
            hint="Re-prompt age gate on every 18+ enter"
            value={prefs.adultAlwaysConfirm}
            accent={accentColor}
            onChange={(v) => patchPref({ adultAlwaysConfirm: v })}
          />
        ) : null}

        <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 4, marginBottom: 6 }}>
          Card density
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          {(
            [
              ['comfortable', 'Comfortable'],
              ['compact', 'Compact'],
            ] as const
          ).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              onPress={() => patchPref({ cardDensity: key as CardDensity })}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: prefs.cardDensity === key ? accentColor : '#1f2937',
                borderWidth: 1,
                borderColor: prefs.cardDensity === key ? accentColor : '#4b5563',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  color: prefs.cardDensity === key ? '#111827' : '#d1d5db',
                  fontWeight: '700',
                  fontSize: 12,
                }}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>Default sort</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {SORT_DEFAULT_OPTIONS.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              onPress={() => patchPref({ sortDefault: key as SortDefault })}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                backgroundColor: prefs.sortDefault === key ? accentColor : '#1f2937',
                borderWidth: 1,
                borderColor: prefs.sortDefault === key ? accentColor : '#4b5563',
              }}
            >
              <Text
                style={{
                  color: prefs.sortDefault === key ? '#111827' : '#d1d5db',
                  fontWeight: '600',
                  fontSize: 12,
                }}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>Open contests in</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {(
            [
              ['webview', 'In-app WebView'],
              ['browser', 'System browser'],
            ] as const
          ).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              onPress={() => patchPref({ openContestsIn: key as OpenContestsIn })}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: prefs.openContestsIn === key ? accentColor : '#1f2937',
                borderWidth: 1,
                borderColor: prefs.openContestsIn === key ? accentColor : '#4b5563',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  color: prefs.openContestsIn === key ? '#111827' : '#d1d5db',
                  fontWeight: '700',
                  fontSize: 12,
                }}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14, marginBottom: 8 }}>
          INVITE CODE
        </Text>
        <View
          style={{
            backgroundColor: '#1f2937',
            borderRadius: 12,
            padding: 14,
            borderWidth: 1,
            borderColor: '#4b5563',
            marginBottom: 16,
          }}
        >
          {inviteCode ? (
            <>
              <Text style={{ color: accentColor, fontFamily: 'monospace', fontSize: 18, fontWeight: '700' }}>
                {inviteCode}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <TouchableOpacity
                  onPress={() => void copyInvite()}
                  style={{
                    flex: 1,
                    backgroundColor: accentColor,
                    borderRadius: 10,
                    paddingVertical: 10,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#111827', fontWeight: '700' }}>Copy / Share code</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => void shareInvite()}
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    paddingVertical: 10,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: '#4b5563',
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Share invite</Text>
                </TouchableOpacity>
              </View>
              {inviteMsg ? (
                <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 6 }}>{inviteMsg}</Text>
              ) : null}
            </>
          ) : (
            <Text style={{ color: '#9ca3af' }}>
              {user ? 'Generating invite code…' : 'Sign in to get your invite code.'}
            </Text>
          )}
        </View>

        <NotificationPreferences />

        <TouchableOpacity
          onPress={() => void enableDevicePush()}
          disabled={busy}
          style={{
            backgroundColor: '#1f2937',
            borderRadius: 12,
            padding: 14,
            borderWidth: 1,
            borderColor: accentColor,
            marginBottom: 8,
            opacity: busy ? 0.6 : 1,
          }}
        >
          <Text style={{ color: accentColor, fontWeight: '700' }}>Register this device</Text>
          <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
            Request permission and save Expo push token to Supabase
          </Text>
        </TouchableOpacity>
        {pushMsg ? (
          <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 8 }}>{pushMsg}</Text>
        ) : null}

        {(
          [
            { label: 'Privacy Policy', path: 'privacy' as const },
            { label: 'Terms of Use', path: 'terms' as const },
            { label: 'Support', path: 'support' as const },
            { label: 'Delete account (web)', path: 'delete-account' as const },
          ] as const
        ).map((item) => (
          <TouchableOpacity
            key={item.path}
            onPress={() => openLegal(item.path)}
            style={{
              backgroundColor: '#1f2937',
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: '#4b5563',
              marginBottom: 8,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>{item.label}</Text>
            <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
              Opens hosted legal page
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          onPress={() => Linking.openURL(mailtoSupport())}
          style={{
            backgroundColor: '#1f2937',
            borderRadius: 12,
            padding: 14,
            borderWidth: 1,
            borderColor: '#4b5563',
            marginBottom: 8,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Email support</Text>
          <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
            {SUPPORT_EMAIL.startsWith('REPLACE_') ? 'Set SUPPORT_EMAIL in constants' : SUPPORT_EMAIL}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={confirmDelete}
          disabled={busy}
          style={{
            backgroundColor: '#7f1d1d',
            borderRadius: 12,
            padding: 14,
            marginTop: 12,
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={{ color: '#fecaca', fontWeight: '700' }}>Delete Account</Text>
              <Text style={{ color: '#fca5a5', fontSize: 12, marginTop: 4 }}>
                Clears on-device data now; deletes cloud account when signed in
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

const DEFAULT_SYNC: FeedDisplayPrefs = {
  hidePurchaseRequired: false,
  hideAdult: false,
  adultAlwaysConfirm: false,
  cardDensity: 'comfortable',
  sortDefault: 'ending-soon',
  openContestsIn: 'webview',
}

function PrefSwitch({
  label,
  hint,
  value,
  onChange,
  accent,
}: {
  label: string
  hint: string
  value: boolean
  onChange: (v: boolean) => void
  accent: string
}) {
  return (
    <View
      style={{
        backgroundColor: '#1f2937',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: '#4b5563',
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#fff', fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#4b5563', true: accent }}
        thumbColor="#fff"
      />
    </View>
  )
}
