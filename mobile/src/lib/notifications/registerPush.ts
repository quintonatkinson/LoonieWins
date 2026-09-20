import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { supabase } from '../supabase'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

function projectId(): string | undefined {
  const eas = Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined
  return eas?.projectId ?? Constants.easConfig?.projectId
}

/**
 * Request permission, obtain Expo push token, upsert into public.push_tokens.
 * No-ops on web / simulators without push support.
 */
export async function registerForPushNotifications(
  userId: string
): Promise<{ token: string | null; error: string | null }> {
  if (Platform.OS === 'web') {
    return { token: null, error: 'Web push is not enabled for LoonieWins yet' }
  }

  if (!Device.isDevice) {
    return { token: null, error: 'Push requires a physical device' }
  }

  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') {
    return { token: null, error: 'Notification permission not granted' }
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('looniewins-alerts', {
      name: 'Contest alerts',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#39FF14',
    })
  }

  const pid = projectId()
  if (!pid) {
    return {
      token: null,
      error: 'Missing Expo projectId (mobile/app.json extra.eas.projectId)',
    }
  }

  let expoPushToken: string
  try {
    const result = await Notifications.getExpoPushTokenAsync({ projectId: pid })
    expoPushToken = result.data
  } catch (err) {
    return {
      token: null,
      error: err instanceof Error ? err.message : String(err),
    }
  }

  const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'unknown'
  const deviceId =
    (Constants as { sessionId?: string }).sessionId ??
    Device.osInternalBuildId ??
    null
  const appVersion = Constants.expoConfig?.version ?? null

  const { error } = await supabase.from('push_tokens').upsert(
    {
      user_id: userId,
      expo_push_token: expoPushToken,
      platform,
      device_id: deviceId,
      app_version: appVersion,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,expo_push_token' }
  )

  if (error) {
    return { token: expoPushToken, error: error.message }
  }

  return { token: expoPushToken, error: null }
}

export async function unregisterPushToken(token: string | null | undefined): Promise<void> {
  if (!token) return
  try {
    await supabase.from('push_tokens').delete().eq('expo_push_token', token)
  } catch {
    /* ignore */
  }
}
