import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '../components/Navbar'
import { apiFetch } from '../utils/authFetch'

export default function Bidder() {
  const [token,   setToken]   = useState(localStorage.getItem('striker_token') || '')
  const [teamObj, setTeamObj] = useState<any>(JSON.parse(localStorage.getItem('striker_team') || 'null'))
  const [teamId,    setTeamId]    = useState('')
  const [teamPass,  setTeamPass]  = useState('')

  const [auctionState, setAuctionState] = useState<any>(null)
  const [players,      setPlayers]      = useState<any[]>([])
  const [teams,        setTeams]        = useState<any[]>([])
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)
  const [soldData,     setSoldData]     = useState<any>(null)
  const [activeTab,    setActiveTab]    = useState<'live'|'squad'|'teams'>('live')

  useEffect(() => {
    if (!token) return
    let active = true
    const s = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001')
    s.emit('auction:request_state')
    if (teamObj) s.emit('auction:join', { teamId: teamObj.id || teamObj._id, teamName: teamObj.name })

    s.on('auction:state', (st) => { if (active) setAuctionState(st) })
    s.on('auction:bid', (bid) => {
      setAuctionState((prev: any) => {
        if (!prev) return prev
        return {
          ...prev,
          currentBid: bid.currentBid ?? bid.amount ?? prev.currentBid,
          auction: prev.auction ? { ...prev.auction, current_bid: bid.currentBid ?? bid.amount ?? prev.auction?.current_bid } : prev.auction,
        }
      })
    })
    s.on('auction:sold', (data) => { setSoldData(data); setTimeout(() => setSoldData(null), 4000) })
    s.on('auction:reset', () => setTimeout(() => window.location.reload(), 2000))

    const applyFullState = (fullState: any) => {
      if (!active || !fullState) return
      if (fullState.players) setPlayers(fullState.players)
      if (fullState.teams)   setTeams(fullState.teams)
      setAuctionState(fullState)
      if (teamObj && fullState.teams) {
        const updated = fullState.teams.find((t: any) => (t.id || t._id) === (teamObj.id || teamObj._id))
        if (updated) { setTeamObj(updated); localStorage.setItem('striker_team', JSON.stringify(updated)) }
      }
    }

    const fetchAll = () => {
      Promise.all([
        apiFetch('/api/players').then(r => r.json()),
        apiFetch('/api/teams').then(r => r.json()),
      ]).then(([pData, tData]) => {
        if (!active) return
        const pArray = Array.isArray(pData) ? pData : (pData.players || pData.data || [])
        const tArray = Array.isArray(tData) ? tData : (tData.teams || tData.data || [])
        setPlayers(pArray)
        setTeams(tArray)
        if (teamObj) {
          const updated = tArray.find((t: any) => (t.id || t._id) === (teamObj.id || teamObj._id))
          if (updated) { setTeamObj(updated); localStorage.setItem('striker_team', JSON.stringify(updated)) }
        }
      }).catch(console.error)
    }

    // Use fullState from socket payload directly — no extra REST call needed
    s.on('teams:updated',   (payload) => payload?.fullState ? applyFullState(payload.fullState) : fetchAll())
    s.on('players:updated', (payload) => payload?.fullState ? applyFullState(payload.fullState) : fetchAll())
    fetchAll()
    return () => { active = false; s.disconnect() }
  }, [token])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const resp = await apiFetch('/api/teams/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamIdCode: teamId.trim(), password: teamPass }),
      })
      if (!resp.ok) throw new Error('Login failed')
      const data = await resp.json()
      localStorage.setItem('striker_token', data.token)
      localStorage.setItem('striker_team', JSON.stringify(data.team))
      setToken(data.token); setTeamObj(data.team)
    } catch { alert('Login Failed') }
  }

  const handleLogout = () => {
    localStorage.removeItem('striker_token')
    localStorage.removeItem('striker_team')
    setToken(''); setTeamObj(null)
  }

  /* ── LOGIN SCREEN ── */
  if (!token || !teamObj) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 pitch-texture-dark"
        style={{ background: 'var(--bg-pitch)' }}>
        <div className="noise-overlay" />
        <Navbar />
        <div className="fixed inset-0 pointer-events-none z-10">
          <div className="visor-corner visor-tl" /><div className="visor-corner visor-tr" />
          <div className="visor-corner visor-bl" /><div className="visor-corner visor-br" />
          <div className="scan-line" />
        </div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm relative z-20"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,255,135,0.15)', padding: '48px 40px' }}>
          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center text-3xl"
              style={{ background: 'rgba(0,179,65,0.15)', border: '1px solid rgba(0,179,65,0.3)' }}>
              🛡️
            </div>
            <h2 className="font-headline text-4xl tracking-widest text-white mb-1">WAR ROOM</h2>
            <p className="font-mono text-[9px] tracking-[0.3em] uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Secure Team Login
            </p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="font-mono text-[9px] tracking-widest uppercase block mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Team ID</label>
              <input type="text" placeholder="e.g. TMA3K9" className="input-dark uppercase"
                style={{ letterSpacing: '0.2em' }}
                value={teamId} onChange={e => setTeamId(e.target.value.toUpperCase())} />
            </div>
            <div>
              <label className="font-mono text-[9px] tracking-widest uppercase block mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Password</label>
              <input type="password" placeholder="••••••••" className="input-dark"
                value={teamPass} onChange={e => setTeamPass(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary w-full mt-2" style={{ padding: '14px', fontSize: '1rem' }}>
              Authorize Access
            </button>
          </form>
        </motion.div>
      </div>
    )
  }

  const currentPlayer = auctionState?.currentPlayer
  const currentBid    = auctionState?.currentBid || currentPlayer?.base_price || 0
  const leadingTeam   = auctionState?.currentBidderTeam
  const currentStatus = auctionState?.auction?.status
  const myId          = teamObj?.id || teamObj?._id
  const mySquad       = myId ? players.filter(p => p.sold_to === myId && p.status === 'sold') : []

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-dark)' }}>
      <div className="noise-overlay" />
      <Navbar />

      {/* ── TOP BAR — Budget + Team ── */}
      <div className="pt-16" style={{ background: 'var(--bg-pitch)', borderBottom: '1px solid rgba(0,179,65,0.15)' }}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 flex items-center justify-center font-headline text-xl shrink-0"
              style={{ borderColor: 'var(--electric)', background: 'rgba(0,255,135,0.08)', color: 'var(--electric)' }}>
              {teamObj.logo_url ? <img src={teamObj.logo_url} alt="" className="w-full h-full object-cover" /> : '🛡️'}
            </div>
            <div>
              <div className="font-headline text-3xl text-white tracking-wide leading-none">{teamObj.name}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="live-dot" style={{ width: 6, height: 6 }} />
                <span className="font-mono text-[9px] tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  CONNECTED
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="text-center">
              <div className="font-mono text-[9px] tracking-widest uppercase mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Budget Remaining
              </div>
              <div className="font-headline text-3xl" style={{ color: 'var(--gold)' }}>
                ₹{((teamObj.budget_remaining || 0) / 10000000).toFixed(2)}Cr
              </div>
            </div>
            <div className="text-center">
              <div className="font-mono text-[9px] tracking-widest uppercase mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Squad
              </div>
              <div className="font-headline text-3xl text-white">{mySquad.length}</div>
            </div>
            <button onClick={handleLogout}
              className="font-mono text-[9px] tracking-widest uppercase py-2 px-4 transition-colors hidden md:block"
              style={{ color: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.08)' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}>
              Logout
            </button>
          </div>
        </div>

        {/* Mobile tabs */}
        <div className="flex lg:hidden border-t" style={{ borderColor: 'rgba(0,179,65,0.1)' }}>
          {(['live', 'squad', 'teams'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="flex-1 py-3 font-mono text-[10px] tracking-widest uppercase transition-all"
              style={{
                background: activeTab === tab ? 'rgba(0,179,65,0.15)' : 'transparent',
                color: activeTab === tab ? 'var(--electric)' : 'rgba(255,255,255,0.3)',
                borderBottom: activeTab === tab ? '2px solid var(--electric)' : '2px solid transparent',
              }}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6 h-full">

          {/* ── LEFT: LIVE AUCTION (always visible on desktop, tab on mobile) ── */}
          <div className={`flex-1 ${activeTab !== 'live' ? 'hidden lg:flex' : 'flex'} flex-col gap-5`}>

            {/* Current bid banner */}
            <div className="relative overflow-hidden"
              style={{ background: 'var(--bg-pitch)', border: '1px solid rgba(0,255,135,0.15)', padding: '24px 28px' }}>
              <div className="absolute top-0 inset-x-0 h-px"
                style={{ background: 'linear-gradient(90deg, transparent, var(--electric), transparent)' }} />
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {currentStatus === 'live' && <span className="live-dot" />}
                    <span className="label-dim">
                      {currentStatus === 'live' ? 'Live Auction' : currentStatus === 'reveal' ? 'Player Reveal' : 'Standby'}
                    </span>
                  </div>
                  <div className="bid-amount" style={{ fontSize: 'clamp(48px, 8vw, 80px)' }}>
                    {currentStatus === 'live' || currentStatus === 'reveal'
                      ? `₹${(currentBid / 100000).toFixed(1)}L`
                      : '—'
                    }
                  </div>
                </div>
                {leadingTeam && currentStatus === 'live' && (
                  <div className="text-right">
                    <div className="font-mono text-[9px] tracking-widest uppercase mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      Leading
                    </div>
                    <div className="font-headline text-3xl text-white">
                      {typeof leadingTeam === 'object' ? leadingTeam.name : leadingTeam}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Player card */}
            <div className="flex-1 relative overflow-hidden"
              style={{ background: 'var(--bg-pitch)', border: '1px solid rgba(255,255,255,0.06)', minHeight: 400 }}>
              <AnimatePresence mode="wait">

                {/* WAITING */}
                {(!currentStatus || currentStatus === 'waiting' || currentStatus === 'ready') && (
                  <motion.div key="waiting"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center text-center p-12">
                    <div className="pitch-texture-dark absolute inset-0" />
                    <div className="relative z-10">
                      <div className="text-6xl mb-6 animate-float">⚽</div>
                      <div className="font-headline text-4xl text-white mb-3 tracking-widest">
                        {currentStatus === 'ready' ? 'GET READY' : 'STAND BY'}
                      </div>
                      <p className="font-mono text-[10px] tracking-[0.3em] uppercase mb-6" style={{ color: 'rgba(255,255,255,0.25)' }}>
                        Waiting for controller to start the auction...
                      </p>
                      <div className="flex items-center justify-center gap-2">
                        <span className="live-dot" />
                        <span className="font-mono text-[9px] tracking-widest" style={{ color: 'var(--electric)' }}>
                          {(auctionState?.teams || []).filter((t: any) => t.in_lobby).length} / {(auctionState?.teams || []).length} teams in lobby
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* REVEAL */}
                {currentStatus === 'reveal' && currentPlayer && (
                  <motion.div key="reveal"
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 overflow-hidden">
                    <div className="absolute inset-0"
                      style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(0,179,65,0.15), transparent)' }} />
                    <motion.div
                      initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                      className="relative z-10">
                      <div className="font-mono text-[10px] tracking-[0.5em] uppercase mb-6 animate-pulse"
                        style={{ color: 'var(--electric)' }}>
                        Acquiring Target
                      </div>
                      <h2 className="font-headline text-white mb-4"
                        style={{ fontSize: 'clamp(56px, 10vw, 100px)', lineHeight: 0.9, letterSpacing: '0.03em' }}>
                        {currentPlayer.name}
                      </h2>
                      <div className="font-mono text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {currentPlayer.position} · {currentPlayer.college}
                      </div>
                      <div className="mt-6 font-headline text-3xl" style={{ color: 'var(--gold)' }}>
                        Base ₹{(currentPlayer.base_price / 100000).toFixed(1)}L
                      </div>
                    </motion.div>
                  </motion.div>
                )}

                {/* LIVE */}
                {currentStatus === 'live' && currentPlayer && (
                  <motion.div key="live"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col md:flex-row">

                    {/* Player photo + info */}
                    <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
                      <div className="absolute inset-0 pitch-texture-dark opacity-40" />
                      <div className="relative z-10 flex flex-col items-center text-center">
                        <div className="relative mb-6">
                          <div className="w-36 h-36 rounded-full overflow-hidden border-4 flex items-center justify-center font-headline text-5xl"
                            style={{ borderColor: 'var(--electric)', background: 'rgba(0,255,135,0.05)', color: 'var(--electric)',
                              boxShadow: '0 0 40px rgba(0,255,135,0.2)' }}>
                            {currentPlayer.image_url
                              ? <img src={currentPlayer.image_url} alt="" className="w-full h-full object-cover" />
                              : (currentPlayer.position || 'P')[0]
                            }
                          </div>
                          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                            <span className="pos-badge pos-DEF font-mono text-[9px]">
                              {currentPlayer.position?.substring(0, 3) || 'PLY'}
                            </span>
                          </div>
                        </div>
                        <h2 className="font-headline text-white mb-1"
                          style={{ fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 0.95, letterSpacing: '0.03em' }}>
                          {currentPlayer.name}
                        </h2>
                        <p className="font-mono text-[10px] mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          {currentPlayer.college}
                        </p>
                        <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
                          <div className="text-center p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div className="font-mono text-[8px] mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>BASE</div>
                            <div className="font-headline text-xl text-white">₹{(currentPlayer.base_price/100000).toFixed(1)}L</div>
                          </div>
                          <div className="text-center p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div className="font-mono text-[8px] mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>POSITION</div>
                            <div className="font-headline text-xl text-white">{currentPlayer.position?.substring(0,3)}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bid info panel */}
                    <div className="w-full md:w-72 flex flex-col p-6 gap-4"
                      style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)' }}>
                      {/* Current bid */}
                      <div className="p-5 relative overflow-hidden"
                        style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                        <div className="absolute top-0 inset-x-0 h-px"
                          style={{ background: 'linear-gradient(90deg, transparent, var(--gold), transparent)' }} />
                        <div className="font-mono text-[9px] tracking-widest uppercase mb-2" style={{ color: 'rgba(245,158,11,0.6)' }}>
                          Current Bid
                        </div>
                        <div className="bid-amount" style={{ fontSize: 'clamp(40px, 6vw, 56px)' }}>
                          ₹{(currentBid / 100000).toFixed(1)}L
                        </div>
                        <div className="mt-3 font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          {leadingTeam ? (
                            <span className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)]" />
                              {typeof leadingTeam === 'object' ? leadingTeam.name : leadingTeam}
                            </span>
                          ) : (
                            <span style={{ color: 'rgba(255,255,255,0.25)' }}>No bids yet</span>
                          )}
                        </div>
                      </div>

                      {/* View only indicator */}
                      <div className="flex items-center justify-center gap-2 py-3"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--gold)' }} />
                        <span className="font-mono text-[9px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          Bidding via Controller
                        </span>
                      </div>

                      {/* Bid history */}
                      <div className="flex-1 overflow-hidden flex flex-col"
                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <div className="label-dim">Bid Log</div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                          {auctionState?.history?.slice(0, 8).map((h: any, i: number) => (
                            <div key={i} className="flex justify-between items-center py-1.5"
                              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <span className="font-mono text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                {typeof h.team === 'object' && h.team ? h.team.name : h.teamName || `Team ${h.teamId}`}
                              </span>
                              <span className="font-mono text-[10px] font-bold" style={{ color: 'var(--gold)' }}>
                                ₹{(h.amount/100000).toFixed(1)}L
                              </span>
                            </div>
                          ))}
                          {(!auctionState?.history?.length) && (
                            <div className="py-6 text-center font-mono text-[9px]" style={{ color: 'rgba(255,255,255,0.15)' }}>
                              No bids yet
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <div className={`w-full lg:w-80 flex flex-col gap-5 ${activeTab === 'live' ? 'hidden lg:flex' : 'flex'}`}>

            {/* MY SQUAD */}
            <div className={`flex flex-col ${activeTab === 'teams' ? 'hidden lg:flex' : 'flex'}`}
              style={{ background: 'var(--bg-pitch)', border: '1px solid rgba(255,255,255,0.06)', maxHeight: 380 }}>
              <div className="px-5 py-4 flex items-center justify-between"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <div className="font-headline text-xl text-white tracking-wide">MY SQUAD</div>
                  <div className="label-dim">Tactical Roster</div>
                </div>
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-headline text-lg"
                  style={{ background: 'rgba(0,179,65,0.15)', border: '1px solid rgba(0,179,65,0.3)', color: 'var(--electric)' }}>
                  {mySquad.length}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {mySquad.length === 0 ? (
                  <div className="py-10 flex flex-col items-center text-center opacity-30">
                    <div className="text-4xl mb-3">🛡️</div>
                    <p className="font-mono text-[9px] tracking-widest uppercase">No players yet</p>
                  </div>
                ) : mySquad.map(p => (
                  <div key={p.id} className="flex items-center gap-3 p-3 transition-all"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderLeft: '3px solid var(--pitch)' }}>
                    <div className="w-8 h-8 rounded flex items-center justify-center font-mono text-[10px] font-bold shrink-0"
                      style={{ background: 'rgba(0,179,65,0.1)', color: 'var(--pitch)' }}>
                      {(p.position || '').substring(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs text-white uppercase truncate">{p.name}</div>
                      <div className="font-mono text-[8px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{p.college}</div>
                    </div>
                    <div className="font-mono text-xs font-bold shrink-0" style={{ color: 'var(--gold)' }}>
                      ₹{(p.sold_price/100000).toFixed(1)}L
                    </div>
                  </div>
                ))}
              </div>
              {mySquad.length > 0 && (
                <div className="px-5 py-3 flex justify-between font-mono text-[9px]"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }}>
                  <span>Avg Salary</span>
                  <span className="text-white">₹{(mySquad.reduce((a, p) => a + p.sold_price, 0) / mySquad.length / 100000).toFixed(1)}L</span>
                </div>
              )}
            </div>

            {/* ALL TEAMS */}
            <div className={`flex flex-col flex-1 ${activeTab === 'squad' ? 'hidden lg:flex' : 'flex'}`}
              style={{ background: 'var(--bg-pitch)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="font-headline text-xl text-white tracking-wide">ALL TEAMS</div>
                <div className="label-dim">Live Standings</div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-white/5">
                {teams.map(t => {
                  const tid   = t.id || t._id
                  const isMe  = tid === myId
                  const isOpen = expandedTeam === tid
                  const squad = players.filter(p => p.sold_to === tid && p.status === 'sold')
                  return (
                    <div key={tid} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <button onClick={() => setExpandedTeam(isOpen ? null : tid)}
                        className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors"
                        style={{ background: isOpen ? 'rgba(0,179,65,0.05)' : 'transparent' }}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full overflow-hidden border flex items-center justify-center text-xs font-bold shrink-0"
                            style={{ borderColor: isMe ? 'var(--electric)' : 'rgba(255,255,255,0.1)', background: 'rgba(0,179,65,0.08)', color: 'var(--pitch)' }}>
                            {t.logo_url ? <img src={t.logo_url} className="w-full h-full object-cover" alt="" /> : t.name[0]}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-white uppercase">{t.name}</span>
                              {isMe && (
                                <span className="font-mono text-[7px] px-1.5 py-0.5 uppercase"
                                  style={{ background: 'rgba(0,255,135,0.1)', color: 'var(--electric)', border: '1px solid rgba(0,255,135,0.3)' }}>
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[8px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                              ₹{((t.budget_remaining || 0)/100000).toFixed(1)}L · {squad.length} players
                            </div>
                          </div>
                        </div>
                        <span className="font-mono text-[10px] transition-transform duration-200"
                          style={{ color: 'rgba(255,255,255,0.25)', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-4 space-y-2" style={{ background: 'rgba(0,0,0,0.2)' }}>
                          {squad.length === 0 ? (
                            <p className="font-mono text-[8px] py-2 italic" style={{ color: 'rgba(255,255,255,0.2)' }}>No players yet</p>
                          ) : squad.map(p => (
                            <div key={p.id} className="flex items-center justify-between py-1.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[7px] px-1.5 py-0.5 uppercase"
                                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                  {(p.position || '').substring(0, 3)}
                                </span>
                                <span className="font-bold text-[11px] text-white uppercase">{p.name}</span>
                              </div>
                              <span className="font-mono text-[10px] font-bold" style={{ color: 'var(--gold)' }}>
                                ₹{(p.sold_price/100000).toFixed(1)}L
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                {teams.length === 0 && (
                  <div className="py-10 text-center font-mono text-[9px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    No teams loaded
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      <SoldOverlay data={soldData} />
    </div>
  )
}

function SoldOverlay({ data }: { data: any }) {
  return (
    <AnimatePresence>
      {data && (
        <motion.div key="sold"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden"
          style={{ background: '#000' }}>
          {/* Flash */}
          <motion.div className="absolute inset-0 bg-white pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0, 0.5, 0] }}
            transition={{ duration: 0.5, times: [0, 0.1, 0.2, 0.35, 1] }} />
          {/* Glow */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(245,158,11,0.2), transparent)' }} />
          {/* Content */}
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
            className="relative z-10 flex flex-col items-center text-center px-6">
            <div className="font-mono text-[11px] tracking-[0.5em] uppercase mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Hammer Down
            </div>
            <div className="font-headline" style={{
              fontSize: 'clamp(100px, 20vw, 220px)', lineHeight: 0.85,
              color: 'var(--gold)', letterSpacing: '0.04em',
              textShadow: '0 0 80px rgba(245,158,11,0.5), 0 0 160px rgba(245,158,11,0.2)',
            }}>SOLD</div>
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.5 }}
              className="mt-8 flex flex-col items-center gap-3">
              <div className="font-headline text-white" style={{ fontSize: 'clamp(28px, 5vw, 56px)', letterSpacing: '0.06em' }}>
                {data?.player?.name || 'Player'}
              </div>
              <div className="flex items-center gap-3 font-mono text-sm">
                <span style={{ color: 'rgba(255,255,255,0.35)' }}>to</span>
                <span className="text-white font-bold uppercase tracking-widest">{data?.team?.name || 'Team'}</span>
              </div>
              <div className="font-headline" style={{ fontSize: 'clamp(32px, 5vw, 60px)', color: 'var(--gold)', letterSpacing: '0.04em' }}>
                ₹{data?.amount ? (data.amount / 100000).toFixed(1) : '0'}L
              </div>
            </motion.div>
          </motion.div>
          {/* Countdown bar */}
          <motion.div className="absolute bottom-0 left-0 h-1" style={{ background: 'var(--gold)' }}
            initial={{ width: '100%' }} animate={{ width: '0%' }}
            transition={{ duration: 4, ease: 'linear' }} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
