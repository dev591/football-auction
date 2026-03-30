const { supabase } = require('../supabase');

const SQUAD_LIMITS = {
  Goalkeeper: 1,
  Defender: 4,
  Midfielder: 5,
  Forward: 5,
  TOTAL: 15,
};

let currentBidHistory = [];
const onlineTeams = new Map(); // socket.id -> team object

// ── Activity log helper ──────────────────────
async function logEvent(io, event_type, message) {
  try {
    await supabase.from('auction_logs').insert({ event_type, message })
  } catch (_) {}
  if (io) io.emit('auction:log', { event_type, message, created_at: new Date().toISOString() })
}

// Ensure auction_state row id=1 exists on startup
async function initAuctionState() {
  try {
    const { error } = await supabase
      .from('auction_state')
      .upsert({ id: 1, status: 'waiting', current_bid: 0, current_player_id: null, current_bidder_team_id: null }, { onConflict: 'id', ignoreDuplicates: true })
    if (error) console.warn('[INIT] auction_state upsert warning:', error.message)
    else console.log('[INIT] auction_state row confirmed.')
  } catch (err) {
    console.warn('[INIT] Could not init auction_state:', err.message)
  }
}

initAuctionState()

async function getFullState() {
  const { data: auctionRows, error: auctionError } = await supabase
    .from('auction_state')
    .select('*')
    .eq('id', 1)
    .single();

  if (auctionError) throw auctionError;

  const auction = auctionRows || {};

  const [{ data: players, error: playersError }, { data: teams, error: teamsError }, { data: history, error: historyError }] =
    await Promise.all([
      supabase.from('players').select('*').order('id', { ascending: true }),
      supabase.from('teams').select('*').order('id', { ascending: true }),
      supabase
        .from('auction_history')
        .select('id, player_id, team_id, final_price, sold_at, players(name), teams(name)')
        .order('sold_at', { ascending: false })
        .limit(15),
    ]);

  if (playersError) throw playersError;
  if (teamsError) throw teamsError;
  if (historyError) throw historyError;

  const currentPlayer =
    auction.current_player_id && players
      ? players.find((p) => p.id === auction.current_player_id)
      : null;

  const currentBidderTeam =
    auction.current_bidder_team_id && teams
      ? teams.find((t) => t.id === auction.current_bidder_team_id)
      : null;

  const safePlayers = players || [];
  const safeTeams = teams || [];

  const teamsWithPlayers = safeTeams.map(t => ({
    ...t,
    players: safePlayers.filter(p => p.sold_to === t.id && p.status === 'sold')
  }));

  const mappedHistory = (history || []).map((h) => {
    const p = safePlayers.find((pRow) => pRow.id === h.player_id) || null;
    const t = safeTeams.find((tRow) => tRow.id === h.team_id) || null;

    const pJoined = h.players
      ? Array.isArray(h.players)
        ? h.players[0]
        : h.players
      : null;
    const tJoined = h.teams
      ? Array.isArray(h.teams)
        ? h.teams[0]
        : h.teams
      : null;

    const playerName = pJoined?.name || p?.name || '';
    const teamName = tJoined?.name || t?.name || (h.team_id ? '' : 'Unsold');

    return {
      id: h.id,
      player_id: h.player_id,
      team_id: h.team_id,
      final_price: h.final_price,
      sold_at: h.sold_at,
      amount: h.final_price,
      playerName,
      teamName,
      player: p || {
        id: h.player_id,
        name: playerName,
      },
      team: t || (h.team_id
        ? {
            id: h.team_id,
            name: teamName,
          }
        : null),
    };
  });

  return {
    auction,
    currentBid: auction.current_bid || 0,
    players: safePlayers,
    teams: teamsWithPlayers,
    currentPlayer,
    currentBidderTeam: currentBidderTeam ? teamsWithPlayers.find(t => t.id === currentBidderTeam.id) : null,
    history: mappedHistory,
    currentBidHistory,
    onlineCount: onlineTeams.size,
    onlineTeams: Array.from(onlineTeams.values()),
  };
}

async function broadcastState(io, extraEvent = null, extraPayload = {}) {
  const fullState = await getFullState();

  io.emit('auction:state', fullState);
  io.emit('teams:updated', { teams: fullState.teams, fullState });
  io.emit('players:updated', { players: fullState.players, fullState });

  if (extraEvent) {
    io.emit(extraEvent, { ...extraPayload, fullState });
  }
}

async function startAuctionPhase(io, { phase }) {
  const { error } = await supabase
    .from('auction_state')
    .update({ status: phase })
    .eq('id', 1);

  if (error) throw error;
  await broadcastState(io);
}

async function revealRandomPlayer(io) {
  // 1. Get all unsold players
  const { data: unsold, error: fetchError } = await supabase
    .from('players')
    .select('id, base_price')
    .eq('status', 'unsold');

  if (fetchError || !unsold || unsold.length === 0) {
    throw new Error(unsold?.length === 0 ? 'No unsold players left' : 'Failed to fetch unsold players');
  }

  // 2. Pick a random one
  const randomIndex = Math.floor(Math.random() * unsold.length);
  const player = unsold[randomIndex];

  // 3. Update state to reveal
  const { error: auctionError } = await supabase
    .from('auction_state')
    .update({
      current_player_id: player.id,
      current_bid: player.base_price,
      current_bidder_team_id: null,
      status: 'reveal',
    })
    .eq('id', 1);

  if (auctionError) throw auctionError;

  // 4. Mark player as live
  await supabase.from('players').update({ status: 'live' }).eq('id', player.id);

  currentBidHistory = [];
  await logEvent(io, 'reveal', `Player revealed: ${(await supabase.from('players').select('name').eq('id', player.id).single()).data?.name || player.id}`)
  await broadcastState(io);
}

async function startAuction(io, { playerId }) {
  // ... existing startAuction logic if needed, but we'll mostly use revealRandomPlayer now
  // For manual start from pool:
  if (!playerId) throw new Error('playerId is required');

  const { data: player } = await supabase.from('players').select('*').eq('id', playerId).single();
  if (!player) throw new Error('Player not found');

  await supabase.from('players').update({ status: 'live' }).eq('id', playerId);
  await supabase.from('auction_state').update({
    id: 1, current_player_id: playerId, current_bid: player.base_price, current_bidder_team_id: null, status: 'live'
  }).eq('id', 1);

  currentBidHistory = [];
  await broadcastState(io);
}

// Increment is now passed in from the controller UI — no hardcoded logic needed
// Auto-increment fallback: 5L under 1Cr, 10L at/above 1Cr
function getAutoIncrement(currentBid) {
  return currentBid >= 10000000 ? 1000000 : 500000
}

async function placeBid(io, { increment }) {
  const { data: auction, error: auctionError } = await supabase
    .from('auction_state')
    .select('*')
    .eq('id', 1)
    .single();

  console.log('[BID HIT] auction status:', auction?.status, '| current_bid:', auction?.current_bid, '| current_player_id:', auction?.current_player_id, '| increment:', increment)

  if (auctionError) {
    console.error('[BID ERROR] Supabase error:', auctionError.message)
    throw new Error('Failed to read auction state: ' + auctionError.message)
  }

  if (!auction?.current_player_id) {
    throw new Error('No player is currently up for auction. Start a player first.');
  }

  const safeIncrement = (increment && increment > 0)
    ? parseInt(increment, 10)
    : getAutoIncrement(auction.current_bid || 0);

  const newBid = (auction.current_bid || 0) + safeIncrement;

  // Enforce Max Cap of 10 Crore
  if (newBid > 100000000) {
    throw new Error('Maximum bid limit of 10 Crore reached');
  }

  const { error: updateError } = await supabase
    .from('auction_state')
    .update({ current_bid: newBid })
    .eq('id', 1);

  if (updateError) throw updateError;

  currentBidHistory.unshift({
    amount: newBid,
    timestamp: new Date().toISOString()
  });

  await logEvent(io, 'bid', `Bid increased to ₹${(newBid/100000).toFixed(1)}L`)
  await broadcastState(io, 'auction:bid', {
    currentBid: newBid,
  });
}

async function computeSquadCounts() {
  const { data: soldPlayers, error } = await supabase
    .from('players')
    .select('sold_to, position')
    .eq('status', 'sold');

  if (error) throw error;

  const countsByTeam = {};

  for (const p of soldPlayers || []) {
    if (!p.sold_to) continue;
    if (!countsByTeam[p.sold_to]) {
      countsByTeam[p.sold_to] = {
        total: 0,
        Goalkeeper: 0,
        Defender: 0,
        Midfielder: 0,
        Forward: 0,
      };
    }
    countsByTeam[p.sold_to].total += 1;
    if (countsByTeam[p.sold_to][p.position] !== undefined) {
      countsByTeam[p.sold_to][p.position] += 1;
    }
  }

  return countsByTeam;
}

async function sellPlayer(io, { teamId }) {
  const { data: auction, error: auctionError } = await supabase
    .from('auction_state')
    .select('*')
    .eq('id', 1)
    .single();

  if (auctionError || !auction || !auction.current_player_id) {
    throw new Error('No live auction');
  }

  if (!teamId) {
    throw new Error('teamId is required — pick the winning team');
  }

  const numericTeamId = parseInt(teamId, 10);

  const { data: player, error: playerError } = await supabase
    .from('players').select('*').eq('id', auction.current_player_id).single();
  if (playerError || !player) throw new Error('Player not found');

  const { data: team, error: teamError } = await supabase
    .from('teams').select('*').eq('id', numericTeamId).single();
  if (teamError || !team) throw new Error('Team not found');

  if (team.budget_remaining < auction.current_bid) {
    throw new Error(`${team.name} has insufficient budget (₹${(team.budget_remaining/100000).toFixed(1)}L remaining)`);
  }

  const newBudget = team.budget_remaining - auction.current_bid;

  await supabase.from('teams').update({ budget_remaining: newBudget }).eq('id', numericTeamId);
  await supabase.from('players').update({ status: 'sold', sold_to: numericTeamId, sold_price: auction.current_bid }).eq('id', player.id);
  await supabase.from('auction_history').insert({ player_id: player.id, team_id: numericTeamId, final_price: auction.current_bid });
  await supabase.from('auction_state').update({ current_player_id: null, current_bid: 0, current_bidder_team_id: null, status: 'waiting' }).eq('id', 1);

  currentBidHistory = [];
  await logEvent(io, 'sold', `${player.name} sold to ${team.name} for ₹${(auction.current_bid/100000).toFixed(1)}L`)
  await broadcastState(io, 'auction:sold', { player, team, amount: auction.current_bid });
}

async function passPlayer(io) {
  const { data: auction, error: auctionError } = await supabase
    .from('auction_state')
    .select('*')
    .eq('id', 1)
    .single();

  if (auctionError || !auction || !auction.current_player_id) {
    throw new Error('No live auction');
  }

  const { data: player, error: fetchPlayerError } = await supabase
    .from('players')
    .select('id, name')
    .eq('id', auction.current_player_id)
    .single();

  if (fetchPlayerError || !player) {
    throw new Error('Player not found');
  }

  // record pass/unsold in history with final_price 0 and no team
  const { error: historyError } = await supabase.from('auction_history').insert({
    player_id: player.id,
    team_id: null,
    final_price: 0,
  });

  if (historyError) throw historyError;

  const { error: playerUpdateError } = await supabase
    .from('players')
    .update({ status: 'unsold', sold_to: null, sold_price: 0 })
    .eq('id', auction.current_player_id);

  if (playerUpdateError) throw playerUpdateError;

  const { error: resetAuctionError } = await supabase
    .from('auction_state')
    .update({
      current_player_id: null,
      current_bid: 0,
      current_bidder_team_id: null,
      status: 'waiting',
    })
    .eq('id', 1);

  if (resetAuctionError) throw resetAuctionError;

  await logEvent(io, 'pass', `${player?.name || 'Player'} passed / unsold`)
  await broadcastState(io, 'auction:pass', {
    playerName: player?.name || 'Player',
    playerId: player.id,
  });
}

async function undoBid(io) {
  if (currentBidHistory.length === 0) {
    throw new Error('No bids to undo');
  }

  // Remove current bid
  currentBidHistory.shift();

  let newBid = 0;
  let newTeamId = null;

  if (currentBidHistory.length > 0) {
    newBid = currentBidHistory[0].amount;
    // Find team id by name (or we should have stored teamId in history)
    const { data: team } = await supabase
      .from('teams')
      .select('id')
      .eq('name', currentBidHistory[0].teamName)
      .single();
    newTeamId = team ? team.id : null;
  } else {
    // Revert to base price
    const { data: auction } = await supabase
      .from('auction_state')
      .select('current_player_id')
      .eq('id', 1)
      .single();
    
    if (auction?.current_player_id) {
      const { data: player } = await supabase
        .from('players')
        .select('base_price')
        .eq('id', auction.current_player_id)
        .single();
      newBid = player?.base_price || 0;
    }
  }

  const { error: updateError } = await supabase
    .from('auction_state')
    .update({
      current_bid: newBid,
      current_bidder_team_id: newTeamId,
    })
    .eq('id', 1);

  if (updateError) throw updateError;

  await broadcastState(io, 'auction:bid', {
    currentBid: newBid,
    bidderTeamId: newTeamId,
  });
}

async function customSell(io, { playerId, teamId, price }) {
  if (!playerId || !teamId || !price) {
    throw new Error('playerId, teamId, and price are required');
  }

  const numericPrice = parseInt(price, 10);

  const [{ data: player }, { data: team }] = await Promise.all([
    supabase.from('players').select('*').eq('id', playerId).single(),
    supabase.from('teams').select('*').eq('id', teamId).single(),
  ]);

  if (!player || !team) {
    throw new Error('Player or Team not found');
  }

  if (team.budget_remaining < numericPrice) {
    throw new Error('Team budget insufficient');
  }

  // Same logic as sellPlayer but with manual values
  const { error: teamUpdateError } = await supabase
    .from('teams')
    .update({ budget_remaining: team.budget_remaining - numericPrice })
    .eq('id', team.id);

  if (teamUpdateError) throw teamUpdateError;

  const { error: playerUpdateError } = await supabase
    .from('players')
    .update({
      status: 'sold',
      sold_to: team.id,
      sold_price: numericPrice,
    })
    .eq('id', player.id);

  if (playerUpdateError) throw playerUpdateError;

  await supabase.from('auction_history').insert({
    player_id: player.id,
    team_id: team.id,
    final_price: numericPrice,
  });

  // If this was the current auction player, reset state
  const { data: auction } = await supabase.from('auction_state').select('*').eq('id', 1).single();
  if (auction?.current_player_id === playerId) {
    await supabase.from('auction_state').update({
      current_player_id: null,
      current_bid: 0,
      current_bidder_team_id: null,
      status: 'waiting',
    }).eq('id', 1);
    currentBidHistory = [];
  }

  await broadcastState(io, 'auction:sold', {
    player,
    team,
    amount: numericPrice,
  });
}

function registerAuctionSocket(io, socket) {
  socket.on('auction:join', async ({ teamId, teamName }) => {
    if (teamId) {
      onlineTeams.set(socket.id, { id: teamId, name: teamName });
      console.log(`[SOCKET] Team ${teamName} joined. Online: ${onlineTeams.size}`);

      // Mark team as in_lobby in DB
      await supabase.from('teams').update({ in_lobby: true }).eq('id', teamId)

      await logEvent(io, 'join', `Team "${teamName}" joined the lobby`)
      broadcastState(io);
    }
  });

  socket.on('disconnect', () => {
    if (onlineTeams.has(socket.id)) {
      const team = onlineTeams.get(socket.id);
      onlineTeams.delete(socket.id);
      console.log(`[SOCKET] Team ${team.name} left. Online: ${onlineTeams.size}`);
      broadcastState(io);
    }
  });

  socket.on('auction:request_state', async () => {
    try {
      const fullState = await getFullState();
      socket.emit('auction:state', fullState);
    } catch (err) {
      socket.emit('error', { error: err.message || 'Failed to get auction state' });
    }
  });
}

module.exports = {
  registerAuctionSocket,
  getFullState,
  broadcastState,
  startAuction,
  placeBid,
  revealRandomPlayer,
  startAuctionPhase,
  sellPlayer,
  passPlayer,
  undoBid,
  customSell,
  logEvent,
};

