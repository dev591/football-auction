const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const dotenv = require('dotenv');

dotenv.config();

const createPlayersRouter = require('./routes/players');
const teamsRouter = require('./routes/teams');
const createAuctionRouter = require('./routes/auction');
const createAdminRouter = require('./routes/admin');
const authRouter = require('./routes/auth');
const { registerAuctionSocket, getFullState } = require('./socket/auctionSocket');

const PORT = process.env.PORT || 3001;

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: '*' }));
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/players', createPlayersRouter(io));
app.use('/api/teams', teamsRouter);
app.use('/api/auction', createAuctionRouter(io));
app.use('/api/admin', createAdminRouter(io));

io.on('connection', (socket) => {
  registerAuctionSocket(io, socket);
  getFullState()
    .then((state) => {
      socket.emit('auction:state', state);
    })
    .catch(() => {
      // ignore initial error
    });
});

server.listen(PORT, () => {
  console.log(`STRIKER server listening on http://localhost:${PORT}`);
});

