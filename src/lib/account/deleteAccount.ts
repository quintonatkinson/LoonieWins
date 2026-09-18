import { isSupabaseConfigured, supabase, tracking, giveaways } from '../supabase'

/** Keys the web app may still write locally (cache / legacy). Cleared on delete. */
export const WEB_LOCAL_DATA_KEYS = [
  'looniewins_balance',
  'looniewins_last_daily_entry_at',
  'looniewins_subscription_tier',
  'looniewins_entered',
  'looniewins_reported_urls',
  'loonie_vault_v1',
  'looniewins_autofill',
  'looniewins_settings',
  'looniewins_contest_entries',
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

/** Export local cache + cloud account data when signed in. */
export async function exportAccountData(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    app: 'LoonieWins',
    local: {} as Record<string, unknown>,
  }

  const local = out.local as Record<string, unknown>
  for (const key of WEB_LOCAL_DATA_KEYS) {
    try {
      const raw = localStorage.getItem(key)
      if (raw == null) continue
      try {
        local[key] = JSON.parse(raw)
      } catch {
        local[key] = raw
      }
    } catch {
      /* ignore */
    }
  }

  try {
    if (!supabase || !isSupabaseConfigured) return out
    const { data: sessionData } = await supabase.auth.getSession()
    const user = sessionData.session?.user
    if (!user) return out

    out.userId = user.id
    out.email = user.email

    const [profile, entries, txs, referrals, wins] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      tracking().from('contest_entries').select('*').eq('user_id', user.id),
      tracking().from('transactions').select('*').eq('user_id', user.id),
      giveaways().from('referral_pool').select('*').eq('referrer_id', user.id),
      giveaways().from('user_wins').select('*').eq('user_id', user.id),
    ])

    out.profile = profile.data
    out.contest_entries = entries.data
    out.transactions = txs.data
    out.referral_pool = referrals.data
    out.user_wins = wins.data
  } catch (err) {
    out.exportError = err instanceof Error ? err.message : String(err)
  }

  return out
}

export async function downloadWebDataExport(): Promise<void> {
  const payload = await exportAccountData()
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `looniewins-data-export-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function wipeUserRowsFallback(userId: string): Promise<void> {
  if (!supabase) return
  await Promise.all([
    tracking().from('contest_entries').delete().eq('user_id', userId),
    tracking().from('transactions').delete().eq('user_id', userId),
    giveaways().from('user_wins').delete().eq('user_id', userId),
    giveaways().from('referral_pool').delete().eq('referrer_id', userId),
    supabase.from('profiles').delete().eq('id', userId),
  ])
}

/**
 * Clears on-device data and deletes the auth user via `public.delete_own_account()`.
 */
export async function deleteAccountAndLocalData(): Promise<DeleteAccountResult> {
  let hadSession = false
  let deletedRemoteAccount = false
  let remoteError: string | undefined

  try {
    if (supabase && isSupabaseConfigured) {
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
