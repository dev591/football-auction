import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { motion, AnimatePresence } from 'framer-motion'
import { authFetch, apiFetch } from '../utils/authFetch'
import Navbar from '../components/Navbar'

export default function Controller() {
  const [token, setToken] = useState(() => {
    try {
      const t = localStorage.getItem('striker_token')
      if (!t) return ''
      const payload = JSON.parse(atob(t.split('.')[1]))
      return payload.role === 'admin' ? t : ''
    } catch { return '' }
  })
  const [password, setPassword] = useState('')
  const [activeTab, setActiveTab] = useState('auction')
  const [resetConfirm, setResetConfirm] = useState('')  // for nuclear confirm input
  const [toast, setToast] = useState('')

  const [players, setPlayers]   = useState<any[]>([])
  const [teams,   setTeams]     = useState<any[]>([])
  const [auctionState, setAuctionState] = useState<any>(null)
  const [activityLog,  setActivityLog]  = useState<{event_type:string, message:string, created_at:string}[]>([])
  const [logOpen,      setLogOpen]      = useState(true)
  const [lobbyOpen,    setLobbyOpen]    = useState(true)

  const [selectedIncrement, setSelectedIncrement]   = useState(500000) // default 5L

  const [customSaleOpen, setCustomSaleOpen] = useState(false)
  const [sellModalOpen,  setSellModalOpen]  = useState(false)
  const [sellTeamId,     setSellTeamId]     = useState('')
  const [salePlayerId,   setSalePlayerId]   = useState('')
  const [saleTeamId,     setSaleTeamId]     = useState('')
  const [salePrice,      setSalePrice]      = useState('')

  const [importData, setImportData] = useState<any[]>([])
  const [importing,  setImporting]  = useState(false)
  const [manualPlayerName,    setManualPlayerName]    = useState('')
  const [manualPlayerPos,     setManualPlayerPos]     = useState('')
  const [manualPlayerCollege, setManualPlayerCollege] = useState('')

  // Bulk team creation
  const [bulkTeamNames,      setBulkTeamNames]      = useState('')
  const [bulkBudget,         setBulkBudget]         = useState('100000000')
  const [bulkCreating,       setBulkCreating]       = useState(false)
  const [createdCredentials, setCreatedCredentials] = useState<any[]>([])
  const [viewingCreds,       setViewingCreds]       = useState<any | null>(null) // single team creds modal
  const [transferPlayer,     setTransferPlayer]     = useState<any | null>(null) // player being transferred
  const [transferToTeamId,   setTransferToTeamId]   = useState('')

  const parseBulkNames = (raw: string) =>
    raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)

  const handleBulkCreateTeams = async () => {
    const names = parseBulkNames(bulkTeamNames)
    if (names.length === 0) return alert('Enter at least one team name')
    setBulkCreating(true)
    try {
      const resp = await authFetch('/api/admin/bulk-add-teams', {
        method: 'POST',
        body: JSON.stringify({ teams: names, budget: Number(bulkBudget) || 10000000 }),
      })
      if (!resp.ok) { const e = await resp.json(); throw new Error(e.error) }
      const data = await resp.json()
      setCreatedCredentials(data.teams)
      setBulkTeamNames('')
    } catch (err: any) { alert(`Failed: ${err.message}`) }
    setBulkCreating(false)
  }

  const downloadCredentialsCSV = (creds: any[]) => {
    const header = 'Team Name,Login ID,Password,Budget (₹)\n'
    const rows = creds.map(t => `${t.name},${t.team_id_code},${t.password},${t.budget_remaining}`).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = 'striker_team_credentials.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    if (!token) return
    let active = true
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001')
    socket.emit('auction:request_state')
    socket.on('auction:state', (s) => {
      setAuctionState(s)
      if (s?.teams)   setTeams(s.teams)
      if (s?.players) setPlayers(s.players)
    })
    socket.on('auction:log', (entry) => setActivityLog(prev => [entry, ...prev].slice(0, 100)))
    socket.on('auction:reset', () => setTimeout(() => window.location.reload(), 2000))

    const applyFullState = (fullState: any) => {
      if (!fullState) return
      if (fullState.players) setPlayers(fullState.players)
      if (fullState.teams)   setTeams(fullState.teams)
      setAuctionState(fullState)
    }

    const fetchAll = () => {
      Promise.all([
        apiFetch('/api/players').then(r => r.json()),
        apiFetch('/api/teams').then(r => r.json()),
      ]).then(([pResp, tResp]) => {
        if (!active) return
        setPlayers(Array.isArray(pResp) ? pResp : (pResp.players || pResp.data || []))
        setTeams(Array.isArray(tResp) ? tResp : (tResp.teams || tResp.data || []))
      })
    }

    socket.on('teams:updated',   (payload) => payload?.fullState ? applyFullState(payload.fullState) : fetchAll())
    socket.on('players:updated', (payload) => payload?.fullState ? applyFullState(payload.fullState) : fetchAll())
    fetchAll()
    return () => { active = false; socket.disconnect() }
  }, [token])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const resp = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!resp.ok) throw new Error('Login failed')
      const data = await resp.json()
      localStorage.setItem('striker_token', data.token)
      setToken(data.token)
    } catch { alert('Login Failed') }
  }

  const auctionAction = async (endpoint: string, body?: any) => {
    try {
      const resp = await authFetch(`/api/auction/${endpoint}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!resp.ok) {
        const e = await resp.json()
        console.error('[AUCTION ACTION FAILED]', endpoint, e)
        alert(`Error: ${e.error || 'Action failed'}`)
      }
    } catch (err: any) {
      console.error('[AUCTION ACTION EXCEPTION]', endpoint, err)
      alert(`Error: ${err.message}`)
    }
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const adminAction = async (method: string, path: string, body?: any) => {
    try {
      const resp = await authFetch(path, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!resp.ok) {
        let errMsg = 'Action failed'
        try { const e = await resp.json(); errMsg = e.error || errMsg } catch {}
        alert(`Error: ${errMsg}`)
        return false
      }
      return true
    } catch (err: any) { alert(`Error: ${err.message}`); return false }
  }

  // Normalize any row from CSV/Excel — extract name, position, school, photo
  const normalizeRows = (rows: any[]) =>
    rows.map(row => {
      const get = (key: string) => {
        const found = Object.keys(row).find(k => k.trim().toLowerCase() === key.toLowerCase())
        return found ? String(row[found] || '').trim() : ''
      }
      // Also try partial match for "upload your photo" column
      const getPartial = (partial: string) => {
        const found = Object.keys(row).find(k => k.trim().toLowerCase().includes(partial.toLowerCase()))
        return found ? String(row[found] || '').trim() : ''
      }

      const rawPhoto = getPartial('photo') || getPartial('upload')
      // Convert Google Drive share link to thumbnail URL (works in img tags)
      const convertDriveUrl = (url: string) => {
        if (!url) return ''
        // Already a direct URL (not Drive)
        if (!url.includes('drive.google.com')) return url
        const match = url.match(/(?:id=|\/d\/)([a-zA-Z0-9_-]{10,})/)
        if (match) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w400`
        return url
      }

      return {
        name:      get('name'),
        position:  get('position'),
        college:   get('school') || get('college') || 'N/A',
        image_url: convertDriveUrl(rawPhoto),
      }
    }).filter(r => r.name && r.position)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (r) => setImportData(normalizeRows(r.data as any[]))
      })
    } else if (file.name.endsWith('.xlsx')) {
      const reader = new FileReader()
      reader.onload = (evt) => {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' })
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as any[]
        setImportData(normalizeRows(rows))
      }
      reader.readAsBinaryString(file)
    }
  }

  const handleImportSubmit = async () => {
    const valid = importData.filter(p => p.name && p.position)
    if (valid.length === 0) return alert('No valid players found — check Name and Position columns exist')
    setImporting(true)
    try {
      const resp = await authFetch('/api/players/import', { method: 'POST', body: JSON.stringify({ players: valid }) })
      if (resp.ok) { alert(`Imported ${valid.length} players!`); setImportData([]) }
      else { const e = await resp.json(); alert(`Import failed: ${e.error}`) }
    } catch { alert('Error importing') }
    setImporting(false)
  }

  const handlePlayerPhoto = async (playerId: string, file: File) => {
    const fd = new FormData(); fd.append('photo', file)
    try {
      await authFetch(`/api/players/${playerId}/photo`, { method: 'POST', body: fd })
      setPlayers(prev => prev.map(p => (p.id === playerId || p._id === playerId) ? { ...p, image_url: URL.createObjectURL(file) } : p))
    } catch { alert('Failed to upload photo') }
  }

  const handleClearPlayers = async () => {
    if (!confirm('Delete ALL players?')) return
    await authFetch('/api/admin/clear-players', { method: 'POST' })
  }
  const handleDeleteTeam = async (id: string) => {
    if (!confirm('Delete this team?')) return
    await authFetch(`/api/admin/teams/${id}`, { method: 'DELETE' })
  }
  const handlePlayerDelete = async (id: string) => {
    if (!confirm('Delete this player?')) return
    await authFetch(`/api/players/${id}`, { method: 'DELETE' })
  }

  /* ── LOGIN GATE ── */
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 pitch-texture-dark"
        style={{ background: 'var(--bg-pitch)' }}>
        <div className="noise-overlay" />
        <Navbar />
        {/* Visor corners */}
        <div className="fixed inset-0 pointer-events-none z-10">
          <div className="visor-corner visor-tl" /><div className="visor-corner visor-tr" />
          <div className="visor-corner visor-bl" /><div className="visor-corner visor-br" />
          <div className="scan-line" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm relative z-20"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,255,135,0.15)', padding: '48px 40px' }}
        >
          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center text-3xl"
              style={{ background: 'rgba(0,179,65,0.15)', border: '1px solid rgba(0,179,65,0.3)' }}>
              🔑
            </div>
            <h2 className="font-headline text-4xl tracking-widest text-white mb-1">MISSION CONTROL</h2>
            <p className="font-mono text-[9px] tracking-[0.3em] uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>
              RESTRICTED ADMIN ACCESS
            </p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <input
              type="password" placeholder="Authorization Key"
              className="input-dark" value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button type="submit" className="btn btn-primary w-full" style={{ fontSize: '1rem', padding: '14px' }}>
              ENGAGE SYSTEM
            </button>
          </form>
        </motion.div>
      </div>
    )
  }

  const currentPlayer = auctionState?.currentPlayer
  const currentBid    = auctionState?.currentBid || currentPlayer?.base_price || 0
  const currentStatus = auctionState?.auction?.status

  return (
    <div className="min-h-screen pitch-texture-dark" style={{ background: 'var(--bg-dark)' }}>
      <div className="noise-overlay" />
      <div className="fixed inset-0 pointer-events-none z-10">
        <div className="visor-corner visor-tl" /><div className="visor-corner visor-tr" />
        <div className="visor-corner visor-bl" /><div className="visor-corner visor-br" />
        <div className="scan-line" />
      </div>
      <Navbar />

      <main className="max-w-7xl mx-auto px-6 pt-28 pb-32 relative z-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
          <div>
            <span className="label-dim block mb-2">Operational Hub</span>
            <h1 className="font-headline text-6xl md:text-7xl tracking-widest text-white leading-none">
              MISSION CONTROL
            </h1>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 p-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {['auction', 'players', 'teams', 'overview', 'danger'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="px-6 py-2.5 font-mono text-[10px] tracking-[0.2em] uppercase transition-all"
                style={{
                  background: activeTab === tab ? (tab === 'danger' ? 'rgba(239,68,68,0.15)' : 'var(--pitch)') : 'transparent',
                  color: activeTab === tab ? (tab === 'danger' ? '#fca5a5' : '#fff') : tab === 'danger' ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.3)',
                }}
              >{tab}</button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">

          {/* ── AUCTION TAB ── */}
          {activeTab === 'auction' && (
            <motion.div key="auction"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              {/* Main panel */}
              <div className="lg:col-span-2 space-y-6">

                {/* Phase controls */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', padding: '24px' }}>
                  <div className="label-dim mb-4">Phase Control</div>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { key: 'waiting', label: 'Waiting',     action: () => auctionAction('phase', { phase: 'waiting' }) },
                      { key: 'ready',   label: 'Ready',       action: () => auctionAction('phase', { phase: 'ready' }) },
                      { key: 'reveal',  label: 'Reveal Next', action: () => auctionAction('reveal') },
                      { key: 'live',    label: 'Live Bid',    action: () => auctionAction('phase', { phase: 'live' }) },
                    ].map(p => {
                      const lobbyTeams  = (auctionState?.teams || teams).filter((t: any) => t.in_lobby)
                      const disabled    = p.key === 'live' && lobbyTeams.length < 2
                      return (
                        <button key={p.key} onClick={disabled ? undefined : p.action}
                          className="btn"
                          style={{
                            padding: '10px 20px', fontSize: '0.8rem',
                            background: currentStatus === p.key ? 'var(--pitch)' : 'rgba(255,255,255,0.05)',
                            color: disabled ? 'rgba(255,255,255,0.15)' : currentStatus === p.key ? '#fff' : 'rgba(255,255,255,0.4)',
                            border: `1px solid ${currentStatus === p.key ? 'var(--pitch)' : 'rgba(255,255,255,0.08)'}`,
                            cursor: disabled ? 'not-allowed' : 'none',
                            opacity: disabled ? 0.5 : 1,
                          }}
                          title={disabled ? 'Need at least 2 teams in lobby' : undefined}
                        >{p.label}</button>
                      )
                    })}
                  </div>
                </div>

                {/* Current player card */}
                <div className="card-live relative overflow-hidden" style={{ padding: '32px' }}>
                  <div className="absolute top-0 inset-x-0 h-px"
                    style={{ background: 'linear-gradient(90deg, transparent, var(--electric), transparent)' }} />
                  <div className="flex items-center gap-3 mb-6">
                    {currentStatus === 'live' && <span className="live-dot" />}
                    <span className="label-dim">Current Target</span>
                    <span className="font-mono text-[9px] ml-auto" style={{ color: 'rgba(255,255,255,0.2)' }}>
                      SESSION: AFC-2025
                    </span>
                  </div>

                  {currentPlayer ? (
                    <div className="flex flex-col md:flex-row items-center gap-8">
                      <div className="w-32 h-32 rounded-full overflow-hidden border-2 shrink-0 flex items-center justify-center font-headline text-4xl"
                        style={{ borderColor: 'var(--electric)', background: 'rgba(0,255,135,0.05)', color: 'var(--electric)' }}>
                        {currentPlayer.image_url
                          ? <img src={currentPlayer.image_url} alt="" className="w-full h-full object-cover" />
                          : (currentPlayer.position || 'P')[0]
                        }
                      </div>
                      <div className="flex-1 text-center md:text-left">
                        <h2 className="font-headline text-5xl text-white mb-1 tracking-wide">{currentPlayer.name}</h2>
                        <p className="font-mono text-[10px] mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          {currentPlayer.position} · {currentPlayer.college}
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', padding: '12px', textAlign: 'center' }}>
                            <div className="font-mono text-[8px] mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>BASE</div>
                            <div className="font-headline text-lg text-white">₹{(currentPlayer.base_price/100000).toFixed(1)}L</div>
                          </div>
                          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', padding: '12px', textAlign: 'center' }}>
                            <div className="font-mono text-[8px] mb-1" style={{ color: 'rgba(245,158,11,0.6)' }}>CURRENT</div>
                            <div className="bid-amount text-2xl">₹{(currentBid/100000).toFixed(1)}L</div>
                          </div>
                          <div className="col-span-2 md:col-span-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', padding: '12px', textAlign: 'center' }}>
                            <div className="font-mono text-[8px] mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>LEADING</div>
                            <div className="font-mono text-xs text-white font-bold uppercase truncate">
                              {auctionState?.currentBidderTeam
                                ? (typeof auctionState.currentBidderTeam === 'object' ? auctionState.currentBidderTeam.name : `Team ${auctionState.currentBidderTeam}`)
                                : 'No bids'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-32 flex items-center justify-center font-mono text-sm" style={{ color: 'rgba(255,255,255,0.15)' }}>
                      NO TARGET ACTIVE
                    </div>
                  )}
                </div>

                {/* Bid Controls */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', padding: '24px' }}>
                  <div className="label-dim mb-5">Bid Controls</div>

                  {/* Current bid display */}
                  <div className="text-center mb-6 py-5"
                    style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                    <div className="font-mono text-[9px] tracking-widest uppercase mb-2" style={{ color: 'rgba(245,158,11,0.5)' }}>
                      Current Bid
                    </div>
                    <div className="bid-amount" style={{ fontSize: 'clamp(40px, 6vw, 64px)' }}>
                      {currentPlayer
                        ? `₹${(currentBid / 100000).toFixed(1)}L`
                        : '—'
                      }
                    </div>
                    {currentPlayer && (
                      <div className="font-mono text-[9px] mt-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
                        Next: ₹{((currentBid + selectedIncrement) / 100000).toFixed(1)}L
                        {' '}(+{(selectedIncrement / 100000).toFixed(1)}L)
                      </div>
                    )}
                  </div>

                  {/* Increment selector */}
                  <div className="mb-4">
                    <label className="font-mono text-[9px] tracking-widest uppercase block mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      Increment
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { label: '₹5L',  value: 500000 },
                        { label: '₹10L', value: 1000000 },
                        { label: '₹25L', value: 2500000 },
                        { label: '₹50L', value: 5000000 },
                      ].map(opt => (
                        <button key={opt.value} onClick={() => setSelectedIncrement(opt.value)}
                          className="btn font-mono text-[9px] tracking-widest"
                          style={{
                            padding: '8px 14px', fontSize: '0.75rem',
                            background: selectedIncrement === opt.value ? 'var(--pitch)' : 'rgba(255,255,255,0.05)',
                            color: selectedIncrement === opt.value ? '#fff' : 'rgba(255,255,255,0.4)',
                            border: `1px solid ${selectedIncrement === opt.value ? 'var(--pitch)' : 'rgba(255,255,255,0.08)'}`,
                          }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                    <button className="btn btn-primary col-span-2 md:col-span-1"
                      style={{ padding: '14px', fontSize: '1rem' }}
                      onClick={() => {
                        auctionAction('bid', { increment: selectedIncrement })
                      }}>
                      + BID
                    </button>
                    <button className="btn btn-gold" style={{ padding: '14px', fontSize: '0.85rem' }}
                      onClick={() => { setSellTeamId(''); setSellModalOpen(true) }}>SELL</button>
                    <button className="btn" style={{ padding: '14px', fontSize: '0.85rem', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
                      onClick={() => auctionAction('pass')}>PASS</button>
                    <button className="btn" style={{ padding: '14px', fontSize: '0.85rem', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
                      onClick={() => auctionAction('undo')}>UNDO</button>
                  </div>
                  <button className="btn w-full mt-3"
                    style={{ padding: '10px', fontSize: '0.75rem', background: 'rgba(59,130,246,0.08)', color: 'rgba(147,197,253,0.6)', border: '1px solid rgba(59,130,246,0.15)' }}
                    onClick={() => setCustomSaleOpen(true)}>
                    Manual Override
                  </button>
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Lobby status */}
                {(() => {
                  const allTeams    = auctionState?.teams || teams
                  const joinedTeams = allTeams.filter((t: any) => t.in_lobby)
                  const total       = allTeams.length
                  const joined      = joinedTeams.length
                  const canStart    = joined >= 2
                  return (
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <button
                        onClick={() => setLobbyOpen(o => !o)}
                        className="w-full flex items-center justify-between px-5 py-4 transition-colors"
                        style={{ borderBottom: lobbyOpen ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="live-dot" style={{ width: 6, height: 6, background: canStart ? 'var(--electric)' : 'rgba(255,255,255,0.2)' }} />
                          <span className="label-dim">Lobby</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-headline text-2xl" style={{ color: canStart ? 'var(--electric)' : 'rgba(255,255,255,0.4)' }}>
                            {joined}<span className="text-base" style={{ color: 'rgba(255,255,255,0.2)' }}>/{total}</span>
                          </span>
                          <span className="font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.2)', transform: lobbyOpen ? 'rotate(180deg)' : 'none', display: 'inline-block' }}>▲</span>
                        </div>
                      </button>
                      {lobbyOpen && (
                        <div className="p-3 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                          {allTeams.length === 0 && (
                            <div className="py-4 text-center font-mono text-[9px]" style={{ color: 'rgba(255,255,255,0.15)' }}>No teams created yet</div>
                          )}
                          {allTeams.map((t: any) => (
                            <div key={t.id} className="flex items-center justify-between px-3 py-2"
                              style={{ background: t.in_lobby ? 'rgba(0,179,65,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${t.in_lobby ? 'rgba(0,179,65,0.2)' : 'rgba(255,255,255,0.05)'}` }}>
                              <span className="font-mono text-[10px] text-white uppercase">{t.name}</span>
                              <span className="font-mono text-[8px] px-2 py-0.5"
                                style={{
                                  background: t.in_lobby ? 'rgba(0,255,135,0.1)' : 'rgba(255,255,255,0.04)',
                                  color: t.in_lobby ? 'var(--electric)' : 'rgba(255,255,255,0.2)',
                                  border: `1px solid ${t.in_lobby ? 'rgba(0,255,135,0.3)' : 'rgba(255,255,255,0.06)'}`,
                                }}>
                                {t.in_lobby ? 'JOINED' : 'WAITING'}
                              </span>
                            </div>
                          ))}
                          {!canStart && total > 0 && (
                            <div className="pt-1 font-mono text-[8px] text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>
                              Need at least 2 teams to start
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })()}
                {/* Bid log */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="label-dim">Transmission Log</div>
                  </div>
                  <div className="p-4 space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                    {auctionState?.history?.map((h: any, i: number) => (
                      <div key={i} className="flex justify-between items-center py-2"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <span className="font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          {h.team?.name || h.teamName || `Team ${h.teamId}`}
                        </span>
                        <span className="font-mono text-[10px] font-bold" style={{ color: 'var(--gold)' }}>
                          ₹{(h.amount/100000).toFixed(1)}L
                        </span>
                      </div>
                    ))}
                    {(!auctionState?.history?.length) && (
                      <div className="py-10 text-center font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.15)' }}>IDLE...</div>
                    )}
                  </div>
                </div>

                {/* Danger zone */}
                <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)', padding: '20px' }}>
                  <div className="font-mono text-[9px] tracking-[0.3em] uppercase mb-4" style={{ color: 'rgba(239,68,68,0.6)' }}>
                    Danger Zone
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button className="btn btn-danger" style={{ padding: '10px', fontSize: '0.75rem' }}
                      onClick={() => auctionAction('reset')}>Hard Reset</button>
                    <button className="btn" style={{ padding: '10px', fontSize: '0.75rem', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}
                      onClick={() => auctionAction('clear-unsold')}>Purge Unsold</button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── PLAYERS TAB ── */}
          {activeTab === 'players' && (
            <motion.div key="players"
              initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-4 gap-8"
            >
              {/* Import panel */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', padding: '28px' }}>
                <div className="label-dim mb-4">Add Single Player</div>
                <div className="space-y-3 mb-6">
                  <input type="text" placeholder="Player Name" className="input-dark w-full"
                    value={manualPlayerName} onChange={e => setManualPlayerName(e.target.value)} />
                  <select className="input-dark w-full" value={manualPlayerPos} onChange={e => setManualPlayerPos(e.target.value)}>
                    <option value="">Position</option>
                    {['Forward','Midfielder','Defender','Goalkeeper'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <input type="text" placeholder="School / College" className="input-dark w-full"
                    value={manualPlayerCollege} onChange={e => setManualPlayerCollege(e.target.value)} />
                  <button
                    onClick={async () => {
                      if (!manualPlayerName || !manualPlayerPos) return alert('Name and position required')
                      const ok = await adminAction('POST', '/api/players/add', {
                        name: manualPlayerName, position: manualPlayerPos,
                        college: manualPlayerCollege || 'N/A', base_price: 500000
                      })
                      if (ok) { setManualPlayerName(''); setManualPlayerPos(''); setManualPlayerCollege(''); showToast(`✓ ${manualPlayerName} added`) }
                    }}
                    className="btn btn-primary w-full" style={{ padding: '11px', fontSize: '0.8rem' }}>
                    Add Player
                  </button>
                </div>

                <div className="label-dim mb-4">Import Data</div>
                <div className="relative group mb-4">
                  <input type="file" accept=".csv,.xlsx" onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                  <div className="py-10 text-center transition-all"
                    style={{ border: '2px dashed rgba(0,179,65,0.2)', background: 'rgba(0,179,65,0.03)' }}>
                    <div className="text-3xl mb-2">📁</div>
                    <div className="font-mono text-[9px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      Drop CSV / Excel
                    </div>
                  </div>
                </div>
                {importData.length > 0 && (
                  <div className="mb-4">
                    <div className="font-mono text-[9px] tracking-widest uppercase mb-2" style={{ color: 'rgba(0,255,135,0.6)' }}>
                      {importData.length} players parsed
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1 custom-scrollbar">
                      {importData.slice(0, 8).map((p, i) => (
                        <div key={i} className="flex items-center justify-between px-2 py-1"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div className="flex items-center gap-2 min-w-0">
                            {p.image_url && (
                              <span className="text-[8px]" style={{ color: 'var(--electric)' }}>📷</span>
                            )}
                            <span className="font-mono text-[9px] text-white truncate">{p.name}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {p.college && p.college !== 'N/A' && (
                              <span className="font-mono text-[7px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{p.college}</span>
                            )}
                            <span className="font-mono text-[8px] ml-1" style={{ color: 'var(--pitch)' }}>{p.position}</span>
                          </div>
                        </div>
                      ))}
                      {importData.length > 8 && (
                        <div className="font-mono text-[8px] text-center py-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
                          +{importData.length - 8} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {importData.length > 0 && (
                  <button onClick={handleImportSubmit} disabled={importing}
                    className="btn btn-primary w-full mb-3" style={{ padding: '12px', fontSize: '0.8rem' }}>
                    {importing ? 'Importing...' : `Import ${importData.length} Players`}
                  </button>
                )}
                <button onClick={handleClearPlayers}
                  className="w-full font-mono text-[9px] tracking-widest uppercase py-2 transition-colors"
                  style={{ color: 'rgba(239,68,68,0.4)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(239,68,68,0.4)')}>
                  Purge All Players
                </button>
              </div>

              {/* Player grid */}
              <div className="lg:col-span-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="px-6 py-4 flex justify-between items-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="label-dim">Target Archive ({players.length})</div>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto custom-scrollbar">
                  {players.map(p => {
                    const pid = p.id || p._id
                    return (
                      <motion.div layout key={pid}
                        className="relative group flex items-center gap-4 p-4 transition-all"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid var(--pitch)' }}
                      >
                        <button onClick={() => handlePlayerDelete(pid)}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all font-mono text-xs"
                          style={{ color: 'rgba(239,68,68,0.5)' }}>✕</button>
                        <div className="relative shrink-0">
                          <div className="w-12 h-12 rounded-full overflow-hidden border flex items-center justify-center font-headline text-lg"
                            style={{ borderColor: 'rgba(0,179,65,0.3)', background: 'rgba(0,179,65,0.08)', color: 'var(--pitch)' }}>
                            {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : (p.position || 'P')[0]}
                          </div>
                          <label className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                            <span className="font-mono text-[7px] text-white/80">UPLOAD</span>
                            <input type="file" accept="image/*" className="hidden"
                              onChange={e => e.target.files?.[0] && handlePlayerPhoto(pid, e.target.files[0])} />
                          </label>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-sm text-white uppercase truncate">{p.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-[8px] px-1.5 py-0.5 uppercase" style={{ background: 'rgba(0,179,65,0.1)', color: 'var(--pitch)', border: '1px solid rgba(0,179,65,0.2)' }}>
                              {p.position}
                            </span>
                            <span className="font-mono text-[8px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                              ₹{(p.base_price/100000).toFixed(1)}L
                            </span>
                          </div>
                        </div>
                        {p.status !== 'sold' ? (
                          <button
                            onClick={() => { auctionAction('start', { playerId: pid }); setActiveTab('auction') }}
                            className="shrink-0 opacity-0 group-hover:opacity-100 transition-all font-mono text-[8px] tracking-widest uppercase px-2 py-1.5"
                            style={{ background: 'rgba(0,179,65,0.15)', color: 'var(--electric)', border: '1px solid rgba(0,179,65,0.3)' }}>
                            ▶ START
                          </button>
                        ) : (
                          <span className="shrink-0 font-mono text-[8px] px-2 py-1" style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--gold)', border: '1px solid rgba(245,158,11,0.2)' }}>
                            SOLD
                          </span>
                        )}
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── TEAMS TAB ── */}
          {activeTab === 'teams' && (
            <motion.div key="teams"
              initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              {/* Bulk create form */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', padding: '28px' }}>
                <div className="label-dim mb-6">Initialize Franchises</div>
                <div className="space-y-5">
                  <div>
                    <label className="font-mono text-[9px] tracking-widest uppercase block mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      Budget Per Team (₹)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 10000000 (= 1Cr)"
                      className="input-dark"
                      value={bulkBudget}
                      onChange={e => setBulkBudget(e.target.value)}
                    />
                    <div className="font-mono text-[8px] mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
                      {bulkBudget ? `₹${(Number(bulkBudget)/100000).toFixed(1)}L per team` : 'Default: ₹10L'}
                    </div>
                  </div>
                  <div>
                    <label className="font-mono text-[9px] tracking-widest uppercase block mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      Team Names (comma or newline separated)
                    </label>
                    <textarea
                      rows={5}
                      placeholder={'FC United, Red Devils\nor one per line'}
                      className="input-dark w-full resize-none"
                      style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}
                      value={bulkTeamNames}
                      onChange={e => setBulkTeamNames(e.target.value)}
                    />
                  </div>

                  {/* Preview */}
                  {bulkTeamNames.trim() && (
                    <div>
                      <div className="font-mono text-[8px] tracking-widest uppercase mb-2" style={{ color: 'rgba(0,255,135,0.5)' }}>
                        {parseBulkNames(bulkTeamNames).length} teams to create
                      </div>
                      <div className="space-y-1 max-h-28 overflow-y-auto custom-scrollbar">
                        {parseBulkNames(bulkTeamNames).map((n, i) => (
                          <div key={i} className="font-mono text-[9px] px-2 py-1 text-white"
                            style={{ background: 'rgba(0,179,65,0.08)', border: '1px solid rgba(0,179,65,0.15)' }}>
                            {n}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleBulkCreateTeams}
                    disabled={bulkCreating || !bulkTeamNames.trim()}
                    className="btn btn-primary w-full"
                    style={{ padding: '13px', fontSize: '0.85rem', opacity: bulkCreating ? 0.6 : 1 }}
                  >
                    {bulkCreating ? 'Creating...' : 'Create Teams'}
                  </button>
                </div>
              </div>

              {/* Right side: credentials table OR teams list */}
              <div className="lg:col-span-2 space-y-6">

                {/* Credentials table — shown after creation */}
                {createdCredentials.length > 0 && (
                  <div style={{ background: 'rgba(0,179,65,0.05)', border: '1px solid rgba(0,179,65,0.2)' }}>
                    <div className="px-6 py-4 flex items-center justify-between"
                      style={{ borderBottom: '1px solid rgba(0,179,65,0.15)' }}>
                      <div>
                        <div className="font-headline text-xl text-white tracking-wide">Team Credentials</div>
                        <div className="font-mono text-[9px] mt-0.5" style={{ color: 'rgba(0,255,135,0.6)' }}>
                          Share these with team captains — shown once
                        </div>
                      </div>
                      <button
                        onClick={() => downloadCredentialsCSV(teams)}
                        className="btn btn-primary"
                        style={{ padding: '8px 16px', fontSize: '0.75rem' }}
                      >
                        ↓ Download All Teams CSV
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            {['Team Name', 'Login ID', 'Password', 'Budget'].map(h => (
                              <th key={h} className="px-5 py-3 text-left font-mono text-[9px] tracking-widest uppercase"
                                style={{ color: 'rgba(255,255,255,0.3)' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {createdCredentials.map((t, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <td className="px-5 py-3 font-bold text-sm text-white uppercase">{t.name}</td>
                              <td className="px-5 py-3">
                                <span className="font-mono text-sm px-3 py-1"
                                  style={{ background: 'rgba(59,130,246,0.1)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.2)', letterSpacing: '0.15em' }}>
                                  {t.team_id_code}
                                </span>
                              </td>
                              <td className="px-5 py-3">
                                <span className="font-mono text-sm px-3 py-1"
                                  style={{ background: 'rgba(0,179,65,0.1)', color: 'var(--electric)', border: '1px solid rgba(0,179,65,0.2)', letterSpacing: '0.15em' }}>
                                  {t.password}
                                </span>
                              </td>
                              <td className="px-5 py-3 font-mono text-sm" style={{ color: 'var(--gold)' }}>
                                ₹{((t.budget_remaining || 0)/100000).toFixed(1)}L
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Existing teams list */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="label-dim">Deployed Units ({teams.length})</div>
                    {teams.length > 0 && (
                      <button onClick={() => downloadCredentialsCSV(teams)}
                        className="font-mono text-[8px] tracking-widest uppercase px-3 py-1.5"
                        style={{ background: 'rgba(0,179,65,0.1)', color: 'var(--electric)', border: '1px solid rgba(0,179,65,0.2)' }}>
                        ↓ Export All CSV
                      </button>
                    )}
                  </div>
                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto custom-scrollbar">
                    {teams.map(t => (
                      <div key={t.id || t._id}
                        className="flex items-center justify-between p-4 group transition-all"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid var(--pitch)' }}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full overflow-hidden border flex items-center justify-center font-bold text-xs shrink-0"
                            style={{ borderColor: 'rgba(0,179,65,0.3)', background: 'rgba(0,179,65,0.08)', color: 'var(--pitch)' }}>
                            {t.logo_url ? <img src={t.logo_url} className="w-full h-full object-cover" alt="" /> : t.name[0]}
                          </div>
                          <div>
                            <div className="font-bold text-sm text-white uppercase">{t.name}</div>
                            <div className="font-mono text-[8px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                              Budget: <span style={{ color: 'var(--gold)' }}>₹{((t.budget_remaining || 0)/100000).toFixed(1)}L</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => setViewingCreds(t)}
                            className="font-mono text-[8px] px-2 py-1"
                            style={{ background: 'rgba(0,179,65,0.1)', color: 'var(--electric)', border: '1px solid rgba(0,179,65,0.2)' }}
                            title="View credentials"
                          >🔑</button>
                          <button
                            title="Assign Captain (deducts ₹10Cr)"
                            onClick={async () => {
                              if (!confirm(`Assign captain to ${t.name}? This deducts ₹10Cr from their budget.`)) return
                              const ok = await adminAction('POST', '/api/admin/assign-captain', { teamId: t.id || t._id })
                              if (ok) showToast(`✓ Captain assigned to ${t.name}`)
                            }}
                            className="font-mono text-[8px] px-2 py-1"
                            style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--gold)', border: '1px solid rgba(245,158,11,0.2)' }}>
                            👑
                          </button>
                          <button onClick={() => handleDeleteTeam(t.id || t._id)}
                            className="font-mono text-xs"
                            style={{ color: 'rgba(239,68,68,0.5)' }}>✕</button>
                        </div>
                      </div>
                    ))}
                    {teams.length === 0 && (
                      <div className="col-span-2 py-10 text-center font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.15)' }}>
                        No teams yet
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── OVERVIEW TAB ── */}
          {activeTab === 'overview' && (
            <motion.div key="overview"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {/* Top row: Undo + Unsold count */}
              <div className="flex flex-wrap gap-4 items-center">
                <button className="btn" style={{ padding: '10px 24px', fontSize: '0.85rem', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}
                  onClick={() => auctionAction('undo')}>
                  ↩ Undo Last Bid
                </button>
                <div className="font-mono text-[10px] tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {players.filter(p => p.status === 'unsold').length} unsold ·{' '}
                  {players.filter(p => p.status === 'sold').length} sold ·{' '}
                  {players.filter(p => p.status === 'live').length} live
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* UNSOLD PLAYERS */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="label-dim">Unsold Players ({players.filter(p => p.status === 'unsold').length})</div>
                  </div>
                  <div className="max-h-80 overflow-y-auto custom-scrollbar divide-y divide-white/5">
                    {players.filter(p => p.status === 'unsold').length === 0 ? (
                      <div className="py-10 text-center font-mono text-[9px]" style={{ color: 'rgba(255,255,255,0.2)' }}>All players sold or live</div>
                    ) : players.filter(p => p.status === 'unsold').map(p => (
                      <div key={p.id} className="flex items-center justify-between px-5 py-3">
                        <div>
                          <div className="font-bold text-sm text-white uppercase">{p.name}</div>
                          <div className="font-mono text-[8px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                            {p.position} · Base ₹{(p.base_price/100000).toFixed(1)}L
                          </div>
                        </div>
                        <button
                          onClick={() => { auctionAction('start', { playerId: p.id }); setActiveTab('auction') }}
                          className="font-mono text-[8px] px-3 py-1.5 transition-all"
                          style={{ background: 'rgba(0,179,65,0.1)', color: 'var(--electric)', border: '1px solid rgba(0,179,65,0.2)' }}>
                          ▶ START
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* FULL SITUATION — all teams */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="label-dim">Team Situation</div>
                  </div>
                  <div className="max-h-80 overflow-y-auto custom-scrollbar divide-y divide-white/5">
                    {teams.map(t => {
                      const squad = players.filter(p => p.sold_to === (t.id || t._id) && p.status === 'sold')
                      return (
                        <div key={t.id} className="px-5 py-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-bold text-sm text-white uppercase">{t.name}</div>
                            <div className="font-mono text-xs font-bold" style={{ color: 'var(--gold)' }}>
                              ₹{((t.budget_remaining||0)/100000).toFixed(1)}L left
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {squad.length === 0 ? (
                              <span className="font-mono text-[8px]" style={{ color: 'rgba(255,255,255,0.2)' }}>No players yet</span>
                            ) : squad.map(p => (
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

              {/* TRANSFER PLAYER */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="label-dim">Transfer Player to Another Team</div>
                  <div className="font-mono text-[8px] mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    Use this if a player was assigned to the wrong team. Budget adjusts automatically.
                  </div>
                </div>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-72 overflow-y-auto custom-scrollbar">
                  {players.filter(p => p.status === 'sold').map(p => {
                    const currentTeam = teams.find(t => (t.id || t._id) === p.sold_to)
                    return (
                      <div key={p.id} className="flex items-center justify-between p-3 group"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid var(--gold)' }}>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-white uppercase truncate">{p.name}</div>
                          <div className="font-mono text-[8px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                            → {currentTeam?.name || 'Unknown'} · ₹{(p.sold_price/100000).toFixed(1)}L
                          </div>
                        </div>
                        <button
                          onClick={() => { setTransferPlayer(p); setTransferToTeamId('') }}
                          className="shrink-0 font-mono text-[8px] px-2 py-1 ml-2 transition-all"
                          style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--gold)', border: '1px solid rgba(245,158,11,0.2)' }}>
                          Transfer
                        </button>
                      </div>
                    )
                  })}
                  {players.filter(p => p.status === 'sold').length === 0 && (
                    <div className="col-span-3 py-8 text-center font-mono text-[9px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                      No sold players yet
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── DANGER TAB ── */}
          {activeTab === 'danger' && (
            <motion.div key="danger"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="space-y-6 max-w-3xl"
            >
              <div className="mb-2">
                <span className="label-dim">Danger Zone</span>
                <p className="font-mono text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  All actions require confirmation. Broadcasts updated state after completion.
                </p>
              </div>

              {/* 1. Remove ALL Players */}
              <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)', padding: '20px' }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-bold text-sm text-white mb-1">Remove All Players</div>
                    <div className="font-mono text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      Deletes all {players.length} players. Resets auction to waiting.
                    </div>
                  </div>
                  <button className="btn btn-danger shrink-0" style={{ padding: '8px 16px', fontSize: '0.75rem' }}
                    onClick={async () => {
                      if (!confirm(`Delete all ${players.length} players? This cannot be undone.`)) return
                      const ok = await adminAction('POST', '/api/admin/clear-players')
                      if (ok) showToast(`✓ All players removed`)
                    }}>
                    Remove All Players
                  </button>
                </div>
              </div>

              {/* 2. Remove ALL Teams */}
              <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)', padding: '20px' }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-bold text-sm text-white mb-1">Remove All Teams</div>
                    <div className="font-mono text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      Deletes all {teams.length} teams. Their credentials will stop working.
                    </div>
                  </div>
                  <button className="btn btn-danger shrink-0" style={{ padding: '8px 16px', fontSize: '0.75rem' }}
                    onClick={async () => {
                      if (!confirm(`Delete all ${teams.length} teams? Their credentials will stop working.`)) return
                      for (const t of teams) {
                        await adminAction('DELETE', `/api/admin/teams/${t.id || t._id}`)
                      }
                      showToast(`✓ All teams removed`)
                    }}>
                    Remove All Teams
                  </button>
                </div>
              </div>

              {/* 3. Remove Specific Player */}
              <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)', padding: '20px' }}>
                <div className="font-bold text-sm text-white mb-3">Remove Specific Player</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {players.map(p => (
                    <div key={p.id} className="flex items-center justify-between px-3 py-2"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div>
                        <div className="font-bold text-xs text-white uppercase">{p.name}</div>
                        <div className="font-mono text-[8px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{p.position} · {p.status}</div>
                      </div>
                      <button
                        className="font-mono text-[8px] px-2 py-1 transition-colors"
                        style={{ color: 'rgba(239,68,68,0.5)', border: '1px solid rgba(239,68,68,0.2)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(239,68,68,0.5)')}
                        onClick={async () => {
                          if (!confirm(`Remove ${p.name}?`)) return
                          const ok = await adminAction('DELETE', `/api/admin/players/${p.id}`)
                          if (ok) showToast(`✓ ${p.name} removed`)
                        }}>
                        Remove
                      </button>
                    </div>
                  ))}
                  {players.length === 0 && (
                    <div className="col-span-2 py-4 text-center font-mono text-[9px]" style={{ color: 'rgba(255,255,255,0.2)' }}>No players</div>
                  )}
                </div>
              </div>

              {/* 4. Remove Specific Team */}
              <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)', padding: '20px' }}>
                <div className="font-bold text-sm text-white mb-3">Remove Specific Team</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {teams.map(t => {
                    const squadCount = players.filter(p => p.sold_to === (t.id || t._id)).length
                    return (
                      <div key={t.id} className="flex items-center justify-between px-3 py-2"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div>
                          <div className="font-bold text-xs text-white uppercase">{t.name}</div>
                          <div className="font-mono text-[8px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                            {squadCount} players · ₹{((t.budget_remaining||0)/100000).toFixed(1)}L left
                          </div>
                        </div>
                        <button
                          className="font-mono text-[8px] px-2 py-1 transition-colors"
                          style={{ color: 'rgba(239,68,68,0.5)', border: '1px solid rgba(239,68,68,0.2)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(239,68,68,0.5)')}
                          onClick={async () => {
                            if (!confirm(`Remove ${t.name} and release their ${squadCount} players back to unsold pool?`)) return
                            const ok = await adminAction('DELETE', `/api/admin/teams/${t.id || t._id}`)
                            if (ok) showToast(`✓ ${t.name} removed, players released`)
                          }}>
                          Remove
                        </button>
                      </div>
                    )
                  })}
                  {teams.length === 0 && (
                    <div className="col-span-2 py-4 text-center font-mono text-[9px]" style={{ color: 'rgba(255,255,255,0.2)' }}>No teams</div>
                  )}
                </div>
              </div>

              {/* 5. Full Reset — Nuclear */}
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '2px solid rgba(239,68,68,0.25)', padding: '24px' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">☢️</span>
                  <div className="font-bold text-base" style={{ color: '#fca5a5' }}>Full Reset — Nuclear Option</div>
                </div>
                <div className="font-mono text-[9px] mb-5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Clears EVERYTHING: players, teams, auction state, logs, history. Cannot be undone.
                  Type <span style={{ color: '#fca5a5' }}>RESET</span> to confirm.
                </div>
                <div className="flex gap-3">
                  <input
                    type="text" placeholder='Type "RESET" to confirm'
                    className="input-dark flex-1"
                    style={{ borderColor: 'rgba(239,68,68,0.3)' }}
                    value={resetConfirm}
                    onChange={e => setResetConfirm(e.target.value)}
                  />
                  <button
                    disabled={resetConfirm !== 'RESET'}
                    className="btn btn-danger shrink-0"
                    style={{ padding: '12px 20px', opacity: resetConfirm !== 'RESET' ? 0.4 : 1, cursor: resetConfirm !== 'RESET' ? 'not-allowed' : 'none' }}
                    onClick={async () => {
                      if (resetConfirm !== 'RESET') return
                      if (!confirm('FINAL WARNING: This will delete everything. Are you absolutely sure?')) return
                      const ok = await adminAction('POST', '/api/admin/reset')
                      if (ok) { setResetConfirm(''); showToast('✓ Full reset complete') }
                    }}>
                    Full Reset
                  </button>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* TRANSFER PLAYER modal */}
      <AnimatePresence>
        {transferPlayer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
              className="w-full max-w-md"
              style={{ background: 'var(--bg-pitch)', border: '1px solid rgba(245,158,11,0.25)', padding: '36px' }}>
              <div className="text-center mb-6">
                <div className="text-3xl mb-3">🔄</div>
                <h2 className="font-headline text-3xl tracking-widest text-white mb-1">Transfer Player</h2>
                <div className="font-mono text-sm mt-1" style={{ color: 'var(--gold)' }}>{transferPlayer.name}</div>
                <div className="font-mono text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Currently: {teams.find(t => t.id === transferPlayer.sold_to)?.name || 'Unknown'} · ₹{(transferPlayer.sold_price/100000).toFixed(1)}L
                </div>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar mb-6">
                {teams.filter(t => (t.id || t._id) !== transferPlayer.sold_to).map(t => (
                  <button key={t.id} onClick={() => setTransferToTeamId(t.id)}
                    className="w-full flex items-center justify-between px-4 py-3 transition-all"
                    style={{
                      background: transferToTeamId === t.id ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${transferToTeamId === t.id ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    }}>
                    <span className="font-bold text-sm text-white uppercase">{t.name}</span>
                    <span className="font-mono text-xs" style={{
                      color: (t.budget_remaining||0) >= transferPlayer.sold_price ? 'var(--electric)' : 'rgba(239,68,68,0.7)'
                    }}>
                      ₹{((t.budget_remaining||0)/100000).toFixed(1)}L
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setTransferPlayer(null); setTransferToTeamId('') }}
                  className="flex-1 py-3 font-mono text-[9px] tracking-widest uppercase"
                  style={{ color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  Cancel
                </button>
                <button
                  disabled={!transferToTeamId}
                  className="flex-1 btn btn-gold"
                  style={{ padding: '12px', fontSize: '0.85rem', opacity: transferToTeamId ? 1 : 0.4 }}
                  onClick={async () => {
                    if (!transferToTeamId) return
                    const ok = await adminAction('POST', '/api/admin/transfer-player', {
                      playerId: transferPlayer.id,
                      toTeamId: Number(transferToTeamId)
                    })
                    if (ok) {
                      showToast(`✓ ${transferPlayer.name} transferred`)
                      setTransferPlayer(null); setTransferToTeamId('')
                    }
                  }}>
                  Confirm Transfer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SELL — pick winning team modal */}
      <AnimatePresence>
        {sellModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
              className="w-full max-w-md"
              style={{ background: 'var(--bg-pitch)', border: '1px solid rgba(245,158,11,0.25)', padding: '36px' }}>
              <div className="text-center mb-6">
                <div className="text-3xl mb-3">🏆</div>
                <h2 className="font-headline text-3xl tracking-widest text-white mb-1">
                  Sell {currentPlayer?.name || 'Player'}
                </h2>
                <div className="font-mono text-sm mt-1" style={{ color: 'var(--gold)' }}>
                  Final Price: ₹{(currentBid / 100000).toFixed(1)}L
                </div>
                <p className="font-mono text-[9px] tracking-widest uppercase mt-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Select the winning team
                </p>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar mb-6">
                {teams.map(t => (
                  <button key={t.id} onClick={() => setSellTeamId(t.id)}
                    className="w-full flex items-center justify-between px-4 py-3 transition-all"
                    style={{
                      background: sellTeamId === t.id ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${sellTeamId === t.id ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden border flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ borderColor: 'rgba(0,179,65,0.3)', background: 'rgba(0,179,65,0.08)', color: 'var(--pitch)' }}>
                        {t.logo_url ? <img src={t.logo_url} className="w-full h-full object-cover" alt="" /> : t.name[0]}
                      </div>
                      <span className="font-bold text-sm text-white uppercase">{t.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Budget</div>
                      <div className="font-mono text-xs font-bold" style={{
                        color: (t.budget_remaining || 0) >= currentBid ? 'var(--electric)' : 'rgba(239,68,68,0.7)'
                      }}>
                        ₹{((t.budget_remaining || 0)/100000).toFixed(1)}L
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setSellModalOpen(false)}
                  className="flex-1 py-3 font-mono text-[9px] tracking-widest uppercase"
                  style={{ color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  Cancel
                </button>
                <button
                  disabled={!sellTeamId}
                  className="flex-1 btn btn-gold"
                  style={{ padding: '12px', fontSize: '0.9rem', opacity: sellTeamId ? 1 : 0.4 }}
                  onClick={async () => {
                    if (!sellTeamId) return
                    await auctionAction('sell', { teamId: Number(sellTeamId) })
                    setSellModalOpen(false); setSellTeamId('')
                  }}>
                  Confirm Sale
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Single team credentials modal */}
      <AnimatePresence>
        {viewingCreds && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
            onClick={() => setViewingCreds(null)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm"
              style={{ background: 'var(--bg-pitch)', border: '1px solid rgba(0,179,65,0.25)', padding: '36px' }}>
              <div className="text-center mb-8">
                <div className="text-3xl mb-3">🔑</div>
                <h2 className="font-headline text-3xl tracking-widest text-white">{viewingCreds.name}</h2>
                <p className="font-mono text-[9px] tracking-widest uppercase mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Team Credentials
                </p>
              </div>
              <div className="space-y-4">
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '16px' }}>
                  <div className="font-mono text-[9px] tracking-widest uppercase mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Login ID</div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xl tracking-[0.3em]" style={{ color: '#93c5fd' }}>
                      {viewingCreds.team_id_code || '—'}
                    </span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(viewingCreds.team_id_code || ''); showToast('✓ ID copied') }}
                      className="font-mono text-[8px] px-3 py-1.5"
                      style={{ background: 'rgba(59,130,246,0.1)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.2)' }}>
                      COPY
                    </button>
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '16px' }}>
                  <div className="font-mono text-[9px] tracking-widest uppercase mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Password</div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xl tracking-[0.3em]" style={{ color: 'var(--electric)' }}>
                      {viewingCreds.password || '—'}
                    </span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(viewingCreds.password || ''); showToast('✓ Password copied') }}
                      className="font-mono text-[8px] px-3 py-1.5"
                      style={{ background: 'rgba(0,179,65,0.1)', color: 'var(--electric)', border: '1px solid rgba(0,179,65,0.2)' }}>
                      COPY
                    </button>
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '12px 16px' }}>
                  <div className="flex justify-between font-mono text-[9px]">
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>Budget</span>
                    <span style={{ color: 'var(--gold)' }}>₹{((viewingCreds.budget_remaining || 0)/100000).toFixed(1)}L</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setViewingCreds(null)}
                className="w-full mt-6 font-mono text-[9px] tracking-widest uppercase py-3 transition-colors"
                style={{ color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}>
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 px-6 py-3 font-mono text-sm font-bold"
            style={{ background: 'var(--pitch)', color: '#fff', boxShadow: '0 4px 20px rgba(0,179,65,0.4)', whiteSpace: 'nowrap' }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ACTIVITY LOG — fixed bottom panel ── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 transition-all duration-300"
        style={{ maxHeight: logOpen ? 260 : 40 }}>
        {/* Header bar */}
        <button
          onClick={() => setLogOpen(o => !o)}
          className="w-full flex items-center justify-between px-6 py-2.5 transition-colors"
          style={{ background: 'rgba(7,26,14,0.97)', borderTop: '1px solid rgba(0,179,65,0.2)', backdropFilter: 'blur(12px)' }}
        >
          <div className="flex items-center gap-3">
            <span className="live-dot" style={{ width: 6, height: 6 }} />
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-white">Activity Log</span>
            {activityLog.length > 0 && (
              <span className="font-mono text-[8px] px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(0,179,65,0.2)', color: 'var(--electric)' }}>
                {activityLog.length}
              </span>
            )}
          </div>
          <span className="font-mono text-[10px] transition-transform duration-300"
            style={{ color: 'rgba(255,255,255,0.3)', transform: logOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▲</span>
        </button>

        {/* Log entries */}
        {logOpen && (
          <div className="overflow-y-auto custom-scrollbar"
            style={{ maxHeight: 218, background: 'rgba(4,13,7,0.97)', borderTop: '1px solid rgba(0,179,65,0.1)' }}>
            {activityLog.length === 0 ? (
              <div className="py-6 text-center font-mono text-[9px] tracking-widest" style={{ color: 'rgba(255,255,255,0.15)' }}>
                No activity yet...
              </div>
            ) : activityLog.map((entry, i) => {
              const iconMap: Record<string, string> = {
                join: '🟢', bid: '💰', sold: '🏆', pass: '⏭️', reveal: '👁️'
              }
              const colorMap: Record<string, string> = {
                join: 'rgba(0,255,135,0.7)', bid: 'rgba(245,158,11,0.8)',
                sold: '#f59e0b', pass: 'rgba(255,255,255,0.3)', reveal: 'rgba(147,197,253,0.8)'
              }
              return (
                <div key={i} className="flex items-start gap-3 px-5 py-2.5"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <span className="text-sm shrink-0 mt-0.5">{iconMap[entry.event_type] || '•'}</span>
                  <span className="font-mono text-[10px] flex-1"
                    style={{ color: colorMap[entry.event_type] || 'rgba(255,255,255,0.5)' }}>
                    {entry.message}
                  </span>
                  <span className="font-mono text-[8px] shrink-0 mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    {new Date(entry.created_at).toLocaleTimeString()}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Manual override modal */}
      <AnimatePresence>
        {customSaleOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm"
              style={{ background: 'var(--bg-pitch)', border: '1px solid rgba(0,179,65,0.2)', padding: '36px' }}>
              <div className="text-center mb-8">
                <h2 className="font-headline text-3xl tracking-widest text-white mb-1">Direct Override</h2>
                <p className="font-mono text-[9px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Manual Player Assignment
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="font-mono text-[9px] tracking-widest uppercase block mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Player</label>
                  <select className="input-dark w-full" value={salePlayerId} onChange={e => setSalePlayerId(e.target.value)}>
                    <option value="">— select player —</option>
                    {players.filter(p => p.status !== 'sold').map(p => (
                      <option key={p.id || p._id} value={p.id || p._id}>{p.name} ({p.position})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-mono text-[9px] tracking-widest uppercase block mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Team</label>
                  <select className="input-dark w-full" value={saleTeamId} onChange={e => setSaleTeamId(e.target.value)}>
                    <option value="">— select team —</option>
                    {teams.map(t => <option key={t.id || t._id} value={t.id || t._id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-mono text-[9px] tracking-widest uppercase block mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Price (Lakhs)</label>
                  <input type="number" step="0.5" placeholder="e.g. 25" className="input-dark w-full"
                    value={salePrice} onChange={e => setSalePrice(e.target.value)} />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setCustomSaleOpen(false)}
                    className="flex-1 py-3 font-mono text-[9px] tracking-widest uppercase transition-colors"
                    style={{ color: 'rgba(255,255,255,0.3)' }}>Abort</button>
                  <button className="flex-1 btn btn-gold" style={{ padding: '12px', fontSize: '0.8rem' }}
                    onClick={async () => {
                      if (!salePlayerId || !saleTeamId || !salePrice) return alert('All fields required')
                      await auctionAction('custom-sell', { playerId: salePlayerId, teamId: saleTeamId, price: Number(salePrice) * 100000 })
                      setCustomSaleOpen(false); setSalePlayerId(''); setSaleTeamId(''); setSalePrice('')
                    }}>Execute</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
