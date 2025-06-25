# Nest Timeout and Restart Fixes

## Issues Addressed

### 1. LiveKit Empty Timeout Too Short
**Problem**: LiveKit was closing rooms after 5 minutes of being empty, causing "Nest is no longer active" errors.

**Solution**: 
- Increased `empty_timeout` from 300 seconds (5 minutes) to 1800 seconds (30 minutes)
- Increased `departure_timeout` from 20 seconds to 60 seconds
- Updated both the global config and API room creation calls

### 2. Restart Endpoint Reliability
**Problem**: The restart endpoint was failing with 404 errors and timing issues.

**Solutions**:
- Added better logging throughout the restart process
- Increased cleanup wait time from 1 second to 2 seconds
- Added proper error handling for different failure scenarios
- Ensured consistent timeout values between config and API

### 3. Frontend Error Handling
**Problem**: Users weren't getting clear feedback about what went wrong and how to fix it.

**Solutions**:
- Improved error messages to be more user-friendly
- Added retry buttons for non-host users
- Enhanced restart button conditions for hosts
- Added proper disconnect handling before restart

## Configuration Changes

### LiveKit Config (`config/livekit.yaml`)
```yaml
room:
  auto_create: true
  max_participants: 500
  empty_timeout: 1800  # 30 minutes (was 300)
  departure_timeout: 60  # 1 minute (was 20)
```

### API Changes (`api/server.js`)
- Updated `createRoom` calls to use 1800-second timeout
- Enhanced restart endpoint with better error handling and logging
- Added longer cleanup wait times

### Frontend Changes (`src/components/NestRoom.tsx`)
- Improved error message detection and display
- Added retry functionality for non-host users
- Enhanced restart flow with proper disconnection
- Better timeout handling

## Testing the Fixes

1. **Create a nest** and verify it stays active for longer periods
2. **Leave the nest empty** for more than 5 minutes and confirm it doesn't auto-close
3. **Test the restart functionality** when a nest does timeout
4. **Verify error messages** are clear and actionable
5. **Test retry functionality** for both hosts and non-hosts

## Monitoring

Watch the logs for:
- `Successfully restarted nest {roomId} for host {pubkey}`
- `Created new LiveKit room {roomId} with 30-minute timeout`
- Any remaining 404 errors on restart attempts

## Future Improvements

1. **Automatic reconnection**: Implement background checks to detect when rooms go offline
2. **Heartbeat system**: Keep rooms alive with periodic pings when users are present
3. **Better state synchronization**: Ensure Redis and LiveKit state stay in sync
4. **Graceful degradation**: Handle partial failures more elegantly