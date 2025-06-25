#!/bin/bash

# Validate LiveKit configuration

echo "=== LiveKit Configuration Validation ==="
echo

# Check if config file exists
if [ ! -f "config/livekit.yaml" ]; then
    echo "❌ LiveKit config file not found: config/livekit.yaml"
    exit 1
fi

echo "✅ LiveKit config file exists"

# Check if Docker Compose file exists
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Docker Compose file not found: docker-compose.yml"
    exit 1
fi

echo "✅ Docker Compose file exists"

# Check if .env file exists
if [ ! -f "api/.env" ]; then
    echo "❌ Environment file not found: api/.env"
    exit 1
fi

echo "✅ Environment file exists"

# Validate YAML syntax
echo
echo "=== Validating YAML Syntax ==="
if command -v python3 > /dev/null 2>&1; then
    python3 -c "
import yaml
import sys
try:
    with open('config/livekit.yaml', 'r') as f:
        yaml.safe_load(f)
    print('✅ LiveKit YAML syntax is valid')
except yaml.YAMLError as e:
    print(f'❌ YAML syntax error: {e}')
    sys.exit(1)
except Exception as e:
    print(f'❌ Error reading file: {e}')
    sys.exit(1)
"
else
    echo "⚠️  Python3 not available, skipping YAML validation"
fi

# Check key configuration values
echo
echo "=== Configuration Values ==="
echo "LiveKit port: $(grep '^port:' config/livekit.yaml | cut -d' ' -f2)"
echo "RTC port: $(grep 'tcp_port:' config/livekit.yaml | cut -d' ' -f4)"
echo "Empty timeout: $(grep 'empty_timeout:' config/livekit.yaml | cut -d' ' -f4) seconds"
echo "Departure timeout: $(grep 'departure_timeout:' config/livekit.yaml | cut -d' ' -f4) seconds"

# Check environment variables
echo
echo "=== Environment Variables ==="
if [ -f "api/.env" ]; then
    echo "LiveKit URL: $(grep '^LIVEKIT_URL=' api/.env | cut -d'=' -f2)"
    echo "Redis URL: $(grep '^REDIS_URL=' api/.env | cut -d'=' -f2)"
    echo "API Key: $(grep '^LIVEKIT_API_KEY=' api/.env | cut -d'=' -f2)"
fi

echo
echo "=== Validation Complete ==="
echo "Configuration appears to be valid. You can now run:"
echo "  ./scripts/fix-audio-issues.sh"