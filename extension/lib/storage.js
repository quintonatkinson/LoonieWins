import {
  EMPTY_PROFILE,
  normalizeProfile,
  hasUsableProfile,
} from './profile.js'
import { assertAnonKey, normalizeSupabaseUrl } from './security.js'

const KEYS = {
  profile: 'profile',
  supabaseUrl: 'supabaseUrl',
  supabaseAnonKey: 'supabaseAnonKey',
  accessToken: 'accessToken',
  refreshToken: 'refreshToken',
  lastSyncAt: 'lastSyncAt',
  lastSyncSource: 'lastSyncSource',
  appOrigins: 'appOrigins',
}

/**
 * @typedef {{
 *   profile: import('./profile.js').AutoFillData
 *   supabaseUrl: string
 *   supabaseAnonKey: string
 *   accessToken: string
 *   refreshToken: string
 *   lastSyncAt: string | null
 *   lastSyncSource: string | null
 *   appOrigins: string[]
 * }} ExtensionSettings
 */

/** @returns {Promise<ExtensionSettings>} */
export async function getSettings() {
  const raw = await chrome.storage.local.get(Object.values(KEYS))
  return {
    profile: normalizeProfile(raw[KEYS.profile] ?? EMPTY_PROFILE),
    supabaseUrl: normalizeSupabaseUrl(raw[KEYS.supabaseUrl]),
    supabaseAnonKey: String(raw[KEYS.supabaseAnonKey] ?? ''),
    accessToken: String(raw[KEYS.accessToken] ?? ''),
    refreshToken: String(raw[KEYS.refreshToken] ?? ''),
    lastSyncAt: raw[KEYS.lastSyncAt] ?? null,
    lastSyncSource: raw[KEYS.lastSyncSource] ?? null,
    appOrigins: Array.isArray(raw[KEYS.appOrigins])
      ? raw[KEYS.appOrigins]
      : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  }
}

/**
 * @param {Partial<ExtensionSettings>} patch
 */
export async function saveSettings(patch) {
  /** @type {Record<string, unknown>} */
  const next = {}

  if (patch.profile !== undefined) {
    next[KEYS.profile] = normalizeProfile(patch.profile)
  }
  if (patch.supabaseUrl !== undefined) {
    next[KEYS.supabaseUrl] = normalizeSupabaseUrl(patch.supabaseUrl)
  }
  if (patch.supabaseAnonKey !== undefined) {
    const check = assertAnonKey(patch.supabaseAnonKey)
    if (!check.ok) throw new Error(check.reason)
    next[KEYS.supabaseAnonKey] = String(patch.supabaseAnonKey).trim()
  }
  if (patch.accessToken !== undefined) {
    next[KEYS.accessToken] = String(patch.accessToken ?? '')
  }
  if (patch.refreshToken !== undefined) {
    next[KEYS.refreshToken] = String(patch.refreshToken ?? '')
  }
  if (patch.lastSyncAt !== undefined) {
    next[KEYS.lastSyncAt] = patch.lastSyncAt
  }
  if (patch.lastSyncSource !== undefined) {
    next[KEYS.lastSyncSource] = patch.lastSyncSource
  }
  if (patch.appOrigins !== undefined) {
    next[KEYS.appOrigins] = patch.appOrigins
  }

  await chrome.storage.local.set(next)
  return getSettings()
}

export async function clearSessionTokens() {
  await chrome.storage.local.remove([KEYS.accessToken, KEYS.refreshToken])
}

/**
 * Apply a profile blob from the web app bridge or Supabase.
 * @param {unknown} data
 * @param {string} source
 */
export async function applySyncedProfile(data, source) {
  const profile = normalizeProfile(/** @type {object} */ (data))
  if (!hasUsableProfile(profile)) {
    return { ok: false, reason: 'No autofill fields found in sync payload.' }
  }
  await saveSettings({
    profile,
    lastSyncAt: new Date().toISOString(),
    lastSyncSource: source,
  })
  return { ok: true, profile }
}

export { KEYS }
