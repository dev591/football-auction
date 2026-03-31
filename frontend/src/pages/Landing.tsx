import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { apiFetch } from '../utils/authFetch'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger)

export default function Landing() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'team' | 'controller' | 'watch'>('team')

  // Refs for animation
  const heroRef = useRef<HTMLDivElement>(null)
  const heroTextRef = useRef<HTMLHeadingElement>(null)
  const portalSectionRef = useRef<HTMLDivElement>(null)
  const portalCardsRef = useRef<HTMLDivElement>(null)

  // Controller login
  const [ctrlPass, setCtrlPass] = useState('')
  const [ctrlError, setCtrlError] = useState('')
  const [ctrlLoading, setCtrlLoading] = useState(false)

  // Team login
  const [teamId, setTeamId] = useState('')
  const [teamPass, setTeamPass] = useState('')
  const [teamError, setTeamError] = useState('')
  const [teamLoading, setTeamLoading] = useState(false)

  // Initialize Lenis Smooth Scrolling
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      wheelMultiplier: 1,
      touchMultiplier: 2,
    })

    function raf(time: number) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [])

  // GSAP Animations
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero text parallax
      gsap.to(heroTextRef.current, {
        yPercent: 50,
        opacity: 0,
        ease: "none",
        scrollTrigger: {
          trigger: heroRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true
        }
      })

      // Portal reveal
      gsap.fromTo(portalCardsRef.current, 
        { y: 100, opacity: 0, scale: 0.95 },
        {
          y: 0, opacity: 1, scale: 1,
          duration: 1.5,
          ease: "expo.out",
          scrollTrigger: {
            trigger: portalSectionRef.current,
            start: "top 80%",
          }
        }
      )
    })
    return () => ctx.revert()
  }, [])

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
    <div className="relative min-h-screen bg-[#020804] text-white selection:bg-[#00ff66] selection:text-black">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(0,255,102,0.1)_0%,_transparent_50%)]" />
        <div className="pitch-texture-dark absolute inset-0 opacity-40 mix-blend-overlay" />
        <div className="scan-line" />
      </div>

      <div className="noise-overlay" />

      {/* Visor Corners Fixed */}
      <div className="fixed inset-0 pointer-events-none z-50">
        <div className="visor-corner visor-tl" /><div className="visor-corner visor-tr" />
        <div className="visor-corner visor-bl" /><div className="visor-corner visor-br" />
      </div>

      {/* 1. HERO SECTION */}
      <div ref={heroRef} className="relative h-screen flex flex-col items-center justify-center overflow-hidden z-10">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="absolute inset-0 flex items-center justify-center opacity-10"
        >
          <div className="text-[40vw] leading-none font-bold text-[#00ff66] blur-[10px] select-none pointer-events-none font-headline">⚽</div>
        </motion.div>

        <div className="text-center relative z-20" ref={heroTextRef}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="flex items-center justify-center gap-4 mb-4"
          >
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl bg-[#00ff66] shadow-[0_0_50px_rgba(0,255,102,0.6)] animate-float text-black">
              ⚽
            </div>
            <h1 className="hero-headline text-transparent bg-clip-text bg-gradient-to-b from-white to-[#a3e6b7]">
              STRIKER
            </h1>
          </motion.div>
          <motion.p 
            initial={{ opacity: 0, letterSpacing: '0em' }}
            animate={{ opacity: 1, letterSpacing: '0.4em' }}
            transition={{ duration: 1.5, delay: 0.5 }}
            className="font-mono text-xs md:text-sm uppercase text-[#00ffcc]"
          >
            College Football Cyber-Auction Portal
          </motion.p>
        </div>

        {/* Scroll Indicator */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
          className="absolute bottom-12 flex flex-col items-center gap-2"
        >
          <p className="font-mono text-[9px] tracking-[0.2em] text-[rgba(255,255,255,0.4)] uppercase">Scroll to Engage</p>
          <div className="w-[1px] h-12 bg-gradient-to-b from-[#00ff66] to-transparent animate-pulse" />
        </motion.div>
      </div>

      {/* 2. INTRO/SPACER SECTION */}
      <div className="relative h-[50vh] flex items-center justify-center z-10">
        <div className="max-w-4xl px-6 text-center">
          <h2 className="hero-sub-headline text-[#fff] opacity-80 mb-6 font-headline tracking-widest">
            THE FUTURE OF <span className="text-[#00ff66]">TEAM BUILDING</span>
          </h2>
          <p className="font-mono text-sm leading-relaxed text-[#a3e6b7] opacity-60 max-w-2xl mx-auto">
            Welcome to the apex of athletic procurement. Establish your war room, analyze live statistics, and outmaneuver rival organizations in real-time.
          </p>
        </div>
      </div>

      {/* 3. LOGIN PORTALS SECTION */}
      <div ref={portalSectionRef} className="relative min-h-[80vh] flex flex-col items-center justify-center py-20 z-20">
        
        <div ref={portalCardsRef} className="w-full max-w-md relative p-[1px] rounded-bl-3xl rounded-tr-3xl overflow-hidden group">
          
          {/* Animated gradient border */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#00ff66] via-transparent to-[#00ffcc] opacity-50 group-hover:opacity-100 transition-opacity duration-700" />
          
          <div className="relative bg-[#010302]/90 backdrop-blur-2xl rounded-bl-3xl rounded-tr-3xl h-full shadow-[0_0_80px_rgba(0,0,0,0.8)] border border-[rgba(0,255,102,0.1)]">
            
            {/* Tabs */}
            <div className="flex border-b border-[rgba(0,255,102,0.15)]">
              {(['team', 'controller', 'watch'] as const).map(t => (
                <button 
                  key={t} 
                  onClick={() => { setTab(t); setCtrlError(''); setTeamError('') }}
                  className={`flex-1 py-5 font-mono text-[10px] tracking-[0.3em] uppercase transition-all duration-300 relative overflow-hidden
                    ${tab === t ? 'text-[#00ff66]' : 'text-[rgba(255,255,255,0.3)] hover:text-[#00ffcc] hover:bg-[rgba(0,255,102,0.02)]'}`}
                >
                  {tab === t && (
                    <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#00ff66] shadow-[0_0_15px_#00ff66]" />
                  )}
                  {t === 'team' ? '🛡️ Team' : t === 'controller' ? '🔑 Admin' : '👁️ Watch'}
                </button>
              ))}
            </div>

            <div className="p-8">
              <AnimatePresence mode="wait">

                {/* TEAM LOGIN */}
                {tab === 'team' && (
                  <motion.div key="team"
                    initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.3 }}
                  >
                    <div className="text-center mb-8">
                      <h2 className="font-headline text-3xl tracking-widest text-[#00ff66] mb-1">War Room Access</h2>
                      <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[rgba(255,255,255,0.4)]">
                        Initialize secure connection
                      </p>
                    </div>
                    <form onSubmit={handleTeamLogin} className="space-y-6">
                      <div className="relative group">
                        <label className="font-mono text-[9px] tracking-widest uppercase block mb-2 text-[#a3e6b7]">Organization ID</label>
                        <input
                          type="text" placeholder="TMA3K9"
                          className="w-full bg-[rgba(255,255,255,0.03)] border-b border-[rgba(0,255,102,0.3)] focus:border-[#00ff66] text-white font-mono text-sm px-4 py-3 outline-none uppercase transition-colors"
                          style={{ letterSpacing: '0.2em' }}
                          value={teamId}
                          onChange={e => setTeamId(e.target.value.toUpperCase())}
                        />
                      </div>
                      <div className="relative group">
                        <label className="font-mono text-[9px] tracking-widest uppercase block mb-2 text-[#a3e6b7]">Security Passcode</label>
                        <input
                          type="password" placeholder="••••••"
                          className="w-full bg-[rgba(255,255,255,0.03)] border-b border-[rgba(0,255,102,0.3)] focus:border-[#00ff66] text-white font-mono text-sm px-4 py-3 outline-none transition-colors"
                          value={teamPass}
                          onChange={e => setTeamPass(e.target.value)}
                        />
                      </div>
                      {teamError && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-mono text-[10px] text-center py-2 px-3 bg-[#ff3366]/10 border border-[#ff3366]/30 text-[#ff3366]">
                          {teamError}
                        </motion.div>
                      )}
                      <button type="submit" disabled={teamLoading}
                        className="btn btn-primary w-full mt-4 h-14 uppercase tracking-widest text-black bg-[#00ff66] hover:bg-white transition-all duration-300 font-bold hover:shadow-[0_0_30px_#00ff66]"
                      >
                        {teamLoading ? 'Establishing Uplink...' : 'Breach Mainframe'}
                      </button>
                    </form>
                  </motion.div>
                )}

                {/* CONTROLLER LOGIN */}
                {tab === 'controller' && (
                  <motion.div key="controller"
                    initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.3 }}
                  >
                    <div className="text-center mb-8">
                      <h2 className="font-headline text-3xl tracking-widest text-[#00ffcc] mb-1">Mission Control</h2>
                      <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[rgba(255,255,255,0.4)]">
                        Restricted authority access
                      </p>
                    </div>
                    <form onSubmit={handleControllerLogin} className="space-y-6">
                      <div className="relative group">
                        <label className="font-mono text-[9px] tracking-widest uppercase block mb-2 text-[#00ffcc]">System Override Key</label>
                        <input
                          type="password" placeholder="••••••••"
                          className="w-full bg-[rgba(255,255,255,0.03)] border-b border-[rgba(0,255,204,0.3)] focus:border-[#00ffcc] text-white font-mono text-sm px-4 py-3 outline-none transition-colors"
                          value={ctrlPass}
                          onChange={e => setCtrlPass(e.target.value)}
                        />
                      </div>
                      {ctrlError && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-mono text-[10px] text-center py-2 px-3 bg-[#ff3366]/10 border border-[#ff3366]/30 text-[#ff3366]">
                          {ctrlError}
                        </motion.div>
                      )}
                      <button type="submit" disabled={ctrlLoading}
                        className="btn w-full mt-4 h-14 uppercase tracking-widest text-black bg-[#00ffcc] hover:bg-white transition-all duration-300 font-bold hover:shadow-[0_0_30px_#00ffcc]"
                      >
                        {ctrlLoading ? 'Authenticating...' : 'Engage System'}
                      </button>
                    </form>
                  </motion.div>
                )}

                {/* WATCH TAB */}
                {tab === 'watch' && (
                  <motion.div key="watch"
                    initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.3 }}
                  >
                    <div className="text-center mb-8">
                      <h2 className="font-headline text-3xl tracking-widest text-white mb-1">Live Feed</h2>
                      <p className="font-mono text-[9px] tracking-[0.2em] uppercase mt-1 text-[rgba(255,255,255,0.4)]">
                        Public Spectator Mode
                      </p>
                    </div>
                    <div className="text-center py-8 px-4 mb-6 border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.02)] rounded-2xl">
                      <div className="text-5xl mb-4 animate-pulse">👁️</div>
                      <p className="font-mono text-[10px] tracking-widest uppercase text-[rgba(255,255,255,0.5)]">
                        Monitor the auction telemetry in real-time. No clearance required.
                      </p>
                    </div>
                    <button
                      onClick={() => navigate('/watch')}
                      className="btn w-full h-14 uppercase tracking-widest text-white border border-white hover:bg-white hover:text-black transition-all duration-300 font-bold"
                    >
                      Initialize Viewport
                    </button>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pb-10 pt-20 flex justify-center z-20 relative">
        <p className="font-mono text-[9px] tracking-[0.3em] text-[rgba(255,255,255,0.2)] uppercase">
          STRIKER Cyber-Sports Portal © 2026
        </p>
      </div>
      
    </div>
  )
}
