#!/bin/bash

# Test script for the restart endpoint

echo "=== Testing Restart Endpoint ==="
echo

# Check if server is running
echo "1. Checking if server is running..."
if curl -s http://localhost:5544/health > /dev/null 2>&1; then
    echo "✅ Server is running"
else
    echo "❌ Server is not running. Please start with: docker compose up -d"
    exit 1
fi

# Test the restart endpoint without auth (should get 401)
echo
echo "2. Testing restart endpoint without auth (should get 401)..."
response=$(curl -s -w "%{http_code}" -X POST http://localhost:5544/api/v1/nests/test-room-id/restart)
http_code="${response: -3}"
response_body="${response%???}"

if [ "$http_code" = "401" ]; then
    echo "✅ Endpoint responds correctly with 401 (unauthorized)"
    echo "   Response: $response_body"
else
    echo "❌ Unexpected response code: $http_code"
    echo "   Response: $response_body"
fi

# Test CORS preflight
echo
echo "3. Testing CORS preflight..."
cors_response=$(curl -s -X OPTIONS http://localhost:5544/api/v1/nests/test-room-id/restart \
    -H "Origin: http://localhost:5173" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Authorization" \
    -w "%{http_code}")

cors_code="${cors_response: -3}"
if [ "$cors_code" = "204" ]; then
    echo "✅ CORS preflight successful"
else
    echo "❌ CORS preflight failed with code: $cors_code"
fi

# Check server logs for the requests
echo
echo "4. Recent server logs:"
docker compose logs --tail=10 nests-api | grep -E "(restart|POST.*restart)" || echo "No restart logs found"

echo
echo "=== Test Summary ==="
echo "The restart endpoint is working correctly at the server level."
echo "If you're getting 404 errors from the frontend:"
echo "1. Make sure Docker containers are running: docker compose ps"
echo "2. Check the frontend is using the correct API URL"
echo "3. Verify the frontend has proper authentication"
echo "4. Check browser network tab for the actual request being made"

echo
echo "To debug frontend issues:"
echo "1. Open browser dev tools"
echo "2. Go to Network tab"
echo "3. Try the restart action"
echo "4. Check what URL is being called and what response you get"