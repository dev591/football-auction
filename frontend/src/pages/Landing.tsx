import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

import { apiFetch } from '../utils/authFetch'

export default function Landing() {
  const navigate   = useNavigate()
  const [tab, setTab] = useState<'controller' | 'team'>('team')

  // Controller login
  const [ctrlPass,  setCtrlPass]  = useState('')
  const [ctrlError, setCtrlError] = useState('')
  const [ctrlLoading, setCtrlLoading] = useState(false)

  // Team login
  const [teamId,    setTeamId]    = useState('')
  const [teamPass,  setTeamPass]  = useState('')
  const [teamError, setTeamError] = useState('')
  const [teamLoading, setTeamLoading] = useState(false)

  const handleControllerLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setCtrlError(''); setCtrlLoading(true)
    try {
      const resp = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: ctrlPass }),
      })
      if (!resp.ok) { setCtrlError('Invalid password'); return }
      const data = await resp.json()
      localStorage.setItem('striker_token', data.token)
      navigate('/controller')
    } catch { setCtrlError('Connection error') }
    finally { setCtrlLoading(false) }
  }

  const handleTeamLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setTeamError(''); setTeamLoading(true)
    try {
      const resp = await apiFetch('/api/teams/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamIdCode: teamId.trim(), password: teamPass }),
      })
      const data = await resp.json()
      if (!resp.ok) { setTeamError(data.error || 'Login failed'); return }
      localStorage.setItem('striker_token', data.token)
      localStorage.setItem('striker_team', JSON.stringify(data.team))
      navigate('/bidder')
    } catch { setTeamError('Connection error') }
    finally { setTeamLoading(false) }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 pitch-texture-dark"
      style={{ background: 'var(--bg-pitch)' }}>

      {/* Visor corners */}
      <div className="fixed inset-0 pointer-events-none z-10">
        <div className="visor-corner visor-tl" /><div className="visor-corner visor-tr" />
        <div className="visor-corner visor-bl" /><div className="visor-corner visor-br" />
        <div className="scan-line" />
      </div>

      {/* Pitch lines background */}
      <div className="fixed inset-0 flex items-center justify-center opacity-[0.05] pointer-events-none">
        <svg viewBox="0 0 900 600" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
          <rect x="60" y="40" width="780" height="520" fill="none" stroke="#00ff87" strokeWidth="2"/>
          <line x1="450" y1="40" x2="450" y2="560" stroke="#00ff87" strokeWidth="1.5"/>
          <circle cx="450" cy="300" r="80" fill="none" stroke="#00ff87" strokeWidth="1.5"/>
          <circle cx="450" cy="300" r="4" fill="#00ff87"/>
          <rect x="60" y="170" width="130" height="260" fill="none" stroke="#00ff87" strokeWidth="1.5"/>
          <rect x="710" y="170" width="130" height="260" fill="none" stroke="#00ff87" strokeWidth="1.5"/>
        </svg>
      </div>

      <div className="noise-overlay" />

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-10 relative z-20"
      >
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
            style={{ background: 'var(--pitch)', boxShadow: '0 0 30px rgba(0,179,65,0.4)' }}>
            ⚽
          </div>
          <h1 className="font-headline text-5xl tracking-widest text-white"
            style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            STRIKER
          </h1>
        </div>
        <p className="font-mono text-[10px] tracking-[0.4em] uppercase"
          style={{ color: 'rgba(255,255,255,0.3)' }}>
          College Football Auction Portal
        </p>
      </motion.div>

      {/* Login card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="w-full max-w-md relative z-20"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,255,135,0.12)' }}
      >
        {/* Tab switcher */}
        <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {(['team', 'controller'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setCtrlError(''); setTeamError('') }}
              className="flex-1 py-4 font-mono text-[10px] tracking-[0.25em] uppercase transition-all"
              style={{
                background: tab === t ? 'rgba(0,179,65,0.1)' : 'transparent',
                color: tab === t ? 'var(--electric)' : 'rgba(255,255,255,0.3)',
                borderBottom: tab === t ? '2px solid var(--electric)' : '2px solid transparent',
              }}>
              {t === 'team' ? '🛡️ Team Login' : '🔑 Controller'}
            </button>
          ))}
        </div>

        <div className="p-8">
          <AnimatePresence mode="wait">

            {/* TEAM LOGIN */}
            {tab === 'team' && (
              <motion.div key="team"
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}>
                <div className="text-center mb-7">
                  <h2 className="font-headline text-3xl tracking-widest text-white mb-1">War Room Access</h2>
                  <p className="font-mono text-[9px] tracking-widest uppercase"
                    style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Enter your team credentials
                  </p>
                </div>
                <form onSubmit={handleTeamLogin} className="space-y-4">
                  <div>
                    <label className="font-mono text-[9px] tracking-widest uppercase block mb-2"
                      style={{ color: 'rgba(255,255,255,0.3)' }}>Team ID</label>
                    <input
                      type="text" placeholder="e.g. TMA3K9"
                      className="input-dark uppercase"
                      style={{ letterSpacing: '0.2em' }}
                      value={teamId}
                      onChange={e => setTeamId(e.target.value.toUpperCase())}
                    />
                  </div>
                  <div>
                    <label className="font-mono text-[9px] tracking-widest uppercase block mb-2"
                      style={{ color: 'rgba(255,255,255,0.3)' }}>Password</label>
                    <input
                      type="password" placeholder="••••••"
                      className="input-dark"
                      value={teamPass}
                      onChange={e => setTeamPass(e.target.value)}
                    />
                  </div>
                  {teamError && (
                    <div className="font-mono text-[10px] text-center py-2 px-3"
                      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
                      {teamError}
                    </div>
                  )}
                  <button type="submit" disabled={teamLoading}
                    className="btn btn-primary w-full mt-2"
                    style={{ padding: '14px', fontSize: '1rem', opacity: teamLoading ? 0.7 : 1 }}>
                    {teamLoading ? 'Authorizing...' : 'Enter War Room'}
                  </button>
                </form>
              </motion.div>
            )}

            {/* CONTROLLER LOGIN */}
            {tab === 'controller' && (
              <motion.div key="controller"
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                <div className="text-center mb-7">
                  <h2 className="font-headline text-3xl tracking-widest text-white mb-1">Mission Control</h2>
                  <p className="font-mono text-[9px] tracking-widest uppercase"
                    style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Restricted admin access
                  </p>
                </div>
                <form onSubmit={handleControllerLogin} className="space-y-4">
                  <div>
                    <label className="font-mono text-[9px] tracking-widest uppercase block mb-2"
                      style={{ color: 'rgba(255,255,255,0.3)' }}>Authorization Key</label>
                    <input
                      type="password" placeholder="••••••••"
                      className="input-dark"
                      value={ctrlPass}
                      onChange={e => setCtrlPass(e.target.value)}
                    />
                  </div>
                  {ctrlError && (
                    <div className="font-mono text-[10px] text-center py-2 px-3"
                      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
                      {ctrlError}
                    </div>
                  )}
                  <button type="submit" disabled={ctrlLoading}
                    className="btn btn-primary w-full mt-2"
                    style={{ padding: '14px', fontSize: '1rem', opacity: ctrlLoading ? 0.7 : 1 }}>
                    {ctrlLoading ? 'Authenticating...' : 'Engage System'}
                  </button>
                </form>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-8 font-mono text-[9px] tracking-widest relative z-20"
        style={{ color: 'rgba(255,255,255,0.15)' }}
      >
        STRIKER · College Football Auction Portal · © 2025
      </motion.p>
    </div>
  )
}
