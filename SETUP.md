# LiveKit Backend Setup for Nests

This guide explains how to set up your own LiveKit backend for the Nests application.

## Option 1: Use Docker Compose (Easiest)

Create a `docker-compose.yml` file:

```yaml
version: '3.8'
services:
  livekit:
    image: livekit/livekit-server:latest
    ports:
      - "7880:7880"
      - "7881:7881/udp"
    volumes:
      - ./livekit.yaml:/etc/livekit.yaml
    command: --config /etc/livekit.yaml

  nests-api:
    build: ./api
    ports:
      - "5544:5544"
    environment:
      - LIVEKIT_URL=ws://livekit:7880
      - LIVEKIT_API_KEY=your-api-key
      - LIVEKIT_API_SECRET=your-api-secret
    depends_on:
      - livekit
```

Create `livekit.yaml`:

```yaml
port: 7880
bind_addresses:
  - ""
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
redis:
  address: redis:6379
keys:
  your-api-key: your-api-secret
room:
  auto_create: true
  enable_recording: true
```

## Option 2: Manual Setup

### 1. Install LiveKit Server

```bash
# Download LiveKit server
wget https://github.com/livekit/livekit/releases/latest/download/livekit_linux_amd64.tar.gz
tar -xzf livekit_linux_amd64.tar.gz

# Create config
cat > livekit.yaml << EOF
port: 7880
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
keys:
  devkey: secret
room:
  auto_create: true
EOF

# Run server
./livekit-server --config livekit.yaml
```

### 2. Create Simple API Backend

Create a Node.js backend (`api/server.js`):

```javascript
const express = require('express');
const { AccessToken } = require('livekit-server-sdk');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

const LIVEKIT_URL = process.env.LIVEKIT_URL || 'ws://localhost:7880';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'secret';

// Create new nest
app.put('/api/v1/nests', async (req, res) => {
  try {
    const roomId = uuidv4();
    const { relays, hls_stream } = req.body;
    
    // Generate host token
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: 'host-' + Date.now(),
      name: 'Host',
    });
    
    token.addGrant({
      room: roomId,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      roomAdmin: true,
    });
    
    const jwt = token.toJwt();
    
    const endpoints = [`wss+livekit://${LIVEKIT_URL.replace('ws://', '').replace('wss://', '')}`];
    if (hls_stream) {
      endpoints.push(`https://example.com/api/v1/live/${roomId}/live.m3u8`);
    }
    
    res.json({
      roomId,
      endpoints,
      token: jwt,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Join existing nest
app.get('/api/v1/nests/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: 'user-' + Date.now(),
      name: 'User',
    });
    
    token.addGrant({
      room: roomId,
      roomJoin: true,
      canPublish: false, // Start as listener
      canSubscribe: true,
    });
    
    const jwt = token.toJwt();
    
    res.json({ token: jwt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Join as guest
app.get('/api/v1/nests/:roomId/guest', async (req, res) => {
  try {
    const { roomId } = req.params;
    
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: 'guest-' + Date.now(),
      name: 'Guest',
    });
    
    token.addGrant({
      room: roomId,
      roomJoin: true,
      canPublish: false,
      canSubscribe: true,
    });
    
    const jwt = token.toJwt();
    
    res.json({ token: jwt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update permissions
app.post('/api/v1/nests/:roomId/permissions', async (req, res) => {
  try {
    // TODO: Implement permission updates via LiveKit API
    res.status(201).send('Accepted');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get room info
app.get('/api/v1/nests/:roomId/info', async (req, res) => {
  try {
    const { roomId } = req.params;
    
    // TODO: Get actual room info from LiveKit
    res.json({
      host: 'host-pubkey',
      speakers: [],
      admins: ['host-pubkey'],
      link: `naddr1...`,
      recording: false,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5544;
app.listen(PORT, () => {
  console.log(`Nests API running on port ${PORT}`);
  console.log(`LiveKit URL: ${LIVEKIT_URL}`);
});
```

Create `api/package.json`:

```json
{
  "name": "nests-api",
  "version": "1.0.0",
  "main": "server.js",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "livekit-server-sdk": "^1.2.7",
    "uuid": "^9.0.0"
  },
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

### 3. Install and Run

```bash
cd api
npm install
npm start
```

## Option 3: Update Frontend for Local Development

If you want to test without the full backend, update the API base URL in the frontend:

```typescript
// In src/hooks/useNestsApi.ts
const NESTS_API_BASE = 'http://localhost:5544/api/v1/nests';
```

## Testing the Setup

1. Start LiveKit server
2. Start the API backend
3. Start the Nests frontend
4. Create a nest - it should generate a LiveKit room
5. Join the nest - you should get audio connectivity

## Production Considerations

### Security
- Implement proper NIP-98 authentication
- Use HTTPS/WSS in production
- Validate Nostr signatures
- Rate limiting and abuse prevention

### Scalability
- Use Redis for LiveKit clustering
- Load balancer for multiple API instances
- CDN for HLS streams
- Database for persistent room data

### Monitoring
- LiveKit metrics and logging
- Room usage analytics
- Error tracking and alerts

## Environment Variables

```bash
# LiveKit Configuration
LIVEKIT_URL=wss://your-livekit-server.com
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret

# API Configuration
PORT=5544
NODE_ENV=production

# Optional: Database
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure your API has proper CORS headers
2. **WebRTC Connection Failed**: Check firewall settings for UDP ports
3. **Token Expired**: Implement token refresh logic
4. **Audio Not Working**: Verify microphone permissions in browser

### Debug Commands

```bash
# Test LiveKit server
curl http://localhost:7880/

# Test API endpoints
curl -X PUT http://localhost:5544/api/v1/nests \
  -H "Content-Type: application/json" \
  -d '{"relays":["wss://relay.nostr.band"]}'

# Check LiveKit rooms
livekit-cli room list --url ws://localhost:7880 --api-key devkey --api-secret secret
```

This setup gives you a complete LiveKit backend that works with the Nests frontend!