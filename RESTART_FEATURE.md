# Nest Restart Feature

## Overview

The restart feature allows nest hosts to reactivate their nests when they become inactive or encounter connection issues. This solves the common problem where nests exist on Nostr but are no longer available in the audio API.

## How It Works

### Backend (API)

**New Endpoint**: `POST /api/v1/nests/:roomId/restart`

- **Authentication**: Requires NIP-98 authentication
- **Authorization**: Only the original nest host can restart their nest
- **Process**:
  1. Validates the requester is the original host
  2. Deletes the existing LiveKit room (if it exists)
  3. Creates a new LiveKit room with the same room ID
  4. Updates the room info in Redis with restart timestamp
  5. Returns new connection token and endpoints

### Frontend (React)

**New Hook**: `useRestartNest()`
- Returns a mutation function for restarting nests
- Handles authentication and error states
- Provides loading states during restart process

**UI Enhancements**:
1. **Error State Restart Button**: When a 404 error occurs and the user is the host, a "Restart Nest" button appears
2. **Header Restart Button**: Hosts see a "Restart" button in the nest header for proactive restarts
3. **Enhanced Error Messages**: Better user feedback explaining why nests might be unavailable

## User Experience

### For Hosts
- **Proactive Restart**: Use the "Restart" button in the header anytime
- **Reactive Restart**: When joining fails with 404, use the "Restart Nest" button
- **Automatic Connection**: After restart, automatically connects to the new session

### For Participants
- **Better Error Messages**: Clear explanations when nests are unavailable
- **Helpful Guidance**: Suggestions to contact the host or refresh the page
- **Debug Information**: Technical details for troubleshooting

## Error Handling

The feature includes comprehensive error handling:

- **403 Forbidden**: Only hosts can restart nests
- **404 Not Found**: Nest doesn't exist in the system
- **500 Server Error**: LiveKit or Redis connection issues
- **Network Errors**: Connection timeouts or failures

## Technical Details

### API Response Format
```json
{
  "roomId": "uuid-string",
  "endpoints": ["wss+livekit://..."],
  "token": "jwt-token",
  "message": "Nest restarted successfully"
}
```

### Security
- Uses NIP-98 authentication for all requests
- Validates host ownership before allowing restart
- Maintains original room permissions and metadata

### Performance
- Minimal downtime during restart (1-2 seconds)
- Preserves room configuration and participant permissions
- Automatic cleanup of old room resources

## Usage Examples

### Host Restarting Their Own Nest
1. Host notices connection issues or 404 errors
2. Clicks "Restart" button in header or error panel
3. System recreates the LiveKit room
4. Host automatically reconnects to new session
5. Participants can now join the restarted nest

### Participant Encountering Inactive Nest
1. Participant tries to join nest, gets 404 error
2. Sees helpful error message with guidance
3. Can contact host or wait for host to restart
4. Once restarted, can successfully join

## Benefits

1. **Improved Reliability**: Hosts can recover from API/LiveKit issues
2. **Better UX**: Clear error messages and recovery options
3. **Reduced Support**: Self-service recovery for common issues
4. **Maintained State**: Preserves nest metadata and permissions
5. **Quick Recovery**: Fast restart process with minimal downtime