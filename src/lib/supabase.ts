import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env')
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/** Schema-scoped clients for PostgREST (expose tracking + giveaways in API settings). */
export const tracking = () => supabase.schema('tracking')
export const giveaways = () => supabase.schema('giveaways')
