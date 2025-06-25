# Multiple Browser Troubleshooting Guide

This guide helps resolve issues when joining Nests from multiple browser tabs or windows.

## Common Issues

### 1. Second Browser Can't Join After First Browser Joins

**Symptoms:**
- First browser joins successfully
- Second browser gets connection errors, timeouts, or "room not found" errors
- Audio doesn't work in the second browser

**Root Causes:**
- LiveKit room session conflicts
- Race conditions during room recreation
- Browser tab session management issues
- Service URL environment mismatches

**Solutions:**

#### Immediate Fixes:
1. **Close other tabs** - The app now detects multiple tabs and shows a warning
2. **Restart the nest** - If you're the host, use the "Restart Nest" button
3. **Refresh the page** - Try refreshing the second browser tab
4. **Wait and retry** - Sometimes waiting 30-60 seconds helps

#### For Hosts:
1. **Use the Restart Nest feature** - This creates a fresh room for all participants
2. **Check environment consistency** - Ensure all users are on the same environment (dev/prod)
3. **Monitor the debug info** - Check the connection status panel for service URL mismatches

#### For Participants:
1. **Use only one tab** - Keep the nest open in only one browser tab
2. **Join as guest if needed** - Try joining without logging in first
3. **Check microphone permissions** - Ensure your browser has microphone access

## Technical Improvements Made

### Frontend Improvements:
1. **Session Management** - Added tab detection and warnings
2. **Connection State Handling** - Better cleanup when switching between connections
3. **Error Recovery** - Improved retry logic and user feedback
4. **Multi-tab Detection** - Visual warnings when multiple tabs are detected

### Backend Improvements:
1. **Race Condition Prevention** - Added Redis locks for room creation
2. **Concurrent User Handling** - Better handling when multiple users join simultaneously
3. **Room Recreation Logic** - Improved logic for recreating expired rooms
4. **Logging and Debugging** - Enhanced logging for troubleshooting

## Prevention Tips

### For Users:
- **One tab per nest** - Only keep one browser tab open per nest
- **Use incognito for testing** - When testing, use incognito mode to avoid session conflicts
- **Clear browser cache** - If issues persist, clear browser cache and cookies

### For Developers:
- **Test with multiple browsers** - Always test joining from multiple browsers
- **Monitor server logs** - Check both frontend console and backend logs
- **Use proper environment URLs** - Ensure service URLs match the current environment

## Debugging Information

When reporting issues, include:
1. **Browser and version**
2. **Number of tabs/windows open**
3. **Console error messages**
4. **Network tab information**
5. **Whether you're the host or participant**
6. **Environment (development/production)**

## Advanced Troubleshooting

### Check Session Storage:
```javascript
// In browser console
console.log('Active sessions:', localStorage.getItem('nests-active-sessions'));
```

### Clear Session Data:
```javascript
// In browser console
localStorage.removeItem('nests-active-sessions');
```

### Check LiveKit Connection:
Look for these console messages:
- "LiveKit connecting with config"
- "LiveKit room connected successfully"
- "Multiple tabs detected"
- "Service URL mismatch detected"

## When to Contact Support

Contact support if:
- Issues persist after trying all solutions
- You see consistent "Service URL mismatch" warnings
- The nest becomes completely inaccessible
- Audio works in one browser but never in others

Include the debug information from the connection status panel when contacting support.