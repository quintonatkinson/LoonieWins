export interface AutoFillData {
  name?: string
  email?: string
  address?: string
  phone?: string
  city?: string
  province?: string
  postalCode?: string
}

export interface ProfileState {
  autoFillData: AutoFillData
  smartFillsRemaining: number
}
