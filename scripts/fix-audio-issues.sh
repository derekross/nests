#!/bin/bash

# Comprehensive fix script for LiveKit audio room issues

echo "=== Fixing LiveKit Audio Room Issues ==="
echo

# Stop all services
echo "🔄 Stopping all services..."
docker compose down

# Clean up any orphaned containers
echo "🧹 Cleaning up orphaned containers..."
docker compose down --remove-orphans

# Remove any existing volumes to ensure clean state
echo "🗑️  Removing old volumes for clean restart..."
docker volume rm $(docker volume ls -q | grep -E "(redis|livekit)" 2>/dev/null) 2>/dev/null || true

# Ensure logs directory exists
echo "📁 Creating logs directory..."
mkdir -p api/logs

# Start Redis first
echo "🚀 Starting Redis..."
docker compose up -d redis

# Wait for Redis to be ready
echo "⏳ Waiting for Redis to be ready..."
sleep 5

# Start LiveKit
echo "🚀 Starting LiveKit..."
docker compose up -d livekit

# Wait for LiveKit to be ready
echo "⏳ Waiting for LiveKit to be ready..."
sleep 10

# Check if LiveKit is responding
echo "🔍 Checking LiveKit health..."
for i in {1..30}; do
    if curl -s http://localhost:7880 > /dev/null 2>&1; then
        echo "✅ LiveKit is responding"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ LiveKit failed to start properly"
        echo "LiveKit logs:"
        docker compose logs livekit
        exit 1
    fi
    echo "   Attempt $i/30 - waiting..."
    sleep 2
done

# Start Nests API
echo "🚀 Starting Nests API..."
docker compose up -d nests-api

# Wait for Nests API to be ready
echo "⏳ Waiting for Nests API to be ready..."
sleep 10

# Check if Nests API is responding
echo "🔍 Checking Nests API health..."
for i in {1..30}; do
    if curl -s http://localhost:5544/health > /dev/null 2>&1; then
        echo "✅ Nests API is responding"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Nests API failed to start properly"
        echo "Nests API logs:"
        docker compose logs nests-api
        exit 1
    fi
    echo "   Attempt $i/30 - waiting..."
    sleep 2
done

# Test the complete stack
echo
echo "🧪 Testing the complete stack..."

# Test health endpoint
echo "Testing health endpoint..."
health_response=$(curl -s http://localhost:5544/health)
echo "Health response: $health_response"

# Test token generation
echo "Testing token generation..."
token_response=$(curl -s http://localhost:5544/debug/test-token)
echo "Token test response: $token_response"

echo
echo "✅ All services are running!"
echo
echo "=== Service Status ==="
docker compose ps

echo
echo "=== Next Steps ==="
echo "1. Try creating a new nest from the frontend"
echo "2. If issues persist, check logs with: docker compose logs -f [service-name]"
echo "3. Use the debug script: ./scripts/debug-livekit.sh"

echo
echo "=== Configuration Summary ==="
echo "- LiveKit timeout: 60 minutes (empty), 5 minutes (departure)"
echo "- Room recreation logic simplified to prevent race conditions"
echo "- Logger initialization fixed in nests-api"
echo "- Docker networking configured for container communication"

echo
echo "🎉 Fix script completed successfully!"