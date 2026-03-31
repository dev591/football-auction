const express = require('express');
const { supabase } = require('../supabase');
const { getFullState, logEvent } = require('../socket/auctionSocket');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

function createAdminRouter(io) {
  const router = express.Router();

  router.post('/reset', async (_req, res) => {
    try {
      console.log('[RESET] Starting auction reset...');
      // 1. Delete all auction history
      console.log('[RESET] 1. Deleting auction_history rows...');
      const { error: historyError } = await supabase.from('auction_history').delete().neq('id', -1);
      if (historyError) {
        console.error('[RESET] Failed to clear auction history:', historyError);
        return res
          .status(500)
          .json({ error: historyError.message || 'Failed to clear auction history' });
      }

      // 2. Delete all players
      console.log('[RESET] 2. Deleting all players...');
      const { error: playersError } = await supabase.from('players').delete().neq('id', -1);
      if (playersError) {
        console.error('[RESET] Failed to clear players:', playersError);
        return res
          .status(500)
          .json({ error: playersError.message || 'Failed to clear players' });
      }

      // 3. Delete all teams
      console.log('[RESET] 3. Deleting all teams...');
      const { error: teamsError } = await supabase.from('teams').delete().neq('id', -1);
      if (teamsError) {
        console.error('[RESET] Failed to reset teams:', teamsError);
        return res
          .status(500)
          .json({ error: teamsError.message || 'Failed to reset teams' });
      }

      // 5. Reset auction_state row
      console.log('[RESET] 4. Resetting auction_state...');
      const { error: stateError } = await supabase
        .from('auction_state')
        .upsert(
          {
            id: 1,
            current_player_id: null,
            current_bid: 0,
            current_bidder_team_id: null,
            status: 'waiting',
          },
          { onConflict: 'id' }
        );
      if (stateError) {
        console.error('[RESET] Failed to reset auction state:', stateError);
        return res
          .status(500)
          .json({ error: stateError.message || 'Failed to reset auction state' });
      }

      // 6–8. Emit reset + fresh state
      console.log('[RESET] 5. Fetching fresh state and emitting events...');
      const fullState = await getFullState();

      io.emit('auction:reset', { fullState });
      io.emit('teams:updated', { teams: fullState.teams || [], fullState });
      io.emit('players:updated', { players: fullState.players || [], fullState });

      console.log('[RESET] Complete! Emitted events and returning success.');
      return res.json({ success: true, message: 'Auction reset complete' });
    } catch (err) {
      console.error('[RESET] Unexpected error during reset:', err);
      return res.status(500).json({
        error: err.message || 'Failed to reset auction',
      });
    }
  });

  router.post('/clear-unsold', async (_req, res) => {
    try {
      const { error: delError } = await supabase
        .from('players')
        .delete()
        .eq('status', 'unsold');
      if (delError) {
        return res
          .status(500)
          .json({ error: delError.message || 'Failed to clear unsold players' });
      }

      const fullState = await getFullState();
      io.emit('players:updated', { players: fullState.players || [], fullState });

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({
        error: err.message || 'Failed to clear unsold players',
      });
    }
  });

  router.post('/clear-players', async (_req, res) => {
    try {
      const { error: delError } = await supabase
        .from('players')
        .delete()
        .neq('id', -1); // Delete all
        
      if (delError) {
        return res.status(500).json({ error: delError.message || 'Failed to clear players' });
      }

      const fullState = await getFullState();
      io.emit('players:updated', { players: fullState.players || [], fullState });

      return res.json({ success: true, message: 'All players cleared' });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Failed to clear players' });
    }
  });

  router.post('/add-team', upload.single('logo'), async (req, res) => {
    const { name, owner } = req.body || {};

    if (!name || !owner) {
      return res.status(400).json({ error: 'name and owner are required' });
    }

    try {
      const { data: inserted, error: insertError } = await supabase
        .from('teams')
        .insert({
          name,
          owner,
          color: '#ffffff',
          logo_emoji: '⚽',
          budget_remaining: 250000000
        })
        .select('*')
        .single();

      if (insertError) {
        return res.status(500).json({ error: insertError.message || 'Failed to add team' });
      }

      let finalTeam = inserted;

      if (req.file) {
        const timestamp = Date.now();
        const filePath = `teams/${inserted.id}/${timestamp}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('team-logos')
          .upload(filePath, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: true
          });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from('team-logos')
            .getPublicUrl(filePath);

          if (publicUrlData?.publicUrl) {
            const { data: updatedTeam, error: updateError } = await supabase
              .from('teams')
              .update({ logo_url: publicUrlData.publicUrl })
              .eq('id', inserted.id)
              .select('*')
              .single();

            if (!updateError && updatedTeam) {
              finalTeam = updatedTeam;
            }
          }
        }
      }

      const fullState = await getFullState();
      io.emit('teams:updated', { teams: fullState.teams || [], fullState });

      return res.json({ success: true, team: finalTeam });
    } catch (err) {
      return res.status(500).json({
        error: err.message || 'Failed to add team',
      });
    }
  });

  // Bulk team creation with auto-generated passwords
  router.post('/bulk-add-teams', async (req, res) => {
    const { teams: teamNames, budget } = req.body || {}

    if (!Array.isArray(teamNames) || teamNames.length === 0) {
      return res.status(400).json({ error: 'teams array is required' })
    }

    const budgetAmount = parseInt(budget, 10) || 350000000 // default 35Cr

    // Generate a simple 6-char password: 3 letters + 3 digits
    const genPassword = () => {
      const letters = 'abcdefghjkmnpqrstuvwxyz'
      const digits  = '23456789'
      let p = ''
      for (let i = 0; i < 3; i++) p += letters[Math.floor(Math.random() * letters.length)]
      for (let i = 0; i < 3; i++) p += digits[Math.floor(Math.random() * digits.length)]
      return p
    }

    // Generate team ID code: TM + 4 uppercase alphanumeric
    const genTeamId = () => {
      const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
      let id = 'TM'
      for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)]
      return id
    }

    try {
      const toInsert = teamNames.map(name => ({
        name: name.trim(),
        team_id_code: genTeamId(),
        password: genPassword(),
        budget_total: budgetAmount,
        budget_remaining: budgetAmount,
        color: '#00b341',
        logo_emoji: '⚽',
      }))

      const { data: inserted, error } = await supabase
        .from('teams')
        .insert(toInsert)
        .select('id, name, team_id_code, password, budget_total, budget_remaining')

      if (error) return res.status(500).json({ error: error.message })

      const fullState = await getFullState()
      io.emit('teams:updated', { teams: fullState.teams || [], fullState })

      return res.json({ success: true, teams: inserted })
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Failed to create teams' })
    }
  })

  // Assign captain — deducts 10Cr from team budget
  router.post('/assign-captain', async (req, res) => {
    const { teamId } = req.body || {}
    if (!teamId) return res.status(400).json({ error: 'teamId required' })
    try {
      const { data: team } = await supabase.from('teams').select('*').eq('id', parseInt(teamId, 10)).single()
      if (!team) return res.status(404).json({ error: 'Team not found' })
      const captainCost = 10000000 // 10Cr
      if (team.budget_remaining < captainCost) {
        return res.status(400).json({ error: `Insufficient budget (₹${(team.budget_remaining/100000).toFixed(1)}L remaining)` })
      }
      await supabase.from('teams').update({ budget_remaining: team.budget_remaining - captainCost }).eq('id', team.id)
      await logEvent(io, 'captain', `Captain assigned to ${team.name} (₹10Cr deducted)`)
      const fullState = await getFullState()
      io.emit('auction:state', fullState)
      io.emit('teams:updated', { teams: fullState.teams, fullState })
      return res.json({ success: true })
    } catch (err: any) {
      return res.status(500).json({ error: err.message })
    }
  })

  // Transfer player from one team to another
  router.post('/transfer-player', async (req, res) => {
    const { playerId, toTeamId } = req.body || {}
    if (!playerId || !toTeamId) return res.status(400).json({ error: 'playerId and toTeamId required' })

    try {
      const numericPlayerId = parseInt(playerId, 10)
      const numericToTeamId = parseInt(toTeamId, 10)

      // Get player
      const { data: player, error: pe } = await supabase.from('players').select('*').eq('id', numericPlayerId).single()
      if (pe || !player) return res.status(404).json({ error: 'Player not found' })
      if (player.status !== 'sold') return res.status(400).json({ error: 'Player is not sold' })

      const fromTeamId = player.sold_to
      const soldPrice  = player.sold_price || 0

      // Get destination team
      const { data: toTeam, error: tte } = await supabase.from('teams').select('*').eq('id', numericToTeamId).single()
      if (tte || !toTeam) return res.status(404).json({ error: 'Destination team not found' })

      if (toTeam.budget_remaining < soldPrice) {
        return res.status(400).json({ error: `${toTeam.name} has insufficient budget (₹${(toTeam.budget_remaining/100000).toFixed(1)}L)` })
      }

      // Refund original team if exists
      if (fromTeamId) {
        const { data: fromTeam } = await supabase.from('teams').select('budget_remaining').eq('id', fromTeamId).single()
        if (fromTeam) {
          await supabase.from('teams').update({ budget_remaining: fromTeam.budget_remaining + soldPrice }).eq('id', fromTeamId)
        }
      }

      // Deduct from new team
      await supabase.from('teams').update({ budget_remaining: toTeam.budget_remaining - soldPrice }).eq('id', numericToTeamId)

      // Reassign player
      await supabase.from('players').update({ sold_to: numericToTeamId }).eq('id', numericPlayerId)

      const fullState = await getFullState()
      await logEvent(io, 'transfer', `${player.name} transferred to ${toTeam.name} (₹${(soldPrice/100000).toFixed(1)}L)`)
      io.emit('auction:state', fullState)
      io.emit('teams:updated', { teams: fullState.teams, fullState })
      io.emit('players:updated', { players: fullState.players, fullState })

      return res.json({ success: true })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  })

  // Remove specific player
  router.delete('/players/:id', async (req, res) => {
    const { id } = req.params
    try {
      // If player is currently in auction, reset auction first
      const { data: auction } = await supabase.from('auction_state').select('current_player_id').eq('id', 1).single()
      if (auction?.current_player_id === parseInt(id, 10)) {
        await supabase.from('auction_state').update({ current_player_id: null, current_bid: 0, current_bidder_team_id: null, status: 'waiting' }).eq('id', 1)
      }
      const { error } = await supabase.from('players').delete().eq('id', id)
      if (error) return res.status(500).json({ error: error.message })
      const fullState = await getFullState()
      io.emit('players:updated', { players: fullState.players, fullState })
      return res.json({ success: true })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  })

  // Remove specific team — release their players back to unsold
  // Remove specific team — release their players back to unsold
  router.delete('/teams/:id', async (req, res) => {
    const teamId = parseInt(req.params.id, 10);
    if (Number.isNaN(teamId)) {
      return res.status(400).json({ error: 'Invalid team id' });
    }

    try {
      // Release players back to unsold pool
      await supabase.from('players')
        .update({ status: 'unsold', sold_to: null, sold_price: 0 })
        .eq('sold_to', teamId)

      const { error: delError } = await supabase.from('teams').delete().eq('id', teamId);
      if (delError) {
        return res.status(500).json({ error: delError.message || 'Failed to delete team' });
      }

      const fullState = await getFullState();
      io.emit('teams:updated', { teams: fullState.teams || [], fullState });
      io.emit('players:updated', { players: fullState.players || [], fullState });

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({
        error: err.message || 'Failed to delete team',
      });
    }
  });

  return router;
}

module.exports = createAdminRouter;

