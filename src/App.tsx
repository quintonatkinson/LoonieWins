import { Routes, Route } from 'react-router-dom'
import { UserEarnProvider } from './contexts/UserEarnContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Referrals from './pages/Referrals'
import Earn from './pages/Earn'
import Winners from './pages/Winners'
import PastContests from './pages/PastContests'
import Profile from './pages/Profile'

function App() {
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
      </Routes>
    </Layout>
    </UserEarnProvider>
    </ThemeProvider>
  )
}

export default App
