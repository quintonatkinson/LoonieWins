/**
 * Shared AutoFillData helpers (mirrors src/types/profile.ts + smoke-test storage key).
 */

export const AUTOFILL_STORAGE_KEY = 'looniewins_autofill'
export const ENTERED_STORAGE_KEY = 'looniewins_entered'

/** @typedef {{
 *   name?: string
 *   firstName?: string
 *   lastName?: string
 *   email?: string
 *   address?: string
 *   phone?: string
 *   city?: string
 *   province?: string
 *   postalCode?: string
 * }} AutoFillData */

/** @type {AutoFillData} */
export const EMPTY_PROFILE = {
  name: '',
  firstName: '',
  lastName: '',
  email: '',
  address: '',
  phone: '',
  city: '',
  province: '',
  postalCode: '',
}

/**
 * @param {Partial<AutoFillData> | null | undefined} raw
 * @returns {AutoFillData}
 */
export function normalizeProfile(raw) {
  const data = raw && typeof raw === 'object' ? raw : {}
  const name = String(data.name ?? '').trim()
  let firstName = String(data.firstName ?? '').trim()
  let lastName = String(data.lastName ?? '').trim()
  if (!firstName && !lastName && name) {
    const parts = name.split(/\s+/, 2)
    firstName = parts[0] ?? ''
    lastName = parts[1] ?? ''
  }
  const composed =
    name || [firstName, lastName].filter(Boolean).join(' ') || ''

  return {
    name: composed,
    firstName,
    lastName,
    email: String(data.email ?? '').trim(),
    address: String(data.address ?? '').trim(),
    phone: String(data.phone ?? '').trim(),
    city: String(data.city ?? '').trim(),
    province: String(data.province ?? '').trim(),
    postalCode: String(data.postalCode ?? '').trim(),
  }
}

/**
 * @param {AutoFillData} profile
 * @returns {boolean}
 */
export function hasUsableProfile(profile) {
  const p = normalizeProfile(profile)
  return Boolean(
    p.email ||
      p.name ||
      p.firstName ||
      p.phone ||
      p.address ||
      p.city ||
      p.postalCode,
  )
}

/**
 * Map to assassin / content-script field names.
 * @param {AutoFillData} data
 */
export function toFillPayload(data) {
  const p = normalizeProfile(data)
  return {
    email: p.email || undefined,
    first_name: p.firstName || undefined,
    last_name: p.lastName || undefined,
    name: p.name || undefined,
    address: p.address || undefined,
    city: p.city || undefined,
    province: p.province || undefined,
    postal_code: p.postalCode || undefined,
    phone: p.phone || undefined,
  }
}
