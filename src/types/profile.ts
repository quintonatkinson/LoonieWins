export interface AutoFillData {
  name?: string
  firstName?: string
  lastName?: string
  email?: string
  address?: string
  phone?: string
  city?: string
  province?: string
  postalCode?: string
  /** ISO preferred (YYYY-MM-DD); also accepts MM/DD/YYYY in forms */
  dateOfBirth?: string
}

export interface ProfileState {
  autoFillData: AutoFillData
  smartFillsRemaining: number
}
