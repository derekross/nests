const request = require('supertest');
const app = require('../server');

describe('Nests API', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);
      
      expect(res.body).toHaveProperty('status', 'healthy');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('version');
    });
  });

  describe('PUT /api/v1/nests', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .put('/api/v1/nests')
        .send({
          relays: ['wss://relay.nostr.band'],
          hls_stream: true
        })
        .expect(401);
      
      expect(res.body).toHaveProperty('error');
    });

    it('should validate request body', async () => {
      const res = await request(app)
        .put('/api/v1/nests')
        .set('Authorization', 'Nostr invalid-token')
        .send({
          relays: [], // Invalid: empty array
        })
        .expect(400);
      
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/v1/nests/:roomId/guest', () => {
    it('should handle non-existent room', async () => {
      const fakeRoomId = '00000000-0000-4000-8000-000000000000';
      
      const res = await request(app)
        .get(`/api/v1/nests/${fakeRoomId}/guest`)
        .expect(404);
      
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/v1/nests/:roomId/info', () => {
    it('should handle non-existent room', async () => {
      const fakeRoomId = '00000000-0000-4000-8000-000000000000';
      
      const res = await request(app)
        .get(`/api/v1/nests/${fakeRoomId}/info`)
        .expect(404);
      
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('Error handling', () => {
    it('should handle 404 for unknown endpoints', async () => {
      const res = await request(app)
        .get('/api/v1/unknown')
        .expect(404);
      
      expect(res.body).toHaveProperty('error', 'Endpoint not found');
    });
  });
});