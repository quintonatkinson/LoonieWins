import { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { SUPPORT_EMAIL, LEGAL_SITE_ORIGIN, legalUrl, mailtoSupport } from '../lib/legal/constants'
import { deleteAccountAndLocalData } from '../lib/account/deleteAccount'
import NotificationPreferences from '../components/NotificationPreferences'
import { useAuth } from '../contexts/AuthContext'
import { registerForPushNotifications } from '../lib/notifications/registerPush'

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
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [pushMsg, setPushMsg] = useState<string | null>(null)

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
          <Text style={{ color: '#39FF14', fontSize: 16 }}>Close</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 8 }}>
        <Text style={{ color: '#9ca3af', fontSize: 13, marginBottom: 8 }}>
          Privacy, support, notifications, and account controls for App Store and Google Play.
        </Text>

        <NotificationPreferences />

        <TouchableOpacity
          onPress={() => void enableDevicePush()}
          disabled={busy}
          style={{
            backgroundColor: '#1f2937',
            borderRadius: 12,
            padding: 14,
            borderWidth: 1,
            borderColor: '#39FF14',
            marginBottom: 8,
            opacity: busy ? 0.6 : 1,
          }}
        >
          <Text style={{ color: '#39FF14', fontWeight: '700' }}>Register this device</Text>
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
