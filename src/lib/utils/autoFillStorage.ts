import type { AutoFillData } from '../../types/profile'

const STORAGE_KEY = 'looniewins_autofill'

const DEFAULT_AUTOFILL: AutoFillData = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  address: '123 Main St, Toronto ON',
  phone: '',
  city: 'Toronto',
  province: 'ON',
  postalCode: '',
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
