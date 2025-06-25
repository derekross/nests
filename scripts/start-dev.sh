#!/bin/bash

# Development startup script
set -e

echo "🚀 Starting Nests development environment..."

# Load Docker Compose compatibility
source "$(dirname "$0")/docker-compose-compat.sh"

# Check if .env exists
if [ ! -f api/.env ]; then
    echo "📝 Creating development environment file..."
    cp api/.env.example api/.env
    
    # Set development defaults
    sed -i 's/NODE_ENV=production/NODE_ENV=development/' api/.env
    sed -i 's/your-domain.com/localhost:5173/' api/.env
fi

# Start services
echo "🐳 Starting Docker services..."
docker_compose up --build

echo "✅ Development environment started!"
echo ""
echo "Services:"
echo "  - Nests API: http://localhost:5544"
echo "  - LiveKit: ws://localhost:7880"
echo "  - Redis: localhost:6379"
echo ""
echo "To stop: Ctrl+C or $DOCKER_COMPOSE_CMD down"