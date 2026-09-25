import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { View } from 'react-native'
import { storage } from '../lib/utils/storage'
import { supabase } from '../lib/supabase'
import {
  ACCENT_STORAGE_KEY,
  ACCENT_THEMES,
  DEFAULT_ACCENT_ID,
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
  /** Hex for ActivityIndicator / RefreshControl / StyleSheet */
  accentColor: string
  onAccentColor: string
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

async function readLocalAccent(): Promise<AccentId> {
  try {
    const raw = await storage.getItem(ACCENT_STORAGE_KEY)
    if (isAccentId(raw)) return raw
  } catch {
    /* ignore */
  }
  return DEFAULT_ACCENT_ID
}

async function writeLocalAccent(id: AccentId): Promise<void> {
  await storage.setItem(ACCENT_STORAGE_KEY, id)
}

async function readRemoteAccent(): Promise<AccentId | null> {
  if (!supabase) return null
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
  if (!supabase) return
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
    /* offline / no auth */
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [accentId, setAccentIdState] = useState<AccentId>(DEFAULT_ACCENT_ID)
  const [ready, setReady] = useState(false)
  const theme = getAccentTheme(accentId)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const local = await readLocalAccent()
      if (cancelled) return
      setAccentIdState(local)
      const remote = await readRemoteAccent()
      if (cancelled) return
      if (remote && remote !== local) {
        await writeLocalAccent(remote)
        setAccentIdState(remote)
      }
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const setAccentId = useCallback((id: AccentId) => {
    setAccentIdState(id)
    void writeLocalAccent(id)
    void writeRemoteAccent(id)
  }, [])

  // NativeWind reads CSS vars from style when supported; also expose hex via context.
  const cssVarStyle: Record<string, string> = {
    '--color-win': theme.winRgb,
    '--accent-win': theme.win,
    '--color-on-win': theme.onWinRgb,
    '--on-win': theme.onWin,
  }

  return (
    <ThemeContext.Provider
      value={{
        accentId,
        theme,
        themes: ACCENT_THEMES,
        setAccentId,
        ready,
        accentColor: theme.win,
        onAccentColor: theme.onWin,
      }}
    >
      <View className="flex-1" style={cssVarStyle as object}>
        {children}
      </View>
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
