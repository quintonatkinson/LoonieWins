import type { AutoFillData } from '../../types/profile'

const STORAGE_KEY = 'looniewins_autofill'

/** Empty defaults — Profile / account data should own real values. */
const DEFAULT_AUTOFILL: AutoFillData = {
  name: '',
  email: '',
  address: '',
  phone: '',
  city: '',
  province: '',
  postalCode: '',
  firstName: '',
  lastName: '',
}

export function loadAutoFillData(): AutoFillData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_AUTOFILL }
    const parsed = JSON.parse(raw) as Partial<AutoFillData>
    return { ...DEFAULT_AUTOFILL, ...parsed }
  } catch {
    return { ...DEFAULT_AUTOFILL }
  }
}

export function saveAutoFillData(data: AutoFillData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    window.dispatchEvent(new CustomEvent('loonie_autofill_updated'))
  } catch {
    // ignore quota / private mode
  }
}

export function isAutoFillReady(data: AutoFillData | null | undefined): boolean {
  if (!data) return false
  return Boolean(
    data.email?.trim() ||
      data.name?.trim() ||
      data.firstName?.trim() ||
      data.lastName?.trim()
  )
}
