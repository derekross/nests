// Test setup file
process.env.NODE_ENV = 'test';
process.env.LIVEKIT_URL = 'ws://localhost:7880';
process.env.LIVEKIT_API_KEY = 'test-key';
process.env.LIVEKIT_API_SECRET = 'test-secret';
process.env.REDIS_URL = 'redis://localhost:6379';

// Mock Redis for tests
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    on: jest.fn(),
    connect: jest.fn(),
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    quit: jest.fn(),
  })),
}));

// Mock LiveKit for tests
jest.mock('livekit-server-sdk', () => ({
  AccessToken: jest.fn().mockImplementation(() => ({
    addGrant: jest.fn(),
    toJwt: jest.fn(() => 'mock-jwt-token'),
  })),
  RoomServiceClient: jest.fn().mockImplementation(() => ({
    createRoom: jest.fn(),
    getRoom: jest.fn(),
    listParticipants: jest.fn(() => []),
    listRecordings: jest.fn(() => []),
    mutePublishedTrack: jest.fn(),
  })),
}));