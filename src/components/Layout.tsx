import { NavLink } from 'react-router-dom'
import { Coins, History, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const ROUTES = [
  { path: '/', label: 'Home', icon: '🏠' },
  { path: '/referrals', label: 'Referrals', icon: '🔗' },
  { path: '/earn', label: 'Earn', icon: 'earn' as const },
  { path: '/winners', label: 'Winners', icon: '🏆' },
  { path: '/past', label: 'Past', icon: 'past' as const },
  { path: '/profile', label: 'Profile', icon: '👤' },
] as const

export default function Layout({ children }: { children?: React.ReactNode }) {
  const { profile, signOut, session } = useAuth()
  const displayName = profile?.display_name || profile?.email?.split('@')[0] || 'Contester'
  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good Morning'
    if (h < 17) return 'Good Afternoon'
    return 'Good Evening'
  })()

  return (
    <div className={`min-h-screen flex flex-col bg-gray-900 ${session ? 'pb-20' : ''}`}>
      <header className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between bg-gray-900/95 border-b border-gray-700/50">
        <div>
          {session ? (
            <>
              <h1 className="text-xl font-bold text-gray-50">
                {greeting}, <span className="text-win font-bold"> {displayName}</span>
              </h1>
              <p className="text-sm text-gray-400 flex items-center gap-1 mt-0.5">
                Win More, Work Less
                <span className="text-base" aria-hidden>
                  🍁
                </span>
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-win">LoonieWins</h1>
              <p className="text-sm text-gray-400 mt-0.5">Win More, Work Less</p>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {session && (
            <>
              <span className="flex items-center gap-1 text-sm text-gray-300" title="Streak">
                🔥 <span>{profile?.streak ?? 0}</span>
              </span>
              <span className="flex items-center gap-1 text-sm text-gray-300">
                🏆 <span>Lv.{profile?.level ?? 1}</span>{' '}
                <span className="text-gray-50">{profile?.xp ?? 0} XP</span>
              </span>
              <button
                type="button"
                onClick={() => void signOut()}
                className="p-2 rounded-lg text-gray-400 hover:text-win hover:bg-gray-800"
                title="Log out"
                aria-label="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {session && (
      <nav
        className="fixed bottom-0 left-0 right-0 bg-surface border-t border-gray-600/50 px-2 py-2 flex justify-around items-center"
        aria-label="Main navigation"
      >
        {ROUTES.map(({ path, label, icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg text-xs transition-colors ${
                isActive ? 'text-win bg-gray-700/50' : 'text-gray-400 hover:text-gray-50'
              }`
            }
          >
            {path === '/earn' ? (
              <Coins className="w-5 h-5 shrink-0" aria-hidden />
            ) : path === '/past' ? (
              <History className="w-5 h-5 shrink-0" aria-hidden />
            ) : (
              <span className="text-lg">{icon}</span>
            )}
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      )}
    </div>
  )
}
