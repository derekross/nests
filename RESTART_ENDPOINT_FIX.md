# Restart Endpoint Fix

## Issue
The restart endpoint was returning 404 (Not Found) errors:
```
POST http://localhost:5544/api/v1/nests/7d285875-7674-481e-afe7-efa51006b16b/restart 404 (Not Found)
```

## Root Cause
The API server was running in a Docker container that was built with the old code. The container needed to be rebuilt to pick up the updated server.js file with the restart endpoint improvements.

## Solution
1. **Rebuilt the Docker container** to include the updated API code
2. **Added debug logging** to help diagnose future routing issues
3. **Verified the endpoint is now accessible** and properly requiring authentication

## Steps Taken
```bash
# Rebuild the API container with updated code
docker compose build nests-api

# Restart the container with the new image
docker compose up -d nests-api

# Test the endpoint (now returns 401 instead of 404)
curl -X POST http://localhost:5544/api/v1/nests/test-room-id/restart -H "Content-Type: application/json"
```

## Verification
- **Before**: `{"error":"Endpoint not found"}` (404)
- **After**: `{"error":"Missing or invalid authorization header"}` (401)

The endpoint is now working correctly and requiring proper NIP-98 authentication as expected.

## Testing the Full Restart Flow
To test the complete restart functionality:

1. **Create a nest** through the frontend
2. **Join the nest** as the host
3. **Wait for the room to timeout** or manually trigger a restart
4. **Click the "Restart Nest" button** in the UI
5. **Verify the nest restarts** and you can reconnect

## Additional Improvements Made
- **Enhanced logging** throughout the restart process
- **Better error handling** for different failure scenarios  
- **Increased timeouts** (30 minutes instead of 5 minutes)
- **Improved frontend error messages** and retry options

## Container Management
When making changes to the API code, remember to:
1. **Rebuild the container**: `docker compose build nests-api`
2. **Restart the service**: `docker compose up -d nests-api`
3. **Check logs**: `docker logs nests-nests-api-1 --tail 20`