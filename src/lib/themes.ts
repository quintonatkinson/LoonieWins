/**
 * Accent theme tokens for LoonieWins.
 * Surfaces/buttons/highlights use Tailwind `win` → CSS vars so one pick recolors the app.
 * Default remains neon green for existing users.
 */

export const ACCENT_STORAGE_KEY = 'looniewins_accent_theme'
export const DEFAULT_ACCENT_ID = 'neon-green' as const

export type AccentId =
  | 'neon-green'
  | 'maple'
  | 'arctic'
  | 'amber'
  | 'teal'
  | 'indigo'

export interface AccentTheme {
  id: AccentId
  name: string
  /** Primary accent hex */
  win: string
  /** RGB channels for Tailwind opacity modifiers, e.g. "57 255 20" */
  winRgb: string
  /** Text/icon on solid accent buttons */
  onWin: string
  onWinRgb: string
}

export const ACCENT_THEMES: AccentTheme[] = [
  {
    id: 'neon-green',
    name: 'Neon Green',
    win: '#39FF14',
    winRgb: '57 255 20',
    onWin: '#111827',
    onWinRgb: '17 24 39',
  },
  {
    id: 'maple',
    name: 'Maple',
    win: '#F43F5E',
    winRgb: '244 63 94',
    onWin: '#111827',
    onWinRgb: '17 24 39',
  },
  {
    id: 'arctic',
    name: 'Arctic',
    win: '#38BDF8',
    winRgb: '56 189 248',
    onWin: '#0F172A',
    onWinRgb: '15 23 42',
  },
  {
    id: 'amber',
    name: 'Amber',
    win: '#FBBF24',
    winRgb: '251 191 36',
    onWin: '#111827',
    onWinRgb: '17 24 39',
  },
  {
    id: 'teal',
    name: 'Teal',
    win: '#2DD4BF',
    winRgb: '45 212 191',
    onWin: '#111827',
    onWinRgb: '17 24 39',
  },
  {
    id: 'indigo',
    name: 'Indigo',
    win: '#818CF8',
    winRgb: '129 140 248',
    onWin: '#111827',
    onWinRgb: '17 24 39',
  },
]

export function isAccentId(value: unknown): value is AccentId {
  return typeof value === 'string' && ACCENT_THEMES.some((t) => t.id === value)
}

export function getAccentTheme(id: string | null | undefined): AccentTheme {
  if (isAccentId(id)) {
    return ACCENT_THEMES.find((t) => t.id === id) ?? ACCENT_THEMES[0]
  }
  return ACCENT_THEMES[0]
}

/** Apply accent CSS variables on an element (usually <html>). */
export function applyAccentVars(
  el: HTMLElement | null | undefined,
  theme: AccentTheme
): void {
  if (!el) return
  el.dataset.accent = theme.id
  el.style.setProperty('--accent-win', theme.win)
  el.style.setProperty('--color-win', theme.winRgb)
  el.style.setProperty('--color-on-win', theme.onWinRgb)
  el.style.setProperty('--on-win', theme.onWin)
}
