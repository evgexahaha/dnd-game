const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { registerSocketEvents, rooms } = require('./socket/roomManager');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 1e7 // Allow up to 10MB base64 custom avatar uploads
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static client assets in production
const clientBuildPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientBuildPath));

// API Status & Lobby details endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    activeRoomsCount: rooms.size,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/room/:code', (req, res) => {
  const code = (req.params.code || '').toUpperCase();
  const room = rooms.get(code);
  if (!room) {
    return res.status(404).json({ error: 'Lobby not found' });
  }
  res.json({
    code: room.code,
    playersCount: room.players.length,
    host: room.players.find(p => p.isHost)?.nickname || 'Unknown'
  });
});

// Socket.io Connection Logic
io.on('connection', (socket) => {
  console.log(`[Socket] New connection: ${socket.id}`);
  registerSocketEvents(io, socket);
});

// Fallback route for Single Page Application
app.get('*', (req, res) => {
  if (req.accepts('html')) {
    res.sendFile(path.join(clientBuildPath, 'index.html'), (err) => {
      if (err) {
        res.send('D&D AI Game Server API is running! Start Vite dev server for client interface.');
      }
    });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(` D&D AI Multiplayer Server is running on port ${PORT}`);
  console.log(` Local URL: http://localhost:${PORT}`);
  console.log(`===================================================`);
});
