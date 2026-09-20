import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import {
  ACCENT_STORAGE_KEY,
  ACCENT_THEMES,
  DEFAULT_ACCENT_ID,
  applyAccentVars,
  getAccentTheme,
  isAccentId,
  type AccentId,
  type AccentTheme,
} from '../lib/themes'

interface ThemeContextValue {
  accentId: AccentId
  theme: AccentTheme
  themes: AccentTheme[]
  setAccentId: (id: AccentId) => void
  ready: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readLocalAccent(): AccentId {
  try {
    const raw = localStorage.getItem(ACCENT_STORAGE_KEY)
    if (isAccentId(raw)) return raw
  } catch {
    /* ignore */
  }
  return DEFAULT_ACCENT_ID
}

function writeLocalAccent(id: AccentId): void {
  try {
    localStorage.setItem(ACCENT_STORAGE_KEY, id)
  } catch {
    /* ignore */
  }
}

async function readRemoteAccent(): Promise<AccentId | null> {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData.session?.user?.id
    if (!userId) return null
    const { data, error } = await supabase
      .from('profiles')
      .select('settings')
      .eq('id', userId)
      .maybeSingle()
    if (error || !data) return null
    const settings = (data.settings ?? {}) as Record<string, unknown>
    return isAccentId(settings.accentTheme) ? settings.accentTheme : null
  } catch {
    return null
  }
}

async function writeRemoteAccent(id: AccentId): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData.session?.user?.id
    if (!userId) return
    const { data } = await supabase
      .from('profiles')
      .select('settings')
      .eq('id', userId)
      .maybeSingle()
    const prev = (data?.settings ?? {}) as Record<string, unknown>
    const settings = { ...prev, accentTheme: id }
    await supabase.from('profiles').update({ settings }).eq('id', userId)
  } catch {
    /* offline / no auth — localStorage remains source of truth */
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [accentId, setAccentIdState] = useState<AccentId>(() => readLocalAccent())
  const [ready, setReady] = useState(false)
  const theme = getAccentTheme(accentId)

  useEffect(() => {
    applyAccentVars(document.documentElement, theme)
  }, [theme])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const remote = await readRemoteAccent()
      if (cancelled) return
      if (remote && remote !== accentId) {
        writeLocalAccent(remote)
        setAccentIdState(remote)
      }
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
    // Intentionally once on mount — local default already applied
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setAccentId = useCallback((id: AccentId) => {
    setAccentIdState(id)
    writeLocalAccent(id)
    void writeRemoteAccent(id)
  }, [])

  return (
    <ThemeContext.Provider
      value={{ accentId, theme, themes: ACCENT_THEMES, setAccentId, ready }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
