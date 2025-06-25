# Nests Management Scripts

This directory contains scripts for managing your Nests deployment with **Docker Compose V1 and V2 compatibility**.

## 🔧 **Scripts Overview**

### **Main Management Script**
- `nests.sh` - Unified management script with all common operations

### **Individual Scripts**
- `setup.sh` - Initial environment setup
- `start-dev.sh` - Start development environment
- `start-prod.sh` - Start production environment

### **Utility Scripts**
- `docker-compose-compat.sh` - Docker Compose version compatibility layer

## 🚀 **Quick Start**

### **Using the Unified Script (Recommended)**
```bash
# Setup everything
./scripts/nests.sh setup

# Start development
./scripts/nests.sh dev

# Start production
./scripts/nests.sh prod

# View logs
./scripts/nests.sh logs

# Check status
./scripts/nests.sh status
```

### **Using Individual Scripts**
```bash
# Setup
./scripts/setup.sh

# Development
./scripts/start-dev.sh

# Production
./scripts/start-prod.sh
```

## 📋 **Available Commands**

### **nests.sh Commands**
```bash
./scripts/nests.sh <command>

Commands:
  setup           - Initial setup (creates directories, configs)
  dev             - Start development environment
  prod            - Start production environment
  stop            - Stop all services
  restart         - Restart all services
  logs [service]  - View logs (optionally for specific service)
  status          - Show service status and resource usage
  build           - Build all containers
  clean           - Clean up containers and volumes
  shell <service> - Open shell in service container
  test            - Run API tests
```

### **Examples**
```bash
# Setup and start development
./scripts/nests.sh setup
./scripts/nests.sh dev

# View API logs only
./scripts/nests.sh logs nests-api

# Open shell in API container
./scripts/nests.sh shell nests-api

# Check service status
./scripts/nests.sh status

# Clean everything
./scripts/nests.sh clean
```

## 🔄 **Docker Compose Compatibility**

All scripts automatically detect and use the correct Docker Compose command:

- **Docker Compose V2**: `docker compose` (newer, recommended)
- **Docker Compose V1**: `docker-compose` (legacy)

The scripts will work with either version installed on your system.

### **Manual Docker Compose Usage**
If you prefer to use Docker Compose directly:

```bash
# V2 syntax (newer)
docker compose up -d
docker compose logs -f
docker compose down

# V1 syntax (legacy)
docker-compose up -d
docker-compose logs -f
docker-compose down
```

## 🐛 **Troubleshooting**

### **Docker Compose Not Found**
```bash
# Check what's available
docker --version
docker compose version  # V2
docker-compose --version  # V1

# Install Docker Compose V2 (recommended)
# Follow: https://docs.docker.com/compose/install/
```

### **Permission Errors**
```bash
# Make scripts executable
chmod +x scripts/*.sh

# Fix Docker permissions (if needed)
sudo usermod -aG docker $USER
# Then logout and login again
```

### **Port Conflicts**
```bash
# Check what's using ports
sudo netstat -tulpn | grep :5544
sudo netstat -tulpn | grep :7880

# Stop conflicting services
sudo systemctl stop <service-name>
```

## 📁 **Generated Files**

The setup scripts create:

```
config/
├── ssl/
│   ├── cert.pem      # SSL certificate
│   └── key.pem       # SSL private key
api/
├── .env              # Environment configuration
└── logs/             # Application logs
data/
└── redis/            # Redis data directory
```

## 🔒 **Security Notes**

- **Development**: Uses self-signed SSL certificates
- **Production**: Replace with real SSL certificates
- **Environment**: Always review and customize `api/.env`
- **Secrets**: Never commit `.env` files to version control

## 📖 **Further Reading**

- [DEPLOYMENT.md](../DEPLOYMENT.md) - Complete deployment guide
- [PRODUCTION_READY.md](../PRODUCTION_READY.md) - Production overview
- [Docker Compose Documentation](https://docs.docker.com/compose/)