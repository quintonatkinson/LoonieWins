/**
 * Guardrails: never persist or use a Supabase service_role key.
 */

/**
 * Decode JWT payload without verifying signature (client-side role sniff only).
 * @param {string} token
 * @returns {Record<string, unknown> | null}
 */
export function decodeJwtPayload(token) {
  try {
    const parts = String(token).split('.')
    if (parts.length < 2) return null
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const json = atob(padded)
    return JSON.parse(json)
  } catch {
    return null
  }
}

/**
 * @param {string | null | undefined} key
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function assertAnonKey(key) {
  const value = String(key ?? '').trim()
  if (!value) return { ok: true }

  const lower = value.toLowerCase()
  if (lower.includes('service_role') || lower.includes('service-role')) {
    return {
      ok: false,
      reason: 'service_role keys are not allowed. Use the anon (publishable) key only.',
    }
  }

  const payload = decodeJwtPayload(value)
  if (payload) {
    const role = String(payload.role ?? payload.rol ?? '').toLowerCase()
    if (role === 'service_role') {
      return {
        ok: false,
        reason: 'This JWT has role service_role. Paste the anon key instead.',
      }
    }
  }

  return { ok: true }
}

/**
 * @param {string | null | undefined} url
 * @returns {string}
 */
export function normalizeSupabaseUrl(url) {
  return String(url ?? '')
    .trim()
    .replace(/\/+$/, '')
}
