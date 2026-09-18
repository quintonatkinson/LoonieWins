import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

const isConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your-project') &&
    !supabaseUrl.includes('dummy.') &&
    supabaseAnonKey !== 'your-anon-key' &&
    supabaseAnonKey !== 'dummy-key' &&
    supabaseUrl.startsWith('http')
)

if (!isConfigured) {
  console.warn(
    '[Supabase] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY not set — running without cloud sync'
  )
}

/** Null when env is missing so the app still boots for local/demo use. */
export const supabase: SupabaseClient | null = isConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export const isSupabaseConfigured = isConfigured

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('Supabase is not configured')
  }
  return supabase
}

/** Schema-scoped clients for PostgREST (expose tracking + giveaways in API settings). */
export const tracking = () => requireSupabase().schema('tracking')
export const giveaways = () => requireSupabase().schema('giveaways')
