# API/LiveKit Synchronization Debugging Guide

## Problem Description

You're experiencing a persistent issue where:
- ✅ **LiveKit rooms are being created** (visible in Docker logs)
- ❌ **API returns 404 errors** when trying to join
- ❌ **Issue persists even after restart + wait + refresh**

This indicates a **fundamental synchronization problem** between the API server and LiveKit.

## Enhanced Debugging Tools Added

### 1. Comprehensive API Diagnostics

**New Feature**: "Run API Diagnostics" button in error states

**What it checks**:
- ✅ API health endpoint
- ✅ Room info endpoint (`/info`)
- ✅ Guest access endpoint (`/guest`)
- ✅ Comprehensive error logging

**How to use**:
1. When you get a 404 error, click "Run API Diagnostics"
2. Check browser console for detailed logs (look for 🔧 emojis)
3. Toast notifications will show summary results

### 2. Enhanced Join Logging

**New Feature**: Detailed logging with emojis for easy identification

**Console output includes**:
- 🔍 Smart join attempts
- 🔐 Authenticated join attempts  
- 👤 Guest join attempts
- ✅ Successful operations
- ❌ Failed operations
- ⚠️ Warnings and fallbacks

### 3. Room Info Validation

**New Feature**: Pre-join room validation

**Process**:
1. Check if room exists via `/info` endpoint (no auth required)
2. If room exists but join fails → API/LiveKit sync issue
3. If room doesn't exist → Room creation issue

## Debugging Process

### Step 1: Reproduce the Issue
1. Create a nest
2. Wait for LiveKit room creation (check Docker logs)
3. Try to join → Get 404 error
4. Click "Run API Diagnostics"

### Step 2: Analyze Diagnostic Results

**Scenario A: Room Info Returns 200, Guest Access Returns 404**
```
Room exists: ✅ | Guest access: ❌
```
**Diagnosis**: API knows about the room but can't generate tokens
**Likely cause**: LiveKit connection/authentication issue

**Scenario B: Room Info Returns 404**
```
Room exists: ❌ | Guest access: ❌  
```
**Diagnosis**: API doesn't know about the room at all
**Likely cause**: Room creation didn't persist in API database

**Scenario C: All Endpoints Return 404**
```
Room exists: ❌ | Guest access: ❌
```
**Diagnosis**: API server issue or wrong room ID
**Likely cause**: API server problem or database issue

### Step 3: Check Console Logs

Look for these patterns in browser console:

**Successful Flow**:
```
🔍 Smart join attempt: {roomId: "...", hasUser: true}
✅ Room info found: {host: "...", speakers: [...]}
🔐 Trying authenticated join: {roomId: "...", url: "..."}
✅ Authenticated join successful
```

**API Sync Issue**:
```
🔍 Smart join attempt: {roomId: "...", hasUser: true}
❌ Room info failed: {status: 404, statusText: "Not Found"}
🔐 Trying authenticated join: {roomId: "...", url: "..."}
❌ Authenticated join failed: {status: 404}
👤 Trying guest join: {roomId: "...", url: "..."}
❌ Guest join failed: {status: 404}
```

## Potential Root Causes

### 1. Database Synchronization Issue
**Symptoms**: LiveKit room exists, API returns 404
**Cause**: Room creation succeeded in LiveKit but failed to persist in API database
**Check**: API server logs during room creation

### 2. LiveKit Connection Issue  
**Symptoms**: Room info exists, but token generation fails
**Cause**: API can't communicate with LiveKit to generate tokens
**Check**: LiveKit connectivity from API server

### 3. Room ID Mismatch
**Symptoms**: Inconsistent behavior
**Cause**: Different room IDs used between Nostr event and API
**Check**: Compare room ID in Nostr event vs API calls

### 4. API Server State Issue
**Symptoms**: Persistent 404s even after restart
**Cause**: API server database corruption or connection issues
**Check**: API server database state

## Recommended Investigation Steps

### 1. Check API Server Logs
```bash
# Check API server logs during room creation
docker logs <api-container-name> -f

# Look for:
# - Room creation requests
# - Database operations
# - LiveKit communication
# - Error messages
```

### 2. Check LiveKit Logs
```bash
# Check LiveKit logs for room operations
docker logs <livekit-container-name> -f

# Look for:
# - Room creation events
# - Token generation requests
# - Connection attempts
```

### 3. Database State Check
```bash
# If using SQLite/PostgreSQL, check room records
# Look for:
# - Room existence in database
# - Room status/state
# - Creation timestamps
```

### 4. Network Connectivity
```bash
# Test API to LiveKit connectivity
# From API container:
curl -v http://livekit:7880/health
# or
curl -v ws://livekit:7880
```

## API Endpoints to Test Manually

### 1. Health Check
```bash
curl -v http://localhost:5544/health
```

### 2. Room Info (No Auth)
```bash
curl -v http://localhost:5544/api/v1/nests/{ROOM_ID}/info
```

### 3. Guest Access (No Auth)
```bash
curl -v http://localhost:5544/api/v1/nests/{ROOM_ID}/guest
```

### 4. Authenticated Access (With Auth)
```bash
curl -v -H "Authorization: Nostr {BASE64_NIP98_EVENT}" \
  http://localhost:5544/api/v1/nests/{ROOM_ID}
```

## Expected API Responses

### Healthy Room
```json
// GET /api/v1/nests/{roomId}/info
{
  "host": "hex-pubkey",
  "speakers": ["hex-pubkey"],
  "admins": ["hex-pubkey"],
  "link": "nip-19-code",
  "recording": false
}

// GET /api/v1/nests/{roomId}/guest
{
  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

### Broken Room
```json
// All endpoints return:
{
  "error": "Room not found"
}
```

## Next Steps

1. **Use the new diagnostic tools** to identify the exact failure point
2. **Check API server logs** during room creation and join attempts
3. **Verify database state** to see if rooms are being persisted
4. **Test LiveKit connectivity** from the API server
5. **Compare room IDs** between Nostr events and API calls

The enhanced logging and diagnostics should help pinpoint whether this is a database issue, LiveKit connectivity problem, or something else entirely.