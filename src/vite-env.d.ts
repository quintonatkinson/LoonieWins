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
  readonly VITE_ADGEM_API_KEY?: string
  readonly VITE_ADGEM_WALL_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
