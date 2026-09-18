import { supabase } from '../supabase'

/** Keys the web app writes today (clear on delete / reset). */
export const WEB_LOCAL_DATA_KEYS = [
  'looniewins_balance',
  'looniewins_last_daily_entry_at',
  'looniewins_subscription_tier',
  'looniewins_entered',
  'looniewins_reported_urls',
  'loonie_vault_v1',
  'looniewins_autofill',
  'looniewins_settings',
] as const

export interface DeleteAccountResult {
  clearedLocal: boolean
  deletedRemoteAccount: boolean
  hadSession: boolean
  message: string
  error?: string
}

export function clearWebLocalData(): void {
  for (const key of WEB_LOCAL_DATA_KEYS) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }
  // Also clear any legacy / prefixed keys we own.
  try {
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && (k.startsWith('looniewins_') || k.startsWith('loonie_'))) {
        toRemove.push(k)
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
}

export function exportWebLocalData(): Record<string, unknown> {
  const out: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    app: 'LoonieWins',
  }
  for (const key of WEB_LOCAL_DATA_KEYS) {
    try {
      const raw = localStorage.getItem(key)
      if (raw == null) continue
      try {
        out[key] = JSON.parse(raw)
      } catch {
        out[key] = raw
      }
    } catch {
      /* ignore */
    }
  }
  return out
}

export function downloadWebDataExport(): void {
  const payload = exportWebLocalData()
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `looniewins-data-export-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Clears on-device data and, if a Supabase session exists, deletes the auth user
 * via `public.delete_own_account()` (see supabase/account_deletion.sql).
 */
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
        // RPC not applied yet: wipe user-owned rows the client can reach under RLS, then sign out.
        remoteError = rpcError.message
        await supabase.from('applied_contests').delete().eq('user_id', userId)
        await supabase.from('transactions').delete().eq('user_id', userId)
        await supabase.from('user_wins').delete().eq('user_id', userId)
        await supabase.from('referral_pool').delete().eq('referrer_id', userId)
        await supabase.from('profiles').delete().eq('id', userId)
        await supabase.auth.signOut()
      } else {
        deletedRemoteAccount = true
        await supabase.auth.signOut()
      }
    }
  } catch (err) {
    remoteError = err instanceof Error ? err.message : String(err)
  }

  clearWebLocalData()

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
