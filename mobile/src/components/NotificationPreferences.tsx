import { useState } from 'react'
import { View, Text, Switch, ActivityIndicator, TextInput } from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import {
  parseNotificationPrefs,
  withNotificationPrefs,
  type NotificationPrefs,
} from '../lib/notifications/prefs'
import { registerForPushNotifications } from '../lib/notifications/registerPush'
import { useTheme } from '../contexts/ThemeContext'

type BoolPrefKey = {
  [K in keyof NotificationPrefs]: NotificationPrefs[K] extends boolean ? K : never
}[keyof NotificationPrefs]

const TOGGLES: { key: BoolPrefKey; label: string; hint: string }[] = [
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
    hint: 'Contests that expire later today (Toronto time). Pro gets priority delivery.',
  },
  {
    key: 'weeklyDigestEmail',
    label: 'Weekly digest email',
    hint: 'Email: N new CA contests + M ending tonight (Sundays)',
  },
  {
    key: 'quietHoursEnabled',
    label: 'Quiet hours',
    hint: 'Pause push overnight (Toronto). Email digest still sends.',
  },
]

export default function NotificationPreferences() {
  const { profile, updateProfile, user } = useAuth()
  const { accentColor } = useTheme()
  const prefs = parseNotificationPrefs(profile?.settings)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const setPref = async (patch: Partial<NotificationPrefs>) => {
    if (!user) {
      setMsg('Sign in to sync notification preferences.')
      return
    }
    setBusy(true)
    setMsg(null)
    const nextSettings = withNotificationPrefs(profile?.settings, patch)
    const { error } = await updateProfile({ settings: nextSettings })
    if (!error && patch.enabled === true) {
      const reg = await registerForPushNotifications(user.id)
      if (reg.error) setMsg(`Prefs saved. Token: ${reg.error}`)
      else setMsg('Saved. Device registered for push.')
    } else if (error) {
      setMsg(error)
    } else {
      setMsg('Saved.')
    }
    setBusy(false)
  }

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14, marginBottom: 4 }}>
        NOTIFICATIONS
      </Text>
      <Text style={{ color: '#6b7280', fontSize: 12, marginBottom: 10 }}>
        New CA contests (US optional) and ending-tonight expiry alerts via Expo.
      </Text>
      {TOGGLES.map(({ key, label, hint }) => {
        const on = prefs[key]
        const disabledMaster =
          key !== 'enabled' &&
          key !== 'weeklyDigestEmail' &&
          key !== 'quietHoursEnabled' &&
          !prefs.enabled
        return (
          <View
            key={key}
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
              opacity: disabledMaster ? 0.5 : 1,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>{label}</Text>
              <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>{hint}</Text>
            </View>
            {busy ? (
              <ActivityIndicator color={accentColor} />
            ) : (
              <Switch
                value={on}
                disabled={disabledMaster}
                onValueChange={(v) => void setPref({ [key]: v })}
                trackColor={{ false: '#4b5563', true: accentColor }}
                thumbColor="#fff"
              />
            )}
          </View>
        )
      })}
      {prefs.quietHoursEnabled ? (
        <View
          style={{
            backgroundColor: '#1f2937',
            borderRadius: 12,
            padding: 14,
            borderWidth: 1,
            borderColor: '#4b5563',
            marginBottom: 8,
            gap: 10,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Quiet window (Toronto)</Text>
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Use 24h HH:mm (e.g. 22:00)</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}>From</Text>
              <TextInput
                value={prefs.quietHoursStart}
                editable={!busy}
                onChangeText={(v) => void setPref({ quietHoursStart: v })}
                placeholder="22:00"
                placeholderTextColor="#6b7280"
                autoCapitalize="none"
                style={{
                  color: '#fff',
                  backgroundColor: '#111827',
                  borderWidth: 1,
                  borderColor: '#4b5563',
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}>Until</Text>
              <TextInput
                value={prefs.quietHoursEnd}
                editable={!busy}
                onChangeText={(v) => void setPref({ quietHoursEnd: v })}
                placeholder="07:00"
                placeholderTextColor="#6b7280"
                autoCapitalize="none"
                style={{
                  color: '#fff',
                  backgroundColor: '#111827',
                  borderWidth: 1,
                  borderColor: '#4b5563',
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                }}
              />
            </View>
          </View>
        </View>
      ) : null}
      {msg ? (
        <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>{msg}</Text>
      ) : null}
    </View>
  )
}
