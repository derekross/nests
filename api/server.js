const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');
const { v4: uuidv4 } = require('uuid');
const Redis = require('redis');
const winston = require('winston');
require('dotenv').config();

const { validateNip98Auth, extractPubkeyFromAuth } = require('./utils/nip98');
const { validateCreateNestRequest, validatePermissionsRequest } = require('./utils/validation');

// Configuration
const config = {
  port: process.env.PORT || 5544,
  livekit: {
    url: process.env.LIVEKIT_URL || 'ws://localhost:7880',
    apiKey: process.env.LIVEKIT_API_KEY || 'nests-api-key',
    apiSecret: process.env.LIVEKIT_API_SECRET || 'nests-super-secret-key-change-in-production',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:5173'],
  },
  nodeEnv: process.env.NODE_ENV || 'development',
};

// Logger setup
const logger = winston.createLogger({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'nests-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (config.nodeEnv !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Redis client
const redis = Redis.createClient({ url: config.redis.url });
redis.on('error', (err) => logger.error('Redis Client Error', err));
redis.connect();

// LiveKit client
const roomService = new RoomServiceClient(
  config.livekit.url.replace('ws://', 'http://').replace('wss://', 'https://'),
  config.livekit.apiKey,
  config.livekit.apiSecret
);

// Express app setup
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow WebRTC
  crossOriginEmbedderPolicy: false, // Allow SharedArrayBuffer for audio processing
}));

// CORS configuration
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing and compression
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    livekit: config.livekit.url,
  });
});

// Middleware for NIP-98 authentication
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Nostr ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(6); // Remove 'Nostr ' prefix
    const isValid = await validateNip98Auth(token, req.method, req.originalUrl);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid NIP-98 authentication' });
    }

    req.pubkey = extractPubkeyFromAuth(token);
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// Create new nest
app.put('/api/v1/nests', requireAuth, async (req, res) => {
  try {
    const { error, value } = validateCreateNestRequest(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { relays, hls_stream } = value;
    const roomId = uuidv4();
    const hostPubkey = req.pubkey;

    // Create LiveKit room
    const room = await roomService.createRoom({
      name: roomId,
      maxParticipants: 500,
      emptyTimeout: 300, // 5 minutes
      metadata: JSON.stringify({
        nestId: roomId,
        host: hostPubkey,
        relays,
        createdAt: Date.now(),
      }),
    });

    // Generate host token with admin privileges
    const token = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
      identity: hostPubkey,
      name: 'Host',
      metadata: JSON.stringify({ role: 'host', pubkey: hostPubkey }),
    });

    token.addGrant({
      room: roomId,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      roomAdmin: true,
      roomRecord: true,
    });

    const jwt = token.toJwt();

    // Store room info in Redis
    const roomInfo = {
      id: roomId,
      host: hostPubkey,
      speakers: [hostPubkey],
      admins: [hostPubkey],
      relays,
      hls_stream,
      createdAt: Date.now(),
      status: 'active',
    };

    await redis.setEx(`nest:${roomId}`, 3600 * 24, JSON.stringify(roomInfo)); // 24 hour TTL

    // Build endpoints
    const endpoints = [`wss+livekit://${config.livekit.url.replace('ws://', '').replace('wss://', '')}`];
    if (hls_stream) {
      endpoints.push(`https://nostrnests.com/api/v1/live/${roomId}/live.m3u8`);
    }

    logger.info(`Created nest ${roomId} for host ${hostPubkey}`);

    res.json({
      roomId,
      endpoints,
      token: jwt,
    });
  } catch (error) {
    logger.error('Create nest error:', error);
    res.status(500).json({ error: 'Failed to create nest' });
  }
});

// Join existing nest (authenticated)
app.get('/api/v1/nests/:roomId', requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userPubkey = req.pubkey;

    // Get room info from Redis
    const roomData = await redis.get(`nest:${roomId}`);
    if (!roomData) {
      return res.status(404).json({ error: 'Nest not found' });
    }

    const roomInfo = JSON.parse(roomData);

    // Check if room is still active
    try {
      await roomService.getRoom(roomId);
    } catch (error) {
      return res.status(404).json({ error: 'Nest is no longer active' });
    }

    // Determine user permissions
    const isHost = roomInfo.host === userPubkey;
    const isAdmin = roomInfo.admins.includes(userPubkey);
    const isSpeaker = roomInfo.speakers.includes(userPubkey);

    // Generate token with appropriate permissions
    const token = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
      identity: userPubkey,
      name: isHost ? 'Host' : isAdmin ? 'Admin' : isSpeaker ? 'Speaker' : 'Listener',
      metadata: JSON.stringify({ 
        role: isHost ? 'host' : isAdmin ? 'admin' : isSpeaker ? 'speaker' : 'listener',
        pubkey: userPubkey 
      }),
    });

    token.addGrant({
      room: roomId,
      roomJoin: true,
      canPublish: isHost || isAdmin || isSpeaker,
      canSubscribe: true,
      roomAdmin: isHost || isAdmin,
      roomRecord: isHost || isAdmin,
    });

    const jwt = token.toJwt();

    logger.info(`User ${userPubkey} joined nest ${roomId} as ${isHost ? 'host' : isAdmin ? 'admin' : isSpeaker ? 'speaker' : 'listener'}`);

    res.json({ token: jwt });
  } catch (error) {
    logger.error('Join nest error:', error);
    res.status(500).json({ error: 'Failed to join nest' });
  }
});

// Join nest as guest (no authentication)
app.get('/api/v1/nests/:roomId/guest', async (req, res) => {
  try {
    const { roomId } = req.params;

    // Check if room exists
    try {
      await roomService.getRoom(roomId);
    } catch (error) {
      return res.status(404).json({ error: 'Nest not found or no longer active' });
    }

    // Generate guest token (listener only)
    const guestId = `guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const token = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
      identity: guestId,
      name: 'Guest',
      metadata: JSON.stringify({ role: 'guest' }),
    });

    token.addGrant({
      room: roomId,
      roomJoin: true,
      canPublish: false, // Guests can only listen
      canSubscribe: true,
      roomAdmin: false,
    });

    const jwt = token.toJwt();

    logger.info(`Guest ${guestId} joined nest ${roomId}`);

    res.json({ token: jwt });
  } catch (error) {
    logger.error('Guest join error:', error);
    res.status(500).json({ error: 'Failed to join nest as guest' });
  }
});

// Update nest permissions
app.post('/api/v1/nests/:roomId/permissions', requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const requesterPubkey = req.pubkey;

    const { error, value } = validatePermissionsRequest(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { participant, can_publish, mute_microphone, is_admin } = value;

    // Get room info
    const roomData = await redis.get(`nest:${roomId}`);
    if (!roomData) {
      return res.status(404).json({ error: 'Nest not found' });
    }

    const roomInfo = JSON.parse(roomData);

    // Check permissions
    const isHost = roomInfo.host === requesterPubkey;
    const isAdmin = roomInfo.admins.includes(requesterPubkey);

    if (!isHost && !isAdmin) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Only host can promote to admin
    if (is_admin !== undefined && !isHost) {
      return res.status(403).json({ error: 'Only host can manage admin permissions' });
    }

    // Update room info
    let updated = false;

    if (can_publish !== undefined) {
      if (can_publish && !roomInfo.speakers.includes(participant)) {
        roomInfo.speakers.push(participant);
        updated = true;
      } else if (!can_publish && roomInfo.speakers.includes(participant)) {
        roomInfo.speakers = roomInfo.speakers.filter(p => p !== participant);
        updated = true;
      }
    }

    if (is_admin !== undefined) {
      if (is_admin && !roomInfo.admins.includes(participant)) {
        roomInfo.admins.push(participant);
        updated = true;
      } else if (!is_admin && roomInfo.admins.includes(participant)) {
        roomInfo.admins = roomInfo.admins.filter(p => p !== participant);
        updated = true;
      }
    }

    if (updated) {
      await redis.setEx(`nest:${roomId}`, 3600 * 24, JSON.stringify(roomInfo));
    }

    // Handle microphone muting via LiveKit API
    if (mute_microphone !== undefined) {
      try {
        await roomService.mutePublishedTrack(roomId, participant, 'audio', mute_microphone);
      } catch (error) {
        logger.warn(`Failed to mute participant ${participant}:`, error);
      }
    }

    logger.info(`Permissions updated for ${participant} in nest ${roomId} by ${requesterPubkey}`);

    res.status(updated ? 201 : 204).send();
  } catch (error) {
    logger.error('Update permissions error:', error);
    res.status(500).json({ error: 'Failed to update permissions' });
  }
});

// Get nest info
app.get('/api/v1/nests/:roomId/info', async (req, res) => {
  try {
    const { roomId } = req.params;

    // Get room info from Redis
    const roomData = await redis.get(`nest:${roomId}`);
    if (!roomData) {
      return res.status(404).json({ error: 'Nest not found' });
    }

    const roomInfo = JSON.parse(roomData);

    // Get live participant count from LiveKit
    let participantCount = 0;
    let recording = false;
    
    try {
      const participants = await roomService.listParticipants(roomId);
      participantCount = participants.length;
      
      // Check if recording is active
      const recordings = await roomService.listRecordings(roomId);
      recording = recordings.some(r => r.status === 'RECORDING_ACTIVE');
    } catch (error) {
      logger.warn(`Failed to get live info for nest ${roomId}:`, error);
    }

    // Generate naddr for the nest
    const { nip19 } = require('nostr-tools');
    const link = nip19.naddrEncode({
      kind: 30312,
      pubkey: roomInfo.host,
      identifier: roomId,
    });

    res.json({
      host: roomInfo.host,
      speakers: roomInfo.speakers,
      admins: roomInfo.admins,
      link,
      recording,
      participantCount,
      createdAt: roomInfo.createdAt,
      status: roomInfo.status,
    });
  } catch (error) {
    logger.error('Get nest info error:', error);
    res.status(500).json({ error: 'Failed to get nest info' });
  }
});

// LiveKit webhook handler
app.post('/webhooks/livekit', express.raw({ type: 'application/webhook+json' }), async (req, res) => {
  try {
    // TODO: Verify webhook signature
    const event = JSON.parse(req.body.toString());
    
    logger.info('LiveKit webhook event:', event);

    // Handle different event types
    switch (event.event) {
      case 'room_finished':
        // Clean up room data when room ends
        const roomName = event.room.name;
        await redis.del(`nest:${roomName}`);
        logger.info(`Cleaned up data for finished nest ${roomName}`);
        break;
        
      case 'participant_joined':
        logger.info(`Participant ${event.participant.identity} joined nest ${event.room.name}`);
        break;
        
      case 'participant_left':
        logger.info(`Participant ${event.participant.identity} left nest ${event.room.name}`);
        break;
    }

    res.status(200).send('OK');
  } catch (error) {
    logger.error('Webhook error:', error);
    res.status(500).send('Error');
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await redis.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await redis.quit();
  process.exit(0);
});

// Start server
app.listen(config.port, () => {
  logger.info(`Nests API server running on port ${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`LiveKit URL: ${config.livekit.url}`);
  logger.info(`Redis URL: ${config.redis.url}`);
});

module.exports = app;