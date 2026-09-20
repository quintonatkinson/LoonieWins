import { Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { UserEarnProvider } from './contexts/UserEarnContext'
import AuthScreen from './components/AuthScreen'
import { ThemeProvider } from './contexts/ThemeContext'
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
    <ThemeProvider>
    <UserEarnProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/referrals" element={<Referrals />} />
          <Route path="/earn" element={<Earn />} />
          <Route path="/winners" element={<Winners />} />
          <Route path="/past" element={<PastContests />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/support" element={<Support />} />
          <Route path="/delete-account" element={<DeleteAccount />} />
          <Route path="/submit" element={<SubmitContest />} />
          <Route path="/moderate" element={<ModerateContests />} />
        </Routes>
      </Layout>
    </UserEarnProvider>
    </ThemeProvider>
  )
}

function App() {
  const location = useLocation()
  const isPublicRoute = PUBLIC_PATHS.has(location.pathname)
  
  // Require auth unless on public pages OR Supabase not configured
  const requireAuth = isSupabaseConfigured() && !isPublicRoute

  return (
    <AuthProvider>
      {requireAuth ? (
        <AppWithAuth />
      ) : (
        <MainAppRoutes />
      )}
    </AuthProvider>
  )
}

function AppWithAuth() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        Loading...
      </div>
    )
  }

  if (!user) {
    return <AuthScreen />
  }

  return <MainAppRoutes />
}

export default App
