# Audio Room Issues - Complete Fix

## Summary of Issues Fixed

Your Nostr audio application was experiencing several critical issues that prevented LiveKit audio rooms from working properly:

### 🔧 **Fixed Issues**

1. **Logger Crash**: The nests-api server was crashing because the logger was being used before it was initialized
2. **Docker Networking**: Services couldn't communicate because URLs pointed to `localhost` instead of Docker service names
3. **Room Persistence**: Rooms were being deleted too quickly (30 minutes) and had short reconnection timeouts (1 minute)
4. **Race Conditions**: Complex room recreation logic was causing conflicts when multiple users tried to join simultaneously
5. **Monitoring**: Limited visibility into what was happening with LiveKit connections and room lifecycle

### ✅ **Applied Fixes**

1. **Logger Initialization**: Moved logger setup to the top of `api/server.js`
2. **Docker Configuration**: Updated `.env` to use proper Docker service names:
   - `LIVEKIT_URL=ws://livekit:7880` (was `localhost`)
   - `REDIS_URL=redis://redis:6379` (was `localhost`)
3. **Extended Timeouts**: Increased room persistence:
   - Empty timeout: 60 minutes (was 30)
   - Departure timeout: 5 minutes (was 1)
4. **Simplified Logic**: Removed complex Redis locking, simplified room recreation
5. **Enhanced Monitoring**: Added health checks, better logging, debug tools

## 🚀 How to Apply the Fixes

### Step 1: Validate Configuration (Optional)
```bash
# Validate the configuration first
./scripts/validate-config.sh
```

### Step 2: Use the Automated Fix Script (Recommended)
```bash
# Run the comprehensive fix script
./scripts/fix-audio-issues.sh
```

This script will:
- Stop all services cleanly
- Remove old volumes for a fresh start
- Start services in the correct order
- Verify each service is working
- Test the complete stack

### Option 2: Manual Restart
```bash
# Stop everything
docker compose down --remove-orphans

# Start services in order
docker compose up -d redis
sleep 5
docker compose up -d livekit
sleep 10
docker compose up -d nests-api
```

## 🔍 Debugging Tools

### Debug Script
```bash
./scripts/debug-livekit.sh
```

This will show you:
- Container status
- Service health checks
- Recent logs from all services
- Common troubleshooting steps

### Monitor Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f livekit
docker compose logs -f nests-api
docker compose logs -f redis
```

## 🧪 Testing the Fix

After applying the fixes, test these scenarios:

1. **Host Creates Nest**: Should work without crashes
2. **Host Joins Own Nest**: Should connect to audio room
3. **Participants Join**: Multiple users should be able to join
4. **Audio Quality**: Clear audio without dropouts
5. **Reconnection**: Users should be able to rejoin after brief disconnections
6. **Room Persistence**: Room should stay active even when empty for short periods
7. **Guest Access**: Unauthenticated users should be able to listen

## 📊 Expected Improvements

- **Stability**: No more server crashes due to logger issues
- **Reliability**: Rooms stay active for 60 minutes instead of 30
- **Reconnection**: 5-minute grace period for users to reconnect
- **Scalability**: Simplified logic handles multiple simultaneous connections better
- **Debugging**: Much better visibility into what's happening

## 🔧 Configuration Changes Made

### LiveKit (`config/livekit.yaml`)
```yaml
room:
  empty_timeout: 3600  # 60 minutes
  departure_timeout: 300  # 5 minutes
```

### Environment (`api/.env`)
```bash
LIVEKIT_URL=ws://livekit:7880  # Docker service name
REDIS_URL=redis://redis:6379   # Docker service name
```

### Server Code (`api/server.js`)
- Logger initialization moved to top
- Simplified room recreation logic
- Enhanced error handling and logging
- Periodic health checks every 5 minutes

## 🚨 If Issues Persist

1. **Run the debug script**: `./scripts/debug-livekit.sh`
2. **Check service logs**: `docker compose logs -f [service-name]`
3. **Verify Docker networking**: Ensure containers can communicate
4. **Check API keys**: Verify LiveKit API keys match between `.env` and `livekit.yaml`
5. **Test step by step**: Create nest → join as host → add participants

## 📝 Key Files Modified

- `api/server.js` - Fixed logger, simplified room logic, enhanced monitoring
- `api/.env` - Updated URLs for Docker networking
- `config/livekit.yaml` - Increased timeouts for better persistence
- `scripts/fix-audio-issues.sh` - New automated fix script
- `scripts/debug-livekit.sh` - New debugging tool

The fixes address the root causes of your audio room issues. The combination of proper Docker networking, extended timeouts, simplified logic, and better monitoring should resolve the problems with rooms not staying active and multiple users being unable to join.

**Run `./scripts/fix-audio-issues.sh` to apply all fixes automatically!**