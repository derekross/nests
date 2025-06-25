#!/bin/bash

# Production startup script
set -e

echo "🚀 Starting Nests production environment..."

# Load Docker Compose compatibility
source "$(dirname "$0")/docker-compose-compat.sh"

# Check if .env exists
if [ ! -f api/.env ]; then
    echo "❌ Environment file api/.env not found!"
    echo "Please copy api/.env.example to api/.env and configure it."
    exit 1
fi

# Validate required environment variables
source api/.env

required_vars=("LIVEKIT_API_KEY" "LIVEKIT_API_SECRET" "REDIS_URL")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Required environment variable $var is not set!"
        exit 1
    fi
done

# Check SSL certificates
if [ ! -f config/ssl/cert.pem ] || [ ! -f config/ssl/key.pem ]; then
    echo "❌ SSL certificates not found!"
    echo "Please place your SSL certificates in config/ssl/"
    echo "  - config/ssl/cert.pem"
    echo "  - config/ssl/key.pem"
    exit 1
fi

# Start production services
echo "🐳 Starting production services..."
docker_compose --profile production up -d

echo "✅ Production environment started!"
echo ""
echo "Services:"
echo "  - Nests API: https://your-domain.com/api/"
echo "  - LiveKit: wss://your-domain.com/livekit/"
echo "  - Web: https://your-domain.com"
echo ""
echo "To check status: $DOCKER_COMPOSE_CMD ps"
echo "To view logs: $DOCKER_COMPOSE_CMD logs -f"
echo "To stop: $DOCKER_COMPOSE_CMD down"