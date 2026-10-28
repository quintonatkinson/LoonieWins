import { useEffect, useId, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Coins,
  Trophy,
  LogOut,
  Home,
  User,
  History,
  Award,
  Package,
  PlusCircle,
  Link2,
  X,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'

const PRIMARY_ROUTES = [
  { path: '/', label: 'Home', kind: 'home' as const },
  { path: '/my-giveaways', label: 'Mine', kind: 'mine' as const },
  { path: '/earn', label: 'Earn', kind: 'earn' as const },
] as const

const HISTORY_DESTINATIONS = [
  {
    path: '/winners',
    label: 'Winners',
    hint: 'Community wins — you could be next',
    icon: Award,
  },
  {
    path: '/past',
    label: 'Past contests',
    hint: 'FOMO vault — expired Hive Mind drops',
    icon: Package,
  },
  {
    path: '/inbox-shield',
    label: 'Inbox Shield',
    hint: 'Wins & promos sorted — Gmail sync soon',
    icon: ShieldCheck,
  },
] as const

const MORE_DESTINATIONS = [
  {
    path: '/submit',
    label: 'Submit a contest',
    hint: 'Moderated — approved items join the feed',
    icon: PlusCircle,
  },
  {
    path: '/referrals',
    label: 'Referrals',
    hint: 'Invite codes & friend link credits',
    icon: Link2,
  },
] as const

function NavIcon({ kind }: { kind: 'home' | 'mine' | 'earn' | 'history' | 'profile' }) {
  const cls = 'w-5 h-5 shrink-0'
  switch (kind) {
    case 'home':
      return <Home className={cls} aria-hidden strokeWidth={2.25} />
    case 'mine':
      return <Trophy className={cls} aria-hidden strokeWidth={2.25} />
    case 'earn':
      return <Coins className={cls} aria-hidden strokeWidth={2.25} />
    case 'history':
      return <History className={cls} aria-hidden strokeWidth={2.25} />
    case 'profile':
      return <User className={cls} aria-hidden strokeWidth={2.25} />
  }
}

export default function Layout({ children }: { children?: React.ReactNode }) {
  const { profile, signOut, session } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const sheetTitleId = useId()
  const [historyOpen, setHistoryOpen] = useState(false)

  // Guest demo (no Supabase) still needs bottom nav + profile access
  const showAppChrome = Boolean(session) || !isSupabaseConfigured || Boolean(profile)
  const displayName = profile?.display_name || profile?.email?.split('@')[0] || 'Contester'
  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good Morning'
    if (h < 17) return 'Good Afternoon'
    return 'Good Evening'
  })()

  const onHistoryRoute =
    location.pathname === '/winners' ||
    location.pathname === '/past' ||
    location.pathname === '/inbox-shield'
  const onMoreRoute =
    location.pathname === '/submit' || location.pathname === '/referrals'

  // Close sheet on route change
  useEffect(() => {
    setHistoryOpen(false)
  }, [location.pathname])

  // Escape closes sheet
  useEffect(() => {
    if (!historyOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHistoryOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [historyOpen])

  const go = (path: string) => {
    setHistoryOpen(false)
    navigate(path)
  }

  const navBtnClass = (active: boolean) =>
    `touch-target flex flex-col items-center justify-center gap-0.5 py-1 px-1 min-w-0 flex-1 max-w-[5.5rem] rounded-lg text-[11px] font-medium transition-colors ${
      active ? 'text-win bg-gray-700/50' : 'text-gray-400 hover:text-gray-50'
    }`

  return (
    <div
      className={`min-h-[100dvh] flex flex-col bg-gray-900 overflow-x-hidden ${
        showAppChrome ? 'pb-[calc(5rem+var(--app-safe-bottom))]' : ''
      }`}
    >
      <header className="sticky top-0 z-30 bg-gray-900/95 border-b border-gray-700/50 backdrop-blur-md pt-[var(--app-safe-top)]">
        <div className="mx-auto w-full max-w-3xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {showAppChrome ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-win/90">
                LoonieWins
              </p>
              <h1 className="text-lg sm:text-xl font-bold text-gray-50 truncate">
                {greeting}, <span className="text-win">{displayName}</span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-400 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
                Win More, Work Less
                <span className="text-sm" aria-hidden>
                  🍁
                </span>
                {!session && !isSupabaseConfigured && (
                  <span className="text-[10px] uppercase tracking-wide text-amber-400/90">
                    Guest
                  </span>
                )}
              </p>
              <p className="text-[11px] text-gray-500 mt-1 leading-snug max-w-md" data-testid="web-first-tagline">
                Use LoonieWins in your browser — phone or desktop. Add to Home Screen for an app-like
                shortcut; no app store required.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-win">LoonieWins</h1>
              <p className="text-sm text-gray-400 mt-0.5">Win More, Work Less</p>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {showAppChrome && (
            <>
              <span
                className="flex items-center gap-1 text-xs sm:text-sm text-gray-300"
                title="Streak"
              >
                🔥 <span>{profile?.streak ?? 0}</span>
              </span>
              <span className="flex items-center gap-1 text-xs sm:text-sm text-gray-300 tabular-nums">
                🏆 <span>Lv.{profile?.level ?? 1}</span>{' '}
                <span className="text-gray-50 hidden sm:inline">{profile?.xp ?? 0} XP</span>
              </span>
              {session && (
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="touch-target p-2 rounded-lg text-gray-400 hover:text-win hover:bg-gray-800 inline-flex items-center justify-center"
                  title="Log out"
                  aria-label="Log out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
        </div>
      </header>

      <main className="flex-1 w-full">{children}</main>

      {showAppChrome && (
        <>
          <nav
            className="fixed bottom-0 left-0 right-0 z-40 bg-surface/95 border-t border-gray-600/50 px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex justify-around items-stretch backdrop-blur-md"
            aria-label="Main navigation"
          >
            {PRIMARY_ROUTES.map(({ path, label, kind }) => (
              <NavLink
                key={path}
                to={path}
                end={path === '/'}
                className={({ isActive }) => navBtnClass(isActive)}
              >
                <NavIcon kind={kind} />
                <span className="truncate w-full text-center">{label}</span>
              </NavLink>
            ))}

            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className={navBtnClass(onHistoryRoute || onMoreRoute || historyOpen)}
              aria-expanded={historyOpen}
              aria-controls="history-sheet"
              aria-haspopup="dialog"
            >
              <NavIcon kind="history" />
              <span className="truncate w-full text-center">History</span>
            </button>

            <NavLink
              to="/profile"
              className={({ isActive }) => navBtnClass(isActive)}
            >
              <NavIcon kind="profile" />
              <span className="truncate w-full text-center">Profile</span>
            </NavLink>
          </nav>

          {historyOpen && (
            <>
              <div
                className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] animate-fade-in"
                onClick={() => setHistoryOpen(false)}
                aria-hidden
              />
              <div
                id="history-sheet"
                role="dialog"
                aria-modal
                aria-labelledby={sheetTitleId}
                className="fixed bottom-0 left-0 right-0 z-50 w-full sm:max-w-lg sm:mx-auto rounded-t-2xl sm:rounded-t-2xl border border-gray-600/50 bg-gray-900 shadow-2xl animate-sheet-up pb-[max(1rem,env(safe-area-inset-bottom))]"
              >
                <div className="flex justify-center pt-2 pb-1">
                  <span className="h-1 w-10 rounded-full bg-gray-600" aria-hidden />
                </div>
                <div className="flex items-start justify-between gap-3 px-4 pb-2">
                  <div>
                    <h2 id={sheetTitleId} className="text-base font-semibold text-white">
                      History &amp; more
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Everything stays reachable — nothing removed from the app.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHistoryOpen(false)}
                    className="touch-target p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 inline-flex items-center justify-center shrink-0"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="px-3 pb-2">
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-win/90 mb-1.5">
                    History
                  </p>
                  <ul className="rounded-xl border border-gray-600/50 overflow-hidden divide-y divide-gray-600/40 bg-gray-800/60">
                    {HISTORY_DESTINATIONS.map(({ path, label, hint, icon: Icon }) => {
                      const active = location.pathname === path
                      return (
                        <li key={path}>
                          <button
                            type="button"
                            onClick={() => go(path)}
                            className={`flex items-center gap-3 w-full text-left px-4 py-3.5 transition-colors ${
                              active ? 'bg-win/10' : 'hover:bg-white/5'
                            }`}
                          >
                            <span
                              className={`flex items-center justify-center w-9 h-9 rounded-full border shrink-0 ${
                                active
                                  ? 'bg-win/20 border-win/40 text-win'
                                  : 'bg-gray-900/80 border-gray-600/50 text-gray-300'
                              }`}
                            >
                              <Icon className="w-4 h-4" strokeWidth={2.25} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span
                                className={`block text-sm font-medium ${
                                  active ? 'text-win' : 'text-white'
                                }`}
                              >
                                {label}
                              </span>
                              <span className="block text-xs text-gray-500 mt-0.5">{hint}</span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>

                  <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500 mt-4 mb-1.5">
                    Community
                  </p>
                  <ul className="rounded-xl border border-gray-600/50 overflow-hidden divide-y divide-gray-600/40 bg-gray-800/60">
                    {MORE_DESTINATIONS.map(({ path, label, hint, icon: Icon }) => {
                      const active = location.pathname === path
                      return (
                        <li key={path}>
                          <button
                            type="button"
                            onClick={() => go(path)}
                            className={`flex items-center gap-3 w-full text-left px-4 py-3.5 transition-colors ${
                              active ? 'bg-win/10' : 'hover:bg-white/5'
                            }`}
                          >
                            <span
                              className={`flex items-center justify-center w-9 h-9 rounded-full border shrink-0 ${
                                active
                                  ? 'bg-win/20 border-win/40 text-win'
                                  : 'bg-gray-900/80 border-gray-600/50 text-gray-300'
                              }`}
                            >
                              <Icon className="w-4 h-4" strokeWidth={2.25} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span
                                className={`block text-sm font-medium ${
                                  active ? 'text-win' : 'text-white'
                                }`}
                              >
                                {label}
                              </span>
                              <span className="block text-xs text-gray-500 mt-0.5">{hint}</span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
