const express = require('express');
const {
  getFullState,
  startAuction,
  placeBid,
  revealRandomPlayer,
  startAuctionPhase,
  sellPlayer,
  passPlayer,
  undoBid,
  customSell,
} = require('../socket/auctionSocket');

function createAuctionRouter(io) {
  const router = express.Router();

  router.post('/phase', async (req, res) => {
    try {
      await startAuctionPhase(io, req.body);
      const state = await getFullState();
      return res.json(state);
    } catch (err) {
      return res.status(400).json({ error: err.message || 'Failed to change phase' });
    }
  });

  router.post('/reveal', async (_req, res) => {
    try {
      await revealRandomPlayer(io);
      const state = await getFullState();
      return res.json(state);
    } catch (err) {
      return res.status(400).json({ error: err.message || 'Failed to reveal player' });
    }
  });

  router.get('/state', async (_req, res) => {
    try {
      const state = await getFullState();
      return res.json(state);
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Failed to fetch auction state' });
    }
  });

  router.post('/start', async (req, res) => {
    const { playerId } = req.body || {};

    if (!playerId) {
      return res.status(400).json({ error: 'playerId is required' });
    }

    try {
      await startAuction(io, { playerId });
      const state = await getFullState();
      return res.json(state);
    } catch (err) {
      return res.status(400).json({ error: err.message || 'Failed to start auction' });
    }
  });

  router.post('/bid', async (req, res) => {
    const { increment } = req.body || {};
    try {
      await placeBid(io, { increment });
      const state = await getFullState();
      return res.json(state);
    } catch (err) {
      return res.status(400).json({ error: err.message || 'Failed to place bid' });
    }
  });

  router.post('/sell', async (req, res) => {
    const { teamId } = req.body || {};
    try {
      await sellPlayer(io, { teamId });
      const state = await getFullState();
      return res.json(state);
    } catch (err) {
      return res.status(400).json({ error: err.message || 'Failed to sell player' });
    }
  });

  router.post('/pass', async (_req, res) => {
    try {
      await passPlayer(io);
      const state = await getFullState();
      return res.json(state);
    } catch (err) {
      return res.status(400).json({ error: err.message || 'Failed to pass player' });
    }
  });
  
  router.post('/undo', async (_req, res) => {
    try {
      await undoBid(io);
      const state = await getFullState();
      return res.json(state);
    } catch (err) {
      return res.status(400).json({ error: err.message || 'Failed to undo bid' });
    }
  });

  router.post('/custom-sell', async (req, res) => {
    try {
      await customSell(io, req.body);
      const state = await getFullState();
      return res.json(state);
    } catch (err) {
      return res.status(400).json({ error: err.message || 'Failed to custom sell player' });
    }
  });

  return router;
}

module.exports = createAuctionRouter;

