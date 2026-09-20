import { Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { UserEarnProvider } from './contexts/UserEarnContext'
import AuthScreen from './components/AuthScreen'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Referrals from './pages/Referrals'
import Earn from './pages/Earn'
import Winners from './pages/Winners'
import PastContests from './pages/PastContests'
import Profile from './pages/Profile'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import Support from './pages/Support'
import DeleteAccount from './pages/DeleteAccount'
import SubmitContest from './pages/SubmitContest'
import ModerateContests from './pages/ModerateContests'
import { isSupabaseConfigured } from './lib/supabase'

const PUBLIC_PATHS = new Set(['/privacy', '/terms', '/support', '/delete-account'])

function MainAppRoutes() {
  return (
    <UserEarnProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/referrals" element={<Referrals />} />
          <Route path="/earn" element={<Earn />} />
          <Route path="/winners" element={<Winners />} />
          <Route path="/past" element={<PastContests />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/submit" element={<SubmitContest />} />
          <Route path="/moderate" element={<ModerateContests />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/support" element={<Support />} />
          <Route path="/delete-account" element={<DeleteAccount />} />
        </Routes>
      </Layout>
    </UserEarnProvider>
  )
}

function AuthenticatedApp() {
  const { session, loading, authReady } = useAuth()
  const location = useLocation()
  const isPublic = PUBLIC_PATHS.has(location.pathname)

  if (!authReady || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <p className="text-win font-semibold animate-pulse">Loading LoonieWins…</p>
      </div>
    )
  }

  // Store / compliance pages must work without login (Play external deletion URL).
  if (isPublic) {
    return (
      <Layout>
        <Routes>
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/support" element={<Support />} />
          <Route path="/delete-account" element={<DeleteAccount />} />
        </Routes>
      </Layout>
    )
  }

  // Local/demo boot without Supabase keys — keep feed usable with local entry tracking.
  if (!session && isSupabaseConfigured) {
    return <AuthScreen />
  }

  return <MainAppRoutes />
}

function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  )
}

export default App
