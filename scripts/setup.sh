#!/bin/bash

# Nests Production Setup Script
set -e

echo "🏗️  Setting up Nests production environment..."

# Load Docker Compose compatibility
source "$(dirname "$0")/docker-compose-compat.sh"

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p config/ssl
mkdir -p api/logs
mkdir -p data/redis

# Copy environment file if it doesn't exist
if [ ! -f api/.env ]; then
    echo "📝 Creating environment file..."
    cp api/.env.example api/.env
    echo "⚠️  Please edit api/.env with your configuration before starting!"
fi

# Generate SSL certificates for development (self-signed)
if [ ! -f config/ssl/cert.pem ]; then
    echo "🔐 Generating self-signed SSL certificates for development..."
    openssl req -x509 -newkey rsa:4096 -keyout config/ssl/key.pem -out config/ssl/cert.pem -days 365 -nodes \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
    echo "✅ SSL certificates generated (self-signed for development)"
fi

# Set proper permissions
echo "🔒 Setting permissions..."
chmod 600 config/ssl/key.pem
chmod 644 config/ssl/cert.pem
chmod 755 api/logs

# Build the API container
echo "🐳 Building API container..."
docker_compose build nests-api

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit api/.env with your configuration"
echo "2. Update config/livekit.yaml with your settings"
echo "3. Update config/nginx.conf with your domain"
echo "4. Run: $DOCKER_COMPOSE_CMD up -d"
echo ""
echo "For development:"
echo "  $DOCKER_COMPOSE_CMD up"
echo ""
echo "For production:"
echo "  $DOCKER_COMPOSE_CMD --profile production up -d"