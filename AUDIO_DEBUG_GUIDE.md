# Audio Issues Debug Guide

## Current Status
✅ Restart endpoint is working  
❌ Audio not working after restart

## Debugging Steps

### 1. Check Browser Console
Look for these specific log messages:

**During Restart:**
```
Nest restart response: {roomId: '...', endpoints: [...], token: {...}, message: '...'}
Connecting with restart token: {serverUrl: '...', tokenType: '...', token: '...'}
LiveKit connecting with config: {serverUrl: '...', hasToken: true, tokenLength: ...}
```

**During Connection:**
```
LiveKit room connected successfully
Local track published: microphone muted: false
```

### 2. Common Audio Issues & Solutions

#### Issue: Token Format Problem
**Symptoms:** Connection succeeds but no audio
**Check:** Is `response.token` a string or object?
**Solution:** If it's an object, extract the JWT string

#### Issue: Microphone Permissions
**Symptoms:** "Microphone permission denied" in console
**Check:** Browser permissions for microphone access
**Solution:** Allow microphone access in browser settings

#### Issue: LiveKit Connection Problems
**Symptoms:** "Failed to connect to room" errors
**Check:** LiveKit server URL and token validity
**Solution:** Verify LiveKit server is running and accessible

#### Issue: Audio Device Problems
**Symptoms:** Connected but no audio input/output
**Check:** Browser's audio device settings
**Solution:** Check default microphone/speaker settings

### 3. Browser Developer Tools Checks

#### Network Tab
- Look for WebSocket connections to LiveKit server
- Check for any failed requests to `/api/v1/nests/.../restart`

#### Console Tab
- Look for LiveKit-specific errors
- Check for WebRTC-related warnings
- Monitor microphone permission requests

#### Application Tab
- Check if microphone permissions are granted
- Look for any stored audio device preferences

### 4. LiveKit Server Logs
Check Docker container logs:
```bash
docker logs nests-livekit-1 --tail 50
```

Look for:
- Room creation/deletion events
- Participant join/leave events
- Audio track publish/unpublish events

### 5. API Server Logs
Check API container logs:
```bash
docker logs nests-nests-api-1 --tail 50
```

Look for:
- Restart endpoint hits
- Token generation success/failure
- LiveKit API calls

## Enhanced Debugging Features Added

### 1. Microphone Permission Checks
- Pre-flight permission check before connecting
- Clear error messages for permission issues

### 2. Enhanced LiveKit Logging
- Detailed connection state logging
- Audio track state monitoring
- Device error handling

### 3. Token Debugging
- Log token type and format
- Compare join vs restart token handling

## Testing Checklist

1. **Initial Connection Test**
   - [ ] Create new nest
   - [ ] Join as host
   - [ ] Verify audio works
   - [ ] Check microphone button toggles

2. **Restart Flow Test**
   - [ ] Let nest timeout or manually restart
   - [ ] Click "Restart Nest" button
   - [ ] Check console for restart logs
   - [ ] Verify reconnection succeeds
   - [ ] Test microphone functionality

3. **Permission Test**
   - [ ] Deny microphone permission
   - [ ] Try to join/restart
   - [ ] Verify error message appears
   - [ ] Grant permission and retry

## Next Steps

If audio still doesn't work after restart:

1. **Compare Tokens**: Check if restart token differs from join token
2. **Check Room State**: Verify LiveKit room is properly recreated
3. **Test Audio Devices**: Try different microphones/browsers
4. **Check WebRTC**: Look for WebRTC connection issues

## Common Fixes

### Fix 1: Token Format Issue
If restart token is an object instead of string:
```javascript
// In handleRestartNest, change:
token: response.token
// To:
token: typeof response.token === 'string' ? response.token : response.token.jwt
```

### Fix 2: Audio Context Issues
Add audio context resume after restart:
```javascript
// After successful connection
if (window.AudioContext) {
  const audioContext = new AudioContext();
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
}
```

### Fix 3: Device Re-enumeration
Force device re-enumeration after restart:
```javascript
// Before connecting
await navigator.mediaDevices.enumerateDevices();
```