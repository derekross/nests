#!/bin/bash

# Debug script for LiveKit and Nests API issues

echo "=== LiveKit and Nests API Debug Script ==="
echo

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

echo "✅ Docker is running"

# Check container status
echo
echo "=== Container Status ==="
docker compose ps

echo
echo "=== LiveKit Container Logs (last 20 lines) ==="
docker compose logs --tail=20 livekit

echo
echo "=== Nests API Container Logs (last 20 lines) ==="
docker compose logs --tail=20 nests-api

echo
echo "=== Redis Container Logs (last 10 lines) ==="
docker compose logs --tail=10 redis

# Check if services are responding
echo
echo "=== Service Health Checks ==="

# Check LiveKit health
echo -n "LiveKit (port 7880): "
if curl -s http://localhost:7880 > /dev/null 2>&1; then
    echo "✅ Responding"
else
    echo "❌ Not responding"
fi

# Check Nests API health
echo -n "Nests API (port 5544): "
if curl -s http://localhost:5544/health > /dev/null 2>&1; then
    echo "✅ Responding"
    echo "   Health check response:"
    curl -s http://localhost:5544/health | jq . 2>/dev/null || curl -s http://localhost:5544/health
else
    echo "❌ Not responding"
fi

# Check Redis health
echo -n "Redis (port 6379): "
if docker compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Responding"
else
    echo "❌ Not responding"
fi

echo
echo "=== LiveKit Room Information ==="
echo "Checking for active rooms..."

# Try to get room list from LiveKit API (if available)
if command -v livekit-cli > /dev/null 2>&1; then
    livekit-cli list-rooms --url ws://localhost:7880 --api-key nests-api-key --api-secret nests-super-secret-key-change-in-production 2>/dev/null || echo "LiveKit CLI not available or rooms not accessible"
else
    echo "LiveKit CLI not installed. Install with: go install github.com/livekit/livekit-cli@latest"
fi

echo
echo "=== Restart Services ==="
echo "To restart all services: docker compose restart"
echo "To restart just LiveKit: docker compose restart livekit"
echo "To restart just Nests API: docker compose restart nests-api"
echo "To view live logs: docker compose logs -f [service-name]"

echo
echo "=== Common Issues and Solutions ==="
echo "1. If LiveKit rooms aren't staying active:"
echo "   - Check emptyTimeout and departureTimeout in config/livekit.yaml"
echo "   - Ensure participants are properly connecting and not immediately disconnecting"
echo
echo "2. If Nests API is crashing:"
echo "   - Check logs with: docker-compose logs nests-api"
echo "   - Ensure Redis is running and accessible"
echo "   - Verify LiveKit API keys match between .env and livekit.yaml"
echo
echo "3. If participants can't join:"
echo "   - Verify CORS settings in .env file"
echo "   - Check network connectivity between containers"
echo "   - Ensure JWT tokens are being generated correctly"

echo
echo "=== Debug Complete ==="