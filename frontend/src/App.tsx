import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Controller from './pages/Controller'
import Bidder from './pages/Bidder'
import Cursor from './components/Cursor'
import ScrollIcon from './components/ScrollIcon'

export default function App() {
  return (
    <BrowserRouter>
      <Cursor />
      <ScrollIcon />
      <div className="noise-overlay" aria-hidden />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/controller" element={<Controller />} />
        <Route path="/bidder" element={<Bidder />} />
      </Routes>
    </BrowserRouter>
  )
}
