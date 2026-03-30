const express = require('express');
const { supabase } = require('../supabase');
const { getFullState } = require('../socket/auctionSocket');

function createPlayersRouter(io) {
  const router = express.Router();

  router.get('/', async (_req, res) => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        return res.status(500).json({ error: error.message || 'Failed to fetch players' });
      }

      return res.json({ players: data || [] });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Failed to fetch players' });
    }
  });

  router.post('/add', async (req, res) => {
    try {
      const { name, position, college, base_price } = req.body;

      if (!name || !position || !college || !base_price) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const numericPrice = typeof base_price === 'string' ? parseInt(base_price, 10) : base_price;
      const actualPrice = numericPrice < 100000 ? numericPrice * 100000 : numericPrice;

      const { data: insertData, error: insertError } = await supabase
        .from('players')
        .insert([{
          name,
          position,
          college,
          base_price: actualPrice,
          status: 'unsold'
        }])
        .select();

      if (insertError) {
        return res.status(500).json({ error: insertError.message || 'Failed to insert player' });
      }

      // Emit updated players
      const state = await getFullState();
      io.emit('players:updated', { players: state.players, fullState: state });

      return res.json({ success: true, player: insertData[0] });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Failed to add player' });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const { data: checkData, error: checkError } = await supabase
        .from('players')
        .select('status')
        .eq('id', id)
        .single();

      if (checkError || !checkData) {
        return res.status(404).json({ error: 'Player not found' });
      }

      if (checkData.status !== 'unsold') {
        return res.status(400).json({ error: 'Cannot delete sold or live players' });
      }

      const { error: deleteError } = await supabase
        .from('players')
        .delete()
        .eq('id', id);

      if (deleteError) {
        return res.status(500).json({ error: deleteError.message || 'Failed to delete player' });
      }

      // Emit updated players
      const state = await getFullState();
      io.emit('players:updated', { players: state.players, fullState: state });

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Failed to delete player' });
    }
  });

  router.post('/import', async (req, res) => {
    try {
      const playersToImport = req.body.players;
      if (!Array.isArray(playersToImport)) {
        return res.status(400).json({ error: 'Valid array of players required' });
      }

      const formattedPlayers = playersToImport.map(p => {
        // Normalize keys case-insensitively
        const findKey = (name) => {
          const key = Object.keys(p).find(k => k.trim().toLowerCase() === name.toLowerCase())
          return key ? (typeof p[key] === 'string' ? p[key].trim() : p[key]) : undefined
        }

        const name      = findKey('name')
        const position  = findKey('position') || 'Unknown'
        const college   = findKey('college') || 'N/A'
        const image_url = findKey('image_url') || null

        return {
          name,
          position,
          college,
          base_price: 500000,
          status:     'unsold',
          image_url,
        }      }).filter(p => p.name);

      if (formattedPlayers.length === 0) {
        return res.status(400).json({ error: 'No valid players found in import data' });
      }

      const { data, error } = await supabase
        .from('players')
        .insert(formattedPlayers)
        .select();

      if (error) {
        return res.status(500).json({ error: error.message || 'Failed to import players' });
      }

      const state = await getFullState();
      io.emit('players:updated', { players: state.players, fullState: state });

      return res.json({ success: true, count: data.length, players: data });
    } catch (err) {
      console.error('[IMPORT ERROR]', err);
      return res.status(500).json({ error: err.message || 'Failed to import players' });
    }
  });

  const multer = require('multer');
  const upload = multer({ storage: multer.memoryStorage() });

  router.post('/:id/photo', upload.single('photo'), async (req, res) => {
    try {
      const { id } = req.params;
      if (!req.file) {
        return res.status(400).json({ error: 'No photo file provided' });
      }

      const timestamp = Date.now();
      const filePath = `players/${id}/${timestamp}.jpg`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('player-photos')
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: true,
        });

      if (uploadError) {
        return res.status(500).json({ error: uploadError.message || 'Failed to upload photo to Supabase' });
      }

      const { data: publicUrlData } = supabase.storage
        .from('player-photos')
        .getPublicUrl(filePath);

      const imageUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase
        .from('players')
        .update({ image_url: imageUrl })
        .eq('id', id);

      if (updateError) {
        return res.status(500).json({ error: updateError.message || 'Failed to update player record' });
      }

      const state = await getFullState();
      io.emit('players:updated', { players: state.players, fullState: state });

      return res.json({ success: true, image_url: imageUrl });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Failed to handle photo upload' });
    }
  });

  return router;
}

module.exports = createPlayersRouter;
