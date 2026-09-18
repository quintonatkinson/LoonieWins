import { Routes, Route } from 'react-router-dom'
import { UserEarnProvider } from './contexts/UserEarnContext'
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

function App() {
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
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/support" element={<Support />} />
        <Route path="/delete-account" element={<DeleteAccount />} />
      </Routes>
    </Layout>
    </UserEarnProvider>
  )
}

export default App
