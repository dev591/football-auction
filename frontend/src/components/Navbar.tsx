import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
      style={{
        background: scrolled ? 'rgba(7,26,14,0.95)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(0,179,65,0.15)' : '1px solid transparent',
        boxShadow: scrolled ? '0 4px 30px rgba(0,0,0,0.3)' : 'none',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group" data-cursor>
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-lg transition-all duration-300 group-hover:scale-110"
            style={{ background: 'var(--pitch)', boxShadow: '0 0 20px rgba(0,179,65,0.4)' }}
          >
            ⚽
          </div>
          <div>
            <span
              className="font-headline text-2xl tracking-widest leading-none block"
              style={{ color: '#fff', fontFamily: 'Bebas Neue, sans-serif' }}
            >
              STRIKER
            </span>
            <span className="font-mono text-[8px] tracking-[0.3em] uppercase hidden sm:block"
              style={{ color: 'rgba(255,255,255,0.35)' }}>
              AUCTION PORTAL
            </span>
          </div>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-3">
          <Link
            to="/bidder"
            data-cursor
            className="btn btn-outline-white"
            style={{ padding: '8px 20px', fontSize: '0.8rem' }}
          >
            War Room
          </Link>
          <Link
            to="/controller"
            data-cursor
            className="btn btn-primary"
            style={{ padding: '8px 20px', fontSize: '0.8rem' }}
          >
            Control Center
          </Link>
        </div>
      </div>
    </nav>
  )
}
