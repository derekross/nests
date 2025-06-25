#!/bin/bash

# Docker Compose compatibility script
# Automatically detects and uses the correct Docker Compose command

# Function to detect Docker Compose version
detect_docker_compose() {
    if docker compose version &> /dev/null; then
        echo "docker compose"
    elif docker-compose --version &> /dev/null; then
        echo "docker-compose"
    else
        echo "none"
    fi
}

# Get the Docker Compose command
DOCKER_COMPOSE_CMD=$(detect_docker_compose)

if [ "$DOCKER_COMPOSE_CMD" = "none" ]; then
    echo "❌ Neither Docker Compose V1 (docker-compose) nor V2 (docker compose) found!"
    echo "Please install Docker Compose."
    exit 1
fi

# Export the command for use in other scripts
export DOCKER_COMPOSE_CMD

# Function to run Docker Compose with detected command
docker_compose() {
    if [ "$DOCKER_COMPOSE_CMD" = "docker compose" ]; then
        docker compose "$@"
    else
        docker-compose "$@"
    fi
}

# If script is sourced, just export the function
if [[ "${BASH_SOURCE[0]}" != "${0}" ]]; then
    export -f docker_compose
    echo "✅ Docker Compose compatibility loaded: $DOCKER_COMPOSE_CMD"
    return 0
fi

# If script is executed directly, run the command
if [ $# -eq 0 ]; then
    echo "Docker Compose command: $DOCKER_COMPOSE_CMD"
    echo "Usage: $0 [docker-compose-arguments]"
    echo "Example: $0 up -d"
else
    echo "Running: $DOCKER_COMPOSE_CMD $*"
    docker_compose "$@"
fi