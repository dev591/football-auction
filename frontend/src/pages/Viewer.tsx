import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { motion, AnimatePresence } from 'framer-motion'
import { apiFetch } from '../utils/authFetch'

export default function Viewer() {
  const [auctionState, setAuctionState] = useState<any>(null)
  const [teams,        setTeams]        = useState<any[]>([])
  const [players,      setPlayers]      = useState<any[]>([])
  const [soldData,     setSoldData]     = useState<any>(null)

  useEffect(() => {
    let socket: Socket | null = null
    socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001')
    socket.emit('auction:request_state')

    socket.on('auction:state', (st: any) => setAuctionState(st))
    socket.on('auction:bid', () => {})
    socket.on('auction:sold', (data: any) => { setSoldData(data); setTimeout(() => setSoldData(null), 4000) })

    const applyFullState = (fs: any) => {
      if (!fs) return
      setAuctionState(fs)
      if (fs.teams)   setTeams(fs.teams)
      if (fs.players) setPlayers(fs.players)
    }

    socket.on('teams:updated',   (p: any) => p?.fullState && applyFullState(p.fullState))
    socket.on('players:updated', (p: any) => p?.fullState && applyFullState(p.fullState))

    Promise.all([
      apiFetch('/api/players').then(r => r.json()),
      apiFetch('/api/teams').then(r => r.json()),
    ]).then(([p, t]) => {
      setPlayers(Array.isArray(p) ? p : (p.players || []))
      setTeams(Array.isArray(t) ? t : (t.teams || []))
    })

    return () => {
      if (socket) socket.disconnect()
    }
  }, [])

  const currentPlayer = auctionState?.currentPlayer
  const currentBid    = auctionState?.currentBid || currentPlayer?.base_price || 0
  const currentStatus = auctionState?.auction?.status
  const leadingTeam   = auctionState?.currentBidderTeam

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-dark)' }}>
      <div className="noise-overlay" />

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4"
        style={{ background: 'var(--bg-pitch)', borderBottom: '1px solid rgba(0,179,65,0.15)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg"
            style={{ background: 'var(--pitch)' }}>⚽</div>
          <div>
            <div className="font-headline text-2xl tracking-widest text-white">STRIKER</div>
            <div className="font-mono text-[8px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Live Auction — View Only
            </div>
          </div>
        </div>
        <div className="live-badge">
          <span className="live-dot" />
          LIVE
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Main auction display */}
        <div className="lg:col-span-2 flex flex-col gap-5">

          {/* Current bid banner */}
          <div className="relative overflow-hidden"
            style={{ background: 'var(--bg-pitch)', border: '1px solid rgba(0,255,135,0.15)', padding: '24px 28px' }}>
            <div className="absolute top-0 inset-x-0 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, var(--electric), transparent)' }} />
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="label-dim mb-2">
                  {currentStatus === 'live' ? 'Live Auction' : currentStatus === 'reveal' ? 'Player Reveal' : 'Standby'}
                </div>
                <div className="bid-amount" style={{ fontSize: 'clamp(48px, 8vw, 80px)' }}>
                  {currentStatus === 'live' || currentStatus === 'reveal'
                    ? `₹${(currentBid / 100000).toFixed(1)}L`
                    : '—'}
                </div>
              </div>
              {leadingTeam && currentStatus === 'live' && (
                <div className="text-right">
                  <div className="label-dim mb-1">Leading</div>
                  <div className="font-headline text-3xl text-white">
                    {typeof leadingTeam === 'object' ? leadingTeam.name : leadingTeam}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Player card */}
          <div className="flex-1 relative overflow-hidden"
            style={{ background: 'var(--bg-pitch)', border: '1px solid rgba(255,255,255,0.06)', minHeight: 360 }}>
            <AnimatePresence mode="wait">
              {(!currentStatus || currentStatus === 'waiting' || currentStatus === 'ready') && (
                <motion.div key="waiting"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center text-center p-12">
                  <div className="text-6xl mb-6 animate-float">⚽</div>
                  <div className="font-headline text-4xl text-white mb-3 tracking-widest">STAND BY</div>
                  <p className="font-mono text-[10px] tracking-[0.3em] uppercase" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    Waiting for next player...
                  </p>
                </motion.div>
              )}

              {currentStatus === 'reveal' && currentPlayer && (
                <motion.div key="reveal"
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center text-center p-12">
                  <div className="font-mono text-[10px] tracking-[0.5em] uppercase mb-6 animate-pulse"
                    style={{ color: 'var(--electric)' }}>Next Player</div>
                  <h2 className="font-headline text-white mb-3"
                    style={{ fontSize: 'clamp(56px, 10vw, 100px)', lineHeight: 0.9 }}>
                    {currentPlayer.name}
                  </h2>
                  <div className="font-mono text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {currentPlayer.position} · {currentPlayer.college}
                  </div>
                  <div className="mt-4 font-headline text-3xl" style={{ color: 'var(--gold)' }}>
                    Base ₹{(currentPlayer.base_price / 100000).toFixed(1)}L
                  </div>
                </motion.div>
              )}

              {currentStatus === 'live' && currentPlayer && (
                <motion.div key="live"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col md:flex-row">
                  <div className="flex-1 flex flex-col items-center justify-center p-8">
                    <div className="w-36 h-36 rounded-full overflow-hidden border-4 mb-5 flex items-center justify-center font-headline text-5xl"
                      style={{ borderColor: 'var(--electric)', background: 'rgba(0,255,135,0.05)', color: 'var(--electric)', boxShadow: '0 0 40px rgba(0,255,135,0.2)' }}>
                      {currentPlayer.image_url
                        ? <img src={currentPlayer.image_url} alt="" className="w-full h-full object-cover" />
                        : (currentPlayer.position || 'P')[0]}
                    </div>
                    <h2 className="font-headline text-white text-center mb-1"
                      style={{ fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 0.95 }}>
                      {currentPlayer.name}
                    </h2>
                    <p className="font-mono text-[10px] mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {currentPlayer.position} · {currentPlayer.college}
                    </p>
                    <div className="font-mono text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      Base ₹{(currentPlayer.base_price / 100000).toFixed(1)}L
                    </div>
                  </div>
                  <div className="w-full md:w-64 p-6 flex flex-col gap-4"
                    style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)' }}>
                    <div className="p-5 relative overflow-hidden"
                      style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                      <div className="font-mono text-[9px] tracking-widest uppercase mb-2" style={{ color: 'rgba(245,158,11,0.6)' }}>Current Bid</div>
                      <div className="bid-amount" style={{ fontSize: '48px' }}>₹{(currentBid / 100000).toFixed(1)}L</div>
                      <div className="mt-2 font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {leadingTeam
                          ? (typeof leadingTeam === 'object' ? leadingTeam.name : leadingTeam)
                          : 'No bids yet'}
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                      {auctionState?.history?.slice(0, 6).map((h: any, i: number) => (
                        <div key={i} className="flex justify-between py-1.5"
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <span className="font-mono text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            {typeof h.team === 'object' && h.team ? h.team.name : h.teamName || '—'}
                          </span>
                          <span className="font-mono text-[10px] font-bold" style={{ color: 'var(--gold)' }}>
                            ₹{(h.amount / 100000).toFixed(1)}L
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Teams sidebar */}
        <div style={{ background: 'var(--bg-pitch)', border: '1px solid rgba(255,255,255,0.06)' }}
          className="flex flex-col">
          <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="font-headline text-xl text-white tracking-wide">Teams</div>
            <div className="label-dim">Live Standings</div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-white/5">
            {teams.map(t => {
              const squad = players.filter(p => p.sold_to === t.id && p.status === 'sold')
              return (
                <div key={t.id} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-bold text-sm text-white uppercase">{t.name}</div>
                    <div className="font-mono text-xs font-bold" style={{ color: 'var(--gold)' }}>
                      ₹{((t.budget_remaining || 0) / 100000).toFixed(1)}L
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {squad.length === 0
                      ? <span className="font-mono text-[8px]" style={{ color: 'rgba(255,255,255,0.2)' }}>No players yet</span>
                      : squad.map(p => (
                        <span key={p.id} className="font-mono text-[8px] px-2 py-0.5"
                          style={{ background: 'rgba(0,179,65,0.08)', color: 'var(--electric)', border: '1px solid rgba(0,179,65,0.15)' }}>
                          {p.name}
                        </span>
                      ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* SOLD overlay */}
      <AnimatePresence>
        {soldData && (
          <motion.div key="sold" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
            style={{ background: '#000' }}>
            <motion.div className="absolute inset-0 bg-white pointer-events-none"
              initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0, 0.5, 0] }}
              transition={{ duration: 0.5 }} />
            <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
              className="relative z-10 flex flex-col items-center text-center px-6">
              <div className="font-headline" style={{ fontSize: 'clamp(100px, 20vw, 200px)', lineHeight: 0.85, color: 'var(--gold)', textShadow: '0 0 80px rgba(245,158,11,0.5)' }}>SOLD</div>
              <div className="font-headline text-white mt-4" style={{ fontSize: 'clamp(28px, 5vw, 48px)' }}>{soldData?.player?.name}</div>
              <div className="font-mono text-sm mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>to {soldData?.team?.name}</div>
              <div className="font-headline mt-2" style={{ fontSize: '40px', color: 'var(--gold)' }}>₹{soldData?.amount ? (soldData.amount / 100000).toFixed(1) : 0}L</div>
            </motion.div>
            <motion.div className="absolute bottom-0 left-0 h-1" style={{ background: 'var(--gold)' }}
              initial={{ width: '100%' }} animate={{ width: '0%' }} transition={{ duration: 4, ease: 'linear' }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
