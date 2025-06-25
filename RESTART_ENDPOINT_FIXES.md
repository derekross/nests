# Restart Endpoint Fixes - Complete Solution

## Issues Identified and Fixed

### 🔧 **Issue 1: JWT Token Generation Broken**
**Problem**: The `token.toJwt()` method was returning an empty object instead of a JWT string
**Root Cause**: Incorrect async/await handling in token generation
**Fix**: 
- Made token generation functions async where needed
- Added fallback to try both sync and async versions of `toJwt()`
- Added proper error handling for token generation failures

**Code Changes**:
```javascript
// Before (broken)
const jwt = token.toJwt(); // Returned {}

// After (fixed)
let jwt;
try {
  jwt = token.toJwt(); // Try sync first
  if (typeof jwt !== 'string') {
    jwt = await token.toJwt(); // Try async as fallback
  }
  if (typeof jwt !== 'string' || jwt.length === 0) {
    throw new Error('Invalid JWT generated');
  }
} catch (error) {
  logger.error('JWT generation failed:', error);
  return res.status(500).json({ error: 'Failed to generate access token' });
}
```

### 🔧 **Issue 2: Missing Redis Data for Existing Rooms**
**Problem**: Restart failing with 404 because nest data was missing from Redis, even though the LiveKit room existed
**Root Cause**: Redis data can be lost due to:
- Container restarts
- Redis memory limits
- Data expiration
- Manual clearing

**Fix**: Enhanced restart endpoint to handle missing Redis data gracefully:
1. Check Redis for nest data
2. If missing, check if LiveKit room exists
3. If LiveKit room exists, reconstruct minimal room info
4. Store reconstructed data in Redis
5. Proceed with restart

**Code Changes**:
```javascript
// Get room info from Redis
const roomData = await redis.get(`nest:${roomId}`);
let roomInfo;

if (!roomData) {
  logger.warn(`Nest ${roomId} not found in Redis, checking LiveKit for existing room`);
  
  // Check if room exists in LiveKit
  try {
    const existingRoom = await roomService.getRoom(roomId);
    logger.info(`Found existing LiveKit room ${roomId}, creating minimal room info`);
    
    // Create minimal room info for restart
    roomInfo = {
      id: roomId,
      host: requesterPubkey, // Assume requester is host since they're trying to restart
      speakers: [requesterPubkey],
      admins: [requesterPubkey],
      relays: ['wss://relay.nostr.band'], // Default relay
      hls_stream: false,
      createdAt: Date.now(),
      status: 'active',
    };
    
    // Store the reconstructed room info in Redis
    await redis.setEx(`nest:${roomId}`, 3600 * 24, JSON.stringify(roomInfo));
    logger.info(`Reconstructed and stored room info for ${roomId}`);
    
  } catch (livekitError) {
    logger.warn(`Neither Redis nor LiveKit has room ${roomId}`);
    return res.status(404).json({ error: 'Nest not found in Redis or LiveKit. The nest may have been deleted or expired.' });
  }
} else {
  roomInfo = JSON.parse(roomData);
}
```

## ✅ **Verification Tests**

### Test 1: JWT Token Generation
```bash
curl -s http://localhost:5544/debug/test-token
```
**Expected Result**: 
```json
{
  "success": true,
  "tokenType": "string",
  "tokenLength": 371,
  "tokenPreview": "eyJhbGciOiJIUzI1NiJ9.eyJtZXRhZGF0YSI6IntcInJvbGVcI...",
  "isValidString": true
}
```

### Test 2: Restart Endpoint Accessibility
```bash
curl -s -X POST http://localhost:5544/api/v1/nests/test-room-id/restart
```
**Expected Result**: `401 Unauthorized` (not 404), indicating the endpoint is working and requires authentication

### Test 3: Server Health
```bash
curl -s http://localhost:5544/health
```
**Expected Result**: 
```json
{
  "status": "healthy",
  "timestamp": "2025-06-25T13:50:20.569Z",
  "version": "1.0.0",
  "livekit": "ws://livekit:7880"
}
```

## 🚀 **How to Apply the Fixes**

### Step 1: Ensure Latest Code
The fixes are already applied to the server code. Rebuild and restart:
```bash
docker compose build nests-api
docker compose up -d nests-api
```

### Step 2: Verify Fixes
```bash
# Test token generation
curl -s http://localhost:5544/debug/test-token

# Test restart endpoint (should get 401, not 404)
curl -s -X POST http://localhost:5544/api/v1/nests/test-room/restart
```

### Step 3: Test from Frontend
1. Create a nest from the frontend
2. Try to restart it - should work normally
3. If you have an existing nest that was failing, try restarting it again

## 🔍 **Debugging Tools**

### Monitor Server Logs
```bash
docker compose logs -f nests-api
```

### Check Redis Data
```bash
# List all nest keys
docker compose exec redis redis-cli keys "nest:*"

# Get specific nest data
docker compose exec redis redis-cli get "nest:YOUR_ROOM_ID"
```

### Test Scripts
```bash
# Test restart recovery functionality
./scripts/test-restart-recovery.sh

# Test restart endpoint specifically
./scripts/test-restart-endpoint.sh
```

## 📊 **Expected Behavior After Fixes**

### Scenario 1: Normal Restart (Redis data exists)
1. User clicks restart
2. Server finds nest data in Redis
3. Server deletes and recreates LiveKit room
4. Server generates new JWT token
5. User gets new token and can rejoin

### Scenario 2: Recovery Restart (Redis data missing)
1. User clicks restart
2. Server doesn't find nest data in Redis
3. Server checks if LiveKit room exists
4. If room exists, server reconstructs minimal room info
5. Server stores reconstructed data in Redis
6. Server proceeds with normal restart process
7. User gets new token and can rejoin

### Scenario 3: Complete Failure (Neither Redis nor LiveKit has room)
1. User clicks restart
2. Server doesn't find nest data in Redis
3. Server doesn't find room in LiveKit
4. Server returns 404 with clear error message
5. User knows the nest is completely gone

## 🎯 **Key Improvements**

1. **Robust Token Generation**: Works with different LiveKit SDK versions
2. **Data Recovery**: Can recover from Redis data loss
3. **Better Error Messages**: Clear indication of what went wrong
4. **Graceful Degradation**: System continues to work even with partial data loss
5. **Enhanced Logging**: Better visibility into what's happening

## 🔧 **Files Modified**

- `api/server.js` - Fixed JWT generation and added Redis recovery logic
- `scripts/test-restart-recovery.sh` - New test script for recovery functionality
- `scripts/test-restart-endpoint.sh` - Enhanced test script for endpoint verification

The restart functionality should now work reliably, even in cases where Redis data is missing but the LiveKit room still exists. This provides a much more robust and user-friendly experience.