const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const os = require('os');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 1e8 // 100MB buffer safety
});

const PORT = process.env.PORT || 3000;

// Helper to find local IPv4 network address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return '127.0.0.1';
}

const localIp = getLocalIP();

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API Info endpoint
app.get('/api/info', (req, res) => {
  res.json({
    localIp: localIp,
    port: PORT,
    baseUrl: `http://${localIp}:${PORT}`
  });
});

// Dynamic QR Code generation endpoint
app.get('/api/qrcode', async (req, res) => {
  try {
    const text = req.query.text || `http://${localIp}:${PORT}`;
    const qrDataUrl = await QRCode.toDataURL(text, {
      margin: 2,
      scale: 8,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });
    res.json({ dataUrl: qrDataUrl });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Active Rooms State
const activeRooms = new Map();

// Helper to generate a unique 6-digit PIN
function generatePairingCode() {
  let code;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (activeRooms.has(code));
  return code;
}

// Socket.io Real-time Handling
io.on('connection', (socket) => {
  let currentRoom = null;
  let deviceInfo = { id: socket.id, name: 'Unknown Device', type: 'desktop' };

  // Create a new session room (usually desktop)
  socket.on('create-room', (deviceData) => {
    const code = generatePairingCode();
    currentRoom = code;
    deviceInfo = { ...deviceData, id: socket.id };
    
    socket.join(code);
    activeRooms.set(code, {
      host: socket.id,
      devices: new Map([[socket.id, deviceInfo]])
    });

    const shareUrl = `http://${localIp}:${PORT}?code=${code}`;
    
    socket.emit('room-created', {
      code: code,
      localIp: localIp,
      port: PORT,
      shareUrl: shareUrl,
      devices: [deviceInfo]
    });
    console.log(`[Room Created] PIN: ${code} by ${deviceInfo.name}`);
  });

  // Join existing room (mobile or second device)
  socket.on('join-room', ({ code, deviceData }) => {
    const cleanCode = (code || '').replace(/\D/g, '');
    const room = activeRooms.get(cleanCode);

    if (!room) {
      socket.emit('join-error', { message: 'Invalid or expired 6-digit code' });
      return;
    }

    currentRoom = cleanCode;
    deviceInfo = { ...deviceData, id: socket.id };
    socket.join(cleanCode);

    room.devices.set(socket.id, deviceInfo);

    const devicesList = Array.from(room.devices.values());

    // Notify joining device
    socket.emit('room-joined', {
      code: cleanCode,
      devices: devicesList
    });

    // Notify all devices in room
    io.to(cleanCode).emit('device-connected', {
      device: deviceInfo,
      devices: devicesList
    });

    console.log(`[Device Joined] PIN: ${cleanCode} - ${deviceInfo.name}`);
  });

  // Relay WebRTC signaling (offers, answers, candidates)
  socket.on('webrtc-signal', (data) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('webrtc-signal', {
      senderId: socket.id,
      signal: data.signal
    });
  });

  // Fallback direct chunk transfer over sockets
  socket.on('file-meta', (fileMeta) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('file-meta', {
      ...fileMeta,
      senderId: socket.id,
      senderName: deviceInfo.name
    });
  });

  socket.on('file-chunk', (chunkData) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('file-chunk', chunkData);
  });

  socket.on('file-complete', (data) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('file-complete', data);
  });

  // Text clipboard sharing
  socket.on('send-text', (data) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('receive-text', {
      text: data.text,
      senderName: deviceInfo.name,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    if (currentRoom && activeRooms.has(currentRoom)) {
      const room = activeRooms.get(currentRoom);
      room.devices.delete(socket.id);

      if (room.devices.size === 0) {
        activeRooms.delete(currentRoom);
        console.log(`[Room Closed] PIN: ${currentRoom}`);
      } else {
        const remainingDevices = Array.from(room.devices.values());
        io.to(currentRoom).emit('device-disconnected', {
          deviceId: socket.id,
          devices: remainingDevices
        });
      }
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n==================================================`);
  console.log(`🚀 AirPulse File Sharing Server is Running!`);
  console.log(`--------------------------------------------------`);
  console.log(`💻 Local Machine Access: http://localhost:${PORT}`);
  console.log(`📱 Phone / Network Link: http://${localIp}:${PORT}`);
  console.log(`==================================================\n`);
});
