import { Routes, Route } from 'react-router-dom'
import { UserEarnProvider } from './contexts/UserEarnContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Referrals from './pages/Referrals'
import Earn from './pages/Earn'
import Winners from './pages/Winners'
import Profile from './pages/Profile'

function App() {
  return (
    <UserEarnProvider>
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/referrals" element={<Referrals />} />
        <Route path="/earn" element={<Earn />} />
        <Route path="/winners" element={<Winners />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </Layout>
    </UserEarnProvider>
  )
}

export default App
