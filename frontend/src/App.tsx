import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import Controller from './pages/Controller'
import Bidder from './pages/Bidder'
import Cursor from './components/Cursor'
import ScrollIcon from './components/ScrollIcon'

// Decode JWT payload without a library
function getTokenRole(): string | null {
  try {
    const token = localStorage.getItem('striker_token')
    if (!token) return null
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.role || null
  } catch {
    return null
  }
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const role = getTokenRole()
  if (role !== 'admin') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Cursor />
      <ScrollIcon />
      <div className="noise-overlay" aria-hidden />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/controller" element={
          <AdminRoute>
            <Controller />
          </AdminRoute>
        } />
        <Route path="/bidder" element={<Bidder />} />
        <Route path="/watch" element={<Bidder />} />
      </Routes>
    </BrowserRouter>
  )
}
