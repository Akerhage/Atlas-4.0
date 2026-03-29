import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './views/LoginPage'
import Home from './views/Home'
import Inbox from './views/Inbox'
import MyTickets from './views/MyTickets'
import Archive from './views/Archive'
import Customers from './views/Customers'
import Templates from './views/Templates'
import Admin from './views/Admin'

export default function App() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/my-tickets" element={<MyTickets />} />
        <Route path="/archive" element={<Archive />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/admin/*" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
