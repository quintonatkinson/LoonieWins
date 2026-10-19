/**
 * Accent theme tokens for LoonieWins (mobile).
 * Mirrors web `src/lib/themes.ts` — keep in sync.
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
  win: string
  winRgb: string
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
