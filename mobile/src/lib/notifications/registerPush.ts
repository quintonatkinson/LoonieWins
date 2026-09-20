import { Platform, AppState, type AppStateStatus } from 'react-native'
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

/** Standard contest alerts (new contests + free ending-tonight). */
export const PUSH_CHANNEL_ALERTS = 'looniewins-alerts'
/** Pro priority ending-tonight — HIGH importance Android channel. */
export const PUSH_CHANNEL_ENDING_PRO = 'looniewins-ending-pro'

const MIN_REREGISTER_MS = 6 * 60 * 60 * 1000 // 6h debounce when already healthy
let lastOkAt = 0
let lastUserId: string | null = null
let lastToken: string | null = null
let inFlight: Promise<{ token: string | null; error: string | null }> | null = null

function projectId(): string | undefined {
  const eas = Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined
  return eas?.projectId ?? Constants.easConfig?.projectId
}

async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ALERTS, {
    name: 'Contest alerts',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#39FF14',
  })
  await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ENDING_PRO, {
    name: 'Ending tonight (Pro)',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#39FF14',
    sound: 'default',
  })
}

/**
 * Request permission, obtain Expo push token, upsert into public.push_tokens.
 * Hardened: retries, AppState re-register, Android Pro channel, debounce.
 * No-ops on web / simulators without push support.
 */
export async function registerForPushNotifications(
  userId: string,
  opts?: { force?: boolean }
): Promise<{ token: string | null; error: string | null }> {
  if (inFlight && lastUserId === userId && !opts?.force) {
    return inFlight
  }

  const run = doRegister(userId, opts)
  inFlight = run
  try {
    return await run
  } finally {
    if (inFlight === run) inFlight = null
  }
}

async function doRegister(
  userId: string,
  opts?: { force?: boolean }
): Promise<{ token: string | null; error: string | null }> {
  if (Platform.OS === 'web') {
    return { token: null, error: 'Web push is not enabled for LoonieWins yet' }
  }

  if (!Device.isDevice) {
    return { token: null, error: 'Push requires a physical device' }
  }

  if (
    !opts?.force &&
    lastUserId === userId &&
    lastToken &&
    Date.now() - lastOkAt < MIN_REREGISTER_MS
  ) {
    return { token: lastToken, error: null }
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

  await ensureAndroidChannels()

  const pid = projectId()
  if (!pid) {
    return {
      token: null,
      error: 'Missing Expo projectId (mobile/app.json extra.eas.projectId)',
    }
  }

  let expoPushToken: string | null = null
  let lastErr: string | null = null
  // Retry: Expo token fetch can flake right after cold start / credential sync
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await Notifications.getExpoPushTokenAsync({ projectId: pid })
      expoPushToken = result.data
      lastErr = null
      break
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err)
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
    }
  }
  if (!expoPushToken) {
    return { token: null, error: lastErr ?? 'Failed to get Expo push token' }
  }

  const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'unknown'
  const deviceId =
    Device.modelId ??
    Device.osInternalBuildId ??
    (Constants as { sessionId?: string }).sessionId ??
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

  lastOkAt = Date.now()
  lastUserId = userId
  lastToken = expoPushToken
  return { token: expoPushToken, error: null }
}

export async function unregisterPushToken(token: string | null | undefined): Promise<void> {
  if (!token) return
  try {
    await supabase.from('push_tokens').delete().eq('expo_push_token', token)
  } catch {
    /* ignore */
  }
  if (lastToken === token) {
    lastToken = null
    lastOkAt = 0
  }
}

/**
 * Re-register when the app returns to foreground (token refresh / permission grants).
 * Call once from App root; returns an unsubscribe.
 */
export function subscribePushRegistrationOnResume(
  getUserId: () => string | null | undefined,
  shouldRegister: () => boolean
): () => void {
  const onChange = (state: AppStateStatus) => {
    if (state !== 'active') return
    const uid = getUserId()
    if (!uid || !shouldRegister()) return
    void registerForPushNotifications(uid).then((r) => {
      if (r.error && !r.token) console.warn('[Push] resume register', r.error)
    })
  }
  const sub = AppState.addEventListener('change', onChange)
  return () => sub.remove()
}
