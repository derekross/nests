#!/bin/bash

# Test script for restart recovery functionality

echo "=== Testing Restart Recovery ==="
echo

# Check if server is running
echo "1. Checking if server is running..."
if ! curl -s http://localhost:5544/health > /dev/null 2>&1; then
    echo "❌ Server is not running. Please start with: docker compose up -d"
    exit 1
fi
echo "✅ Server is running"

# Create a test room directly in LiveKit (simulating a room that exists but has no Redis data)
echo
echo "2. Creating test room in LiveKit..."

# We'll use the API to create a nest first, then clear Redis to simulate the issue
echo "Creating a nest via API first..."

# Create a minimal auth header for testing (this is just for testing)
# In real usage, this would come from the frontend with proper NIP-98 auth
test_room_id="test-recovery-$(date +%s)"
echo "Test room ID: $test_room_id"

# For now, let's just test the restart endpoint with the room ID that was failing
failing_room_id="db83d016-f6ce-4884-852a-715021426edd"

echo
echo "3. Testing restart with missing Redis data..."
echo "Room ID: $failing_room_id"

# Test the restart endpoint (this should fail with proper auth, but we can see the logs)
echo "Making restart request (will fail due to auth, but we can check logs)..."
response=$(curl -s -w "%{http_code}" -X POST "http://localhost:5544/api/v1/nests/$failing_room_id/restart")
http_code="${response: -3}"
response_body="${response%???}"

echo "Response code: $http_code"
echo "Response body: $response_body"

echo
echo "4. Checking server logs for restart attempt..."
docker compose logs --tail=10 nests-api | grep -E "(restart|Restart)" || echo "No restart logs found"

echo
echo "=== Test Summary ==="
echo "The restart endpoint should now handle missing Redis data by:"
echo "1. Checking if the room exists in LiveKit"
echo "2. If it does, reconstructing minimal room info"
echo "3. Storing the reconstructed info in Redis"
echo "4. Proceeding with the restart"
echo
echo "To test with proper auth, use the frontend restart functionality."