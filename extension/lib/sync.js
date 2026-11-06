import { applySyncedProfile, getSettings, saveSettings } from './storage.js'
import { assertAnonKey, normalizeSupabaseUrl } from './security.js'
import { AUTOFILL_STORAGE_KEY } from './profile.js'

/**
 * Pull profile from a LoonieWins tab's localStorage via executeScript.
 * @param {number} tabId
 */
export async function syncFromTabLocalStorage(tabId) {
  const [{ result } = {}] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (key) => {
      try {
        const raw = localStorage.getItem(key)
        if (!raw) return { found: false, reason: `No ${key} in localStorage` }
        return { found: true, data: JSON.parse(raw) }
      } catch (err) {
        return {
          found: false,
          reason: err instanceof Error ? err.message : 'localStorage read failed',
        }
      }
    },
    args: [AUTOFILL_STORAGE_KEY],
  })

  if (!result?.found) {
    return {
      ok: false,
      reason:
        result?.reason ||
        `Open the LoonieWins app and save Profile autofill first (${AUTOFILL_STORAGE_KEY}).`,
    }
  }

  return applySyncedProfile(result.data, 'localStorage')
}

/**
 * Read Supabase auth session JSON that the JS client stores in localStorage.
 * @param {number} tabId
 */
export async function syncSessionFromTab(tabId) {
  const [{ result } = {}] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      try {
        /** @type {{ access_token?: string, refresh_token?: string, key?: string } | null} */
        let found = null
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) {
            continue
          }
          const raw = localStorage.getItem(key)
          if (!raw) continue
          const parsed = JSON.parse(raw)
          const access =
            parsed?.access_token ||
            parsed?.currentSession?.access_token ||
            parsed?.session?.access_token
          const refresh =
            parsed?.refresh_token ||
            parsed?.currentSession?.refresh_token ||
            parsed?.session?.refresh_token
          if (access) {
            found = {
              access_token: access,
              refresh_token: refresh,
              key,
            }
            break
          }
        }
        return found
          ? { found: true, ...found }
          : { found: false, reason: 'No sb-*-auth-token session in localStorage' }
      } catch (err) {
        return {
          found: false,
          reason: err instanceof Error ? err.message : 'session read failed',
        }
      }
    },
  })

  if (!result?.found) {
    return { ok: false, reason: result?.reason || 'No Supabase session on this tab.' }
  }

  await saveSettings({
    accessToken: result.access_token,
    refreshToken: result.refresh_token || '',
  })
  return { ok: true }
}

/**
 * Fetch profiles.auto_fill_data with the user's access token + anon key.
 * Never uses service_role.
 */
export async function syncFromSupabase() {
  const settings = await getSettings()
  const url = normalizeSupabaseUrl(settings.supabaseUrl)
  const anon = settings.supabaseAnonKey.trim()
  const access = settings.accessToken.trim()

  if (!url || !anon) {
    return {
      ok: false,
      reason: 'Set Supabase URL and anon key in extension Options first.',
    }
  }

  const keyCheck = assertAnonKey(anon)
  if (!keyCheck.ok) return { ok: false, reason: keyCheck.reason }

  if (!access) {
    return {
      ok: false,
      reason:
        'No user access token. Open LoonieWins while signed in, then Sync session from tab.',
    }
  }

  const endpoint = `${url}/rest/v1/profiles?select=auto_fill_data&limit=1`
  const res = await fetch(endpoint, {
    headers: {
      apikey: anon,
      Authorization: `Bearer ${access}`,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return {
      ok: false,
      reason: `Supabase profile fetch failed (${res.status}). ${body.slice(0, 160)}`,
    }
  }

  const rows = await res.json()
  const autoFill = Array.isArray(rows) ? rows[0]?.auto_fill_data : null
  if (!autoFill || typeof autoFill !== 'object') {
    return {
      ok: false,
      reason: 'Profile row has empty auto_fill_data. Save autofill in the app first.',
    }
  }

  return applySyncedProfile(autoFill, 'supabase')
}

/**
 * Full sync: localStorage profile, then optional session + Supabase profile.
 * @param {number} tabId
 */
export async function syncAllFromTab(tabId) {
  const local = await syncFromTabLocalStorage(tabId)
  const session = await syncSessionFromTab(tabId)
  let cloud = { ok: false, reason: 'skipped' }

  if (session.ok) {
    cloud = await syncFromSupabase()
  }

  if (cloud.ok) return { ok: true, source: 'supabase', details: { local, session, cloud } }
  if (local.ok) return { ok: true, source: 'localStorage', details: { local, session, cloud } }

  return {
    ok: false,
    reason:
      local.reason ||
      session.reason ||
      cloud.reason ||
      'Nothing to sync from this tab.',
    details: { local, session, cloud },
  }
}
