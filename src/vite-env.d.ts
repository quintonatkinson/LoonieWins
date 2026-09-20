/// <reference types="vite/client" />

declare module 'canvas-confetti' {
  export default function confetti(options?: { particleCount?: number; spread?: number; origin?: { x?: number; y?: number } }): void
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_RSS2JSON_API_KEY?: string
  readonly VITE_OFFERWALL_PROVIDER?: string
  readonly VITE_ADGEM_APP_ID?: string
  /** @deprecated never use in client — postback key is an Edge Function secret */
  readonly VITE_ADGEM_API_KEY?: string
  readonly VITE_ADGEM_WALL_URL?: string
  readonly VITE_REVENUECAT_APPLE_API_KEY?: string
  readonly VITE_REVENUECAT_GOOGLE_API_KEY?: string
  readonly VITE_REVENUECAT_API_KEY?: string
  readonly VITE_IAP_ALLOW_STUB?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
