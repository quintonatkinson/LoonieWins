import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase, tracking, giveaways } from '../supabase'

export const MOBILE_LOCAL_DATA_KEYS = [
  'looniewins_balance',
  'looniewins_last_daily_entry_at',
  'looniewins_subscription_tier',
  'looniewins_entered',
  'looniewins_reported_urls',
  'loonie_vault_v1',
  'looniewins_autofill',
  'looniewins_settings',
  'looniewins_display_prefs',
  'looniewins_guest_profile',
  'looniewins_weekly_entries_used',
  'looniewins_contest_entries',
] as const

export interface DeleteAccountResult {
  clearedLocal: boolean
  deletedRemoteAccount: boolean
  hadSession: boolean
  message: string
  error?: string
}

export async function clearMobileLocalData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([...MOBILE_LOCAL_DATA_KEYS])
  } catch {
    /* ignore */
  }
  try {
    const keys = await AsyncStorage.getAllKeys()
    const ours = keys.filter((k) => k.startsWith('looniewins_') || k.startsWith('loonie_'))
    if (ours.length) await AsyncStorage.multiRemove(ours)
  } catch {
    /* ignore */
  }
}

async function wipeUserRowsFallback(userId: string): Promise<void> {
  await Promise.all([
    supabase.from('push_alert_log').delete().eq('user_id', userId),
    supabase.from('push_tokens').delete().eq('user_id', userId),
    tracking().from('contest_entries').delete().eq('user_id', userId),
    tracking().from('transactions').delete().eq('user_id', userId),
    giveaways().from('user_wins').delete().eq('user_id', userId),
    giveaways().from('referral_pool').delete().eq('referrer_id', userId),
    supabase.from('profiles').delete().eq('id', userId),
  ])
}

export async function deleteAccountAndLocalData(): Promise<DeleteAccountResult> {
  let hadSession = false
  let deletedRemoteAccount = false
  let remoteError: string | undefined

  try {
    const { data } = await supabase.auth.getSession()
    const session = data.session
    hadSession = Boolean(session?.user)

    if (hadSession && session?.user?.id) {
      const userId = session.user.id
      const { error: rpcError } = await supabase.rpc('delete_own_account')
      if (rpcError) {
        remoteError = rpcError.message
        await wipeUserRowsFallback(userId)
        await supabase.auth.signOut()
      } else {
        deletedRemoteAccount = true
        await supabase.auth.signOut()
      }
    }
  } catch (err) {
    remoteError = err instanceof Error ? err.message : String(err)
  }

  await clearMobileLocalData()

  const message = hadSession
    ? deletedRemoteAccount
      ? 'Your account and on-device data were deleted.'
      : 'On-device data was cleared. Server account deletion needs the delete_own_account SQL function (or contact support).'
    : 'All LoonieWins data on this device was permanently cleared. No signed-in account was found.'

  return {
    clearedLocal: true,
    deletedRemoteAccount,
    hadSession,
    message,
    error: remoteError,
  }
}
