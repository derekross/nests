# Nest Synchronization Issue Debugging Guide

## Problem Description

You're experiencing a synchronization issue where:
- **Computer A**: Shows "Connected" (green badge) and can join the nest successfully
- **Computer B**: Shows "Disconnected" and gets "Nest not found" when trying to join
- **LiveKit logs**: Show the room has been created and participants are active

This indicates a timing/synchronization issue between the Nostr event publication and the LiveKit room creation.

## Root Cause Analysis

The issue occurs because:

1. **Nest Creation Process**:
   - Nostr event (kind 30312) is published to relays
   - API call creates LiveKit room
   - These two operations happen asynchronously

2. **Timing Issue**:
   - Computer A: Sees the nest event quickly (fast relay sync)
   - Computer B: Sees the nest event later (slower relay sync)
   - LiveKit room exists but API hasn't fully synchronized

3. **Race Condition**:
   - User tries to join before the API/LiveKit sync is complete
   - Results in "Not Found" error even though room exists

## Improvements Made

### 1. Smart Join Strategy

**New Feature**: Implemented intelligent join fallback mechanism:

```typescript
// Smart join tries authenticated first, falls back to guest automatically
const response = await joinNestSmart(roomId);

// Shows toast if user was joined as guest when expecting authenticated access
if (user && response.joinType === 'guest') {
  toast({
    title: "Joined as Guest",
    description: "You were connected as a guest. Some features may be limited.",
  });
}
```

**Benefits**:
- **Authenticated users**: Try authenticated join first, fall back to guest if 404
- **Guest users**: Use guest endpoint directly
- **Automatic fallback**: No manual intervention needed
- **User feedback**: Toast notification when fallback occurs

### 2. Enhanced Error Detection & Messaging

**Before**: Generic "Not Found" error confused users
**After**: Smart error detection that checks nest age:

```typescript
// Check if this is a timing issue - nest was just created
const timeSinceCreated = nest ? Math.floor(Date.now() / 1000) - nest.created_at : 0;
if (timeSinceCreated < 30) {
  setJoinError('The nest is still starting up. Please wait a moment and try again.');
} else {
  setJoinError('This nest is no longer available. The audio session may have timed out or been closed.');
}
```

### 2. Improved Guest Experience

- **Sign-in Encouragement**: When guests get "Not Found", they see a clear message to sign in
- **Better Button Labels**: "Join as Guest" vs "Join Audio" for clarity
- **Chat Integration**: Sign-in prompts in chat area for guests

### 3. Enhanced Debugging Information

Added comprehensive debug info in the error display:

```typescript
<p className="text-xs">Nest Status: {currentStatus}</p>
<p className="text-xs">Created: {nest ? new Date(nest.created_at * 1000).toLocaleString() : 'Unknown'}</p>
<p className="text-xs">Age: {nest ? Math.floor((Date.now() / 1000) - nest.created_at) : 'Unknown'}s</p>
```

### 4. Retry Mechanism

Added retry button for "still starting up" errors:

```typescript
{!isHost && (joinError.includes('no longer available') || joinError.includes('timeout') || joinError.includes('still starting up')) && (
  <Button onClick={handleJoinNest} disabled={isConnecting}>
    {isConnecting ? 'Retrying...' : 'Retry Connection'}
  </Button>
)}
```

### 5. Enhanced Logging

Added detailed logging for debugging:

```typescript
console.log('Attempting to join nest:', {
  roomId,
  liveKitUrl,
  nestNaddr,
  user: user ? 'logged in' : 'guest',
  nestStatus: currentStatus,
  nestCreatedAt: nest?.created_at,
  timeSinceCreated: nest ? Math.floor(Date.now() / 1000) - nest.created_at : 'unknown'
});
```

## Debugging Steps

When you encounter the sync issue:

1. **Check the Debug Info** (visible in error state):
   - Room ID
   - Nest Status
   - Creation time
   - Age in seconds

2. **Look for Timing Patterns**:
   - If age < 30 seconds: Likely sync issue
   - If age > 30 seconds: Likely actual room closure

3. **Console Logs** (open browser dev tools):
   - Check for detailed join attempt logs
   - Look for API response details
   - Monitor LiveKit connection attempts

4. **Retry Strategy**:
   - For new nests (< 30s): Wait and retry
   - For older nests: Check if host needs to restart

## Prevention Strategies

### For Hosts:
1. **Wait Before Sharing**: Give the nest 10-15 seconds to fully sync before sharing the link
2. **Monitor Status**: Check that the nest shows "Connected" before inviting others
3. **Use Restart**: If sync issues persist, use the "Restart Nest" button

### For Guests:
1. **Be Patient**: If you see "still starting up", wait 10-15 seconds and retry
2. **Sign In**: Authenticated users have better access to nest APIs
3. **Check Age**: Look at the debug info to see if the nest is very new

## Technical Details

### API Endpoints Involved:
- `PUT /api/v1/nests` - Create nest (requires auth)
- `GET /api/v1/nests/{roomId}` - Join as authenticated user (requires auth)
- `GET /api/v1/nests/{roomId}/guest` - Join as guest (no auth required)

### Authentication Requirements:
- **Authenticated Join**: Requires NIP-98 HTTP Auth header
- **Guest Join**: No authentication required
- **Smart Join**: Tries authenticated first, falls back to guest on 404

### Sync Dependencies:
1. Nostr relay propagation
2. LiveKit room creation
3. API database updates
4. Client cache invalidation

### Error Codes:
- `404 Not Found`: Room doesn't exist in API yet
- `401 Unauthorized`: Authentication issues
- `403 Forbidden`: Permission denied

## Future Improvements

1. **Polling Mechanism**: Automatically retry failed joins for new nests
2. **Status Indicators**: Real-time sync status in the UI
3. **Optimistic UI**: Show "Starting..." state during creation
4. **Health Checks**: Verify API/LiveKit sync before allowing joins

This improved error handling and debugging should help identify and resolve the synchronization issues you're experiencing.