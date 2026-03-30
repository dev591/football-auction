const express = require('express');
const { supabase } = require('../supabase');
const jwt = require('jsonwebtoken');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message || 'Failed to fetch teams' });
    }

    return res.json({ teams: data || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch teams' });
  }
});

router.post('/login', async (req, res) => {
  const { teamIdCode, password } = req.body;

  if (!teamIdCode || !password) {
    return res.status(400).json({ error: 'Team ID and password required' });
  }

  try {
    // Match by team_id_code + password (both stored in DB)
    const { data: team, error } = await supabase
      .from('teams')
      .select('*')
      .ilike('team_id_code', teamIdCode.trim())
      .single();

    if (error || !team) {
      return res.status(401).json({ error: 'Team not found' });
    }

    if (team.password !== password) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const token = jwt.sign(
      { teamId: team.id, role: 'team' },
      process.env.JWT_SECRET || 'striker_jwt_secret_2024',
      { expiresIn: '24h' }
    );

    return res.json({ success: true, team, token });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Login failed' });
  }
});

router.get('/:id/squad', async (req, res) => {
  const { id } = req.params;
  const teamId = parseInt(id, 10);

  if (Number.isNaN(teamId)) {
    return res.status(400).json({ error: 'Invalid team id' });
  }

  try {
    const [{ data: team, error: teamError }, { data: players, error: playersError }] =
      await Promise.all([
        supabase.from('teams').select('*').eq('id', teamId).single(),
        supabase
          .from('players')
          .select('*')
          .eq('sold_to', teamId)
          .eq('status', 'sold')
          .order('position', { ascending: true }),
      ]);

    if (teamError) {
      return res.status(500).json({ error: teamError.message || 'Failed to fetch team' });
    }
    if (playersError) {
      return res
        .status(500)
        .json({ error: playersError.message || 'Failed to fetch squad players' });
    }

    const squad = (players || []).map((p) => ({
      team_id: team.id,
      team_name: team.name,
      player_id: p.id,
      player_name: p.name,
      position: p.position,
      sold_price: p.sold_price,
    }));

    return res.json({ squad });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch squad' });
  }
});

module.exports = router;

