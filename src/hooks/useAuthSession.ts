import { useCallback, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, requireSupabase } from '../lib/supabase'

/**
 * Lightweight session hook for pages that need auth without the full AuthProvider
 * (works on main before / alongside the full-migration AuthContext).
 */
export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    const client = requireSupabase()
    let mounted = true
    ;(async () => {
      const { data } = await client.auth.getSession()
      if (!mounted) return
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    })()
    const { data: sub } = client.auth.onAuthStateChange((_e, next) => {
      setSession(next)
      setUser(next?.user ?? null)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return { error: 'Supabase is not configured' }
    }
    const { error } = await requireSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    return { error: error?.message ?? null }
  }, [])

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return
    await requireSupabase().auth.signOut()
  }, [])

  return { session, user, loading, signIn, signOut }
}
