import { Routes, Route } from 'react-router-dom'
import { UserEarnProvider } from './contexts/UserEarnContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Referrals from './pages/Referrals'
import Earn from './pages/Earn'
import Winners from './pages/Winners'
import PastContests from './pages/PastContests'
import Profile from './pages/Profile'
import SubmitContest from './pages/SubmitContest'
import ModerateContests from './pages/ModerateContests'

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
        <Route path="/submit" element={<SubmitContest />} />
        <Route path="/moderate" element={<ModerateContests />} />
      </Routes>
    </Layout>
    </UserEarnProvider>
  )
}

export default App
