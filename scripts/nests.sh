#!/bin/bash

# Nests management script with Docker Compose V2 compatibility
set -e

# Load Docker Compose compatibility
source "$(dirname "$0")/docker-compose-compat.sh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "${BLUE}🏗️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Show usage
show_usage() {
    echo "Nests Management Script"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  setup           - Initial setup (creates directories, copies configs)"
    echo "  dev             - Start development environment"
    echo "  prod            - Start production environment"
    echo "  stop            - Stop all services"
    echo "  restart         - Restart all services"
    echo "  logs [service]  - View logs (optionally for specific service)"
    echo "  status          - Show service status"
    echo "  build           - Build all containers"
    echo "  clean           - Clean up containers and volumes"
    echo "  shell <service> - Open shell in service container"
    echo "  test            - Run API tests"
    echo ""
    echo "Examples:"
    echo "  $0 setup"
    echo "  $0 dev"
    echo "  $0 logs nests-api"
    echo "  $0 shell nests-api"
    echo ""
    echo "Using: $DOCKER_COMPOSE_CMD"
}

# Setup function
setup() {
    print_header "Setting up Nests environment"
    
    # Create directories
    mkdir -p config/ssl api/logs data/redis
    print_success "Created directories"
    
    # Copy environment file
    if [ ! -f api/.env ]; then
        cp api/.env.example api/.env
        print_success "Created api/.env from example"
        print_warning "Please edit api/.env with your configuration"
    else
        print_warning "api/.env already exists"
    fi
    
    # Generate SSL certificates for development
    if [ ! -f config/ssl/cert.pem ]; then
        print_header "Generating self-signed SSL certificates"
        openssl req -x509 -newkey rsa:4096 -keyout config/ssl/key.pem -out config/ssl/cert.pem -days 365 -nodes \
            -subj "/C=US/ST=State/L=City/O=Nests/CN=localhost" 2>/dev/null
        chmod 600 config/ssl/key.pem
        chmod 644 config/ssl/cert.pem
        print_success "Generated SSL certificates"
    else
        print_warning "SSL certificates already exist"
    fi
    
    # Build containers
    print_header "Building containers"
    docker_compose build
    print_success "Setup complete!"
}

# Development environment
dev() {
    print_header "Starting development environment"
    
    # Set development defaults in .env if needed
    if grep -q "NODE_ENV=production" api/.env 2>/dev/null; then
        sed -i 's/NODE_ENV=production/NODE_ENV=development/' api/.env
        print_success "Set NODE_ENV to development"
    fi
    
    docker_compose up --build
}

# Production environment
prod() {
    print_header "Starting production environment"
    
    # Validate environment
    if [ ! -f api/.env ]; then
        print_error "Environment file api/.env not found!"
        echo "Run: $0 setup"
        exit 1
    fi
    
    # Check SSL certificates
    if [ ! -f config/ssl/cert.pem ] || [ ! -f config/ssl/key.pem ]; then
        print_error "SSL certificates not found in config/ssl/"
        echo "For production, place your SSL certificates there."
        echo "For development, run: $0 setup"
        exit 1
    fi
    
    docker_compose --profile production up -d
    print_success "Production environment started"
}

# Stop services
stop() {
    print_header "Stopping services"
    docker_compose down
    print_success "Services stopped"
}

# Restart services
restart() {
    print_header "Restarting services"
    docker_compose restart
    print_success "Services restarted"
}

# View logs
logs() {
    if [ -n "$1" ]; then
        print_header "Viewing logs for $1"
        docker_compose logs -f "$1"
    else
        print_header "Viewing all logs"
        docker_compose logs -f
    fi
}

# Show status
status() {
    print_header "Service status"
    docker_compose ps
    echo ""
    print_header "Resource usage"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
}

# Build containers
build() {
    print_header "Building containers"
    docker_compose build --no-cache
    print_success "Build complete"
}

# Clean up
clean() {
    print_warning "This will remove all containers, networks, and volumes"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_header "Cleaning up"
        docker_compose down -v --remove-orphans
        docker system prune -f
        print_success "Cleanup complete"
    else
        print_success "Cleanup cancelled"
    fi
}

# Open shell in container
shell() {
    if [ -z "$1" ]; then
        print_error "Please specify a service name"
        echo "Available services: nests-api, livekit, redis"
        exit 1
    fi
    
    print_header "Opening shell in $1"
    docker_compose exec "$1" /bin/sh
}

# Run tests
test() {
    print_header "Running API tests"
    docker_compose exec nests-api npm test
}

# Main command handling
case "$1" in
    setup)
        setup
        ;;
    dev)
        dev
        ;;
    prod)
        prod
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    logs)
        logs "$2"
        ;;
    status)
        status
        ;;
    build)
        build
        ;;
    clean)
        clean
        ;;
    shell)
        shell "$2"
        ;;
    test)
        test
        ;;
    *)
        show_usage
        exit 1
        ;;
esac