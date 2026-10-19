import { useEffect, useState } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { Coins, Trophy, LogOut, MoreHorizontal, PlusCircle, Link2, Award, Archive } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'

/** Primary bottom tabs — keep to 4 + More so labels stay readable on phones. */
const PRIMARY = [
  { path: '/', label: 'Home', kind: 'home' as const },
  { path: '/my-giveaways', label: 'Mine', kind: 'mine' as const },
  { path: '/earn', label: 'Earn', kind: 'earn' as const },
  { path: '/profile', label: 'Profile', kind: 'profile' as const },
] as const

const MORE_LINKS = [
  {
    path: '/submit',
    label: 'Submit a contest',
    hint: 'Suggest a giveaway for Hive Mind',
    icon: PlusCircle,
  },
  {
    path: '/referrals',
    label: 'Referrals',
    hint: 'Invite codes & click pool',
    icon: Link2,
  },
  {
    path: '/winners',
    label: 'Winners',
    hint: 'Community wins feed',
    icon: Award,
  },
  {
    path: '/past',
    label: 'Past (FOMO vault)',
    hint: 'Expired contests on this device',
    icon: Archive,
  },
] as const

const MORE_PATHS: ReadonlySet<string> = new Set(MORE_LINKS.map((l) => l.path))

export default function Layout({ children }: { children?: React.ReactNode }) {
  const { profile, signOut, session } = useAuth()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  // Guest demo (no Supabase) still needs bottom nav + profile access
  const showAppChrome = Boolean(session) || !isSupabaseConfigured || Boolean(profile)
  const displayName = profile?.display_name || profile?.email?.split('@')[0] || 'Contester'
  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  const moreActive = MORE_PATHS.has(location.pathname)

  useEffect(() => {
    setMoreOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!moreOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moreOpen])

  return (
    <div className={`min-h-screen flex flex-col bg-gray-900 ${showAppChrome ? 'pb-20' : ''}`}>
      <header className="sticky top-0 z-30 px-4 py-2.5 flex items-center justify-between gap-3 bg-gray-900/95 border-b border-gray-700/50">
        <div className="min-w-0">
          {showAppChrome ? (
            <>
              <p className="text-[11px] uppercase tracking-wide text-gray-500 truncate">
                {greeting}
                {!session && !isSupabaseConfigured && (
                  <span className="ml-2 text-amber-400/90 normal-case tracking-normal">· Guest</span>
                )}
              </p>
              <h1 className="text-lg font-bold text-gray-50 truncate leading-tight">
                <span className="text-win">LoonieWins</span>
                <span className="text-gray-500 font-medium"> · </span>
                <span className="text-gray-200 font-semibold">{displayName}</span>
              </h1>
            </>
          ) : (
            <>
              <h1 className="text-lg font-bold text-win">LoonieWins</h1>
              <p className="text-xs text-gray-400">Win More, Work Less</p>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {showAppChrome && (
            <>
              <span
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-800/80 border border-gray-600/40 text-xs text-gray-300"
                title="Streak"
              >
                <span aria-hidden>🔥</span>
                {profile?.streak ?? 0}
              </span>
              <span
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-800/80 border border-gray-600/40 text-xs text-gray-300"
                title="Level and XP"
              >
                <span aria-hidden>Lv</span>
                {profile?.level ?? 1}
                <span className="text-gray-500">·</span>
                <span className="text-win">{profile?.xp ?? 0}</span>
              </span>
              {session && (
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="p-2 rounded-lg text-gray-400 hover:text-win hover:bg-gray-800"
                  title="Log out"
                  aria-label="Log out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {showAppChrome && moreOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/55"
            aria-hidden
            onClick={() => setMoreOpen(false)}
          />
          <div
            className="fixed left-0 right-0 bottom-16 z-50 mx-2 mb-1 rounded-2xl border border-gray-600/50 bg-gray-900 shadow-xl overflow-hidden"
            role="dialog"
            aria-modal
            aria-label="More destinations"
            data-testid="nav-more-sheet"
          >
            <div className="px-4 pt-3 pb-2 border-b border-gray-700/50">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">More</p>
              <p className="text-sm text-gray-300 mt-0.5">Submit, referrals, winners, and past contests</p>
            </div>
            <ul className="divide-y divide-gray-700/40">
              {MORE_LINKS.map(({ path, label, hint, icon: Icon }) => (
                <li key={path}>
                  <Link
                    to={path}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors ${
                      location.pathname === path ? 'bg-win/10' : ''
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 shrink-0 ${
                        location.pathname === path ? 'text-win' : 'text-gray-400'
                      }`}
                    />
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          location.pathname === path ? 'text-win' : 'text-white'
                        }`}
                      >
                        {label}
                      </p>
                      <p className="text-xs text-gray-500">{hint}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {showAppChrome && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-30 bg-surface border-t border-gray-600/50 px-1 py-1.5 flex justify-around items-stretch gap-0.5"
          aria-label="Main navigation"
          data-testid="main-nav"
        >
          {PRIMARY.map(({ path, label, kind }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-lg text-[11px] font-medium transition-colors min-w-0 ${
                  isActive ? 'text-win bg-gray-700/50' : 'text-gray-400 hover:text-gray-50'
                }`
              }
              data-testid={`nav-${kind}`}
            >
              {kind === 'earn' ? (
                <Coins className="w-5 h-5 shrink-0" aria-hidden />
              ) : kind === 'mine' ? (
                <Trophy className="w-5 h-5 shrink-0" aria-hidden />
              ) : kind === 'home' ? (
                <span className="text-base leading-none" aria-hidden>
                  🏠
                </span>
              ) : (
                <span className="text-base leading-none" aria-hidden>
                  👤
                </span>
              )}
              <span className="truncate max-w-full">{label}</span>
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-lg text-[11px] font-medium transition-colors min-w-0 ${
              moreActive || moreOpen
                ? 'text-win bg-gray-700/50'
                : 'text-gray-400 hover:text-gray-50'
            }`}
            aria-expanded={moreOpen}
            aria-controls="nav-more-sheet"
            data-testid="nav-more"
          >
            <MoreHorizontal className="w-5 h-5 shrink-0" aria-hidden />
            <span>More</span>
          </button>
        </nav>
      )}
    </div>
  )
}
