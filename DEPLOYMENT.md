# Nests Production Deployment Guide

This guide covers deploying the complete Nests stack (Frontend + API + LiveKit) for production use.

## 🏗️ **Architecture Overview**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Nginx Proxy   │───▶│   Nests API     │───▶│  LiveKit Server │
│   (Port 80/443) │    │   (Port 5544)   │    │   (Port 7880)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       └───────────────────────┘
         │                            Redis (Port 6379)
         │
┌─────────────────┐
│ Nests Frontend  │
│ (Static Files)  │
└─────────────────┘
```

## 🚀 **Quick Start**

### Prerequisites
- Docker & Docker Compose V2
- Domain name with DNS pointing to your server
- SSL certificates (Let's Encrypt recommended)

### 1. Clone and Setup
```bash
git clone <your-nests-repo>
cd nests
./scripts/setup.sh
```

### 2. Configure Environment
```bash
# Edit API configuration
cp api/.env.example api/.env
nano api/.env
```

### 3. Update Configuration Files
```bash
# Update LiveKit config
nano config/livekit.yaml

# Update Nginx config with your domain
nano config/nginx.conf
```

### 4. Start Production
```bash
./scripts/start-prod.sh
```

## ⚙️ **Detailed Configuration**

### Environment Variables (`api/.env`)

```bash
# Production settings
NODE_ENV=production
PORT=5544

# LiveKit Configuration
LIVEKIT_URL=ws://livekit:7880
LIVEKIT_API_KEY=your-secure-api-key
LIVEKIT_API_SECRET=your-super-secret-key

# Redis Configuration
REDIS_URL=redis://redis:6379

# CORS Configuration
CORS_ORIGIN=https://your-domain.com,https://www.your-domain.com

# Security (generate strong secrets)
WEBHOOK_SECRET=your-webhook-secret
```

### LiveKit Configuration (`config/livekit.yaml`)

```yaml
port: 7880
bind_addresses: [""]

rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 50100
  use_external_ip: true
  external_ip: "YOUR_SERVER_IP"  # Set your server's public IP

redis:
  address: redis:6379

keys:
  your-secure-api-key: your-super-secret-key

room:
  auto_create: true
  enable_recording: true
  max_participants: 500
  empty_timeout: 300s

# Optional: TURN server for better connectivity
turn:
  enabled: true
  domain: turn.your-domain.com
  tls_port: 5349
  udp_port: 3478
```

### Nginx Configuration (`config/nginx.conf`)

Update these sections:
```nginx
# Replace with your domain
server_name your-domain.com www.your-domain.com;

# SSL certificates path
ssl_certificate /etc/nginx/ssl/cert.pem;
ssl_certificate_key /etc/nginx/ssl/key.pem;

# CORS origin for API
add_header Access-Control-Allow-Origin "https://your-domain.com" always;
```

## 🔐 **SSL Certificates**

### Option 1: Let's Encrypt (Recommended)
```bash
# Install certbot
sudo apt install certbot

# Get certificates
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# Copy to config directory
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem config/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem config/ssl/key.pem
```

### Option 2: Self-Signed (Development)
```bash
openssl req -x509 -newkey rsa:4096 -keyout config/ssl/key.pem -out config/ssl/cert.pem -days 365 -nodes
```

## 🌐 **Frontend Deployment**

### Option 1: Serve from Nginx (Same Domain)
```bash
# Build frontend
npm run build

# Copy to nginx directory
sudo cp -r dist/* /var/www/html/
```

### Option 2: Separate CDN/Hosting
Deploy the `dist/` folder to:
- Vercel
- Netlify
- AWS S3 + CloudFront
- Any static hosting service

Update CORS_ORIGIN in API to include your frontend domain.

## 🔧 **Production Optimizations**

### 1. Resource Limits
```yaml
# In docker-compose.yml
services:
  nests-api:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### 2. Logging
```bash
# Centralized logging
docker compose logs -f nests-api
docker compose logs -f livekit

# Log rotation
echo '{"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"}}' | sudo tee /etc/docker/daemon.json
```

### 3. Monitoring
```yaml
# Add to docker-compose.yml
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./config/prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

### 4. Backup Strategy
```bash
# Redis backup
docker exec redis redis-cli BGSAVE

# LiveKit recordings backup
# Configure S3 storage in livekit.yaml
```

## 🔥 **Firewall Configuration**

```bash
# Allow necessary ports
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 7880/tcp
sudo ufw allow 7881/tcp
sudo ufw allow 50000:50100/udp
sudo ufw enable
```

## 📊 **Health Checks**

### API Health Check
```bash
curl https://your-domain.com/api/v1/nests/health
```

### LiveKit Health Check
```bash
curl http://your-domain.com:7880/
```

### Service Status
```bash
docker compose ps
docker compose logs --tail=50 nests-api
```

## 🐛 **Troubleshooting**

### Common Issues

1. **CORS Errors**
   ```bash
   # Check CORS_ORIGIN in api/.env
   # Ensure frontend domain is included
   ```

2. **WebRTC Connection Failed**
   ```bash
   # Check firewall settings
   # Verify external_ip in livekit.yaml
   # Test UDP ports 50000-50100
   ```

3. **SSL Certificate Issues**
   ```bash
   # Verify certificate files exist
   ls -la config/ssl/
   
   # Check certificate validity
   openssl x509 -in config/ssl/cert.pem -text -noout
   ```

4. **Redis Connection Issues**
   ```bash
   # Check Redis container
   docker compose logs redis
   
   # Test Redis connection
   docker exec -it redis redis-cli ping
   ```

### Debug Commands

```bash
# View all logs
docker compose logs -f

# Check container status
docker compose ps

# Restart specific service
docker compose restart nests-api

# View API logs only
docker compose logs -f nests-api

# Test API endpoints
curl -X PUT http://localhost:5544/api/v1/nests \
  -H "Content-Type: application/json" \
  -d '{"relays":["wss://relay.nostr.band"]}'
```

## 🔄 **Updates and Maintenance**

### Update Application
```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker compose build --no-cache
docker compose up -d
```

### Database Maintenance
```bash
# Redis memory usage
docker exec redis redis-cli info memory

# Clear expired keys
docker exec redis redis-cli FLUSHDB
```

### Log Rotation
```bash
# Rotate Docker logs
docker system prune -f

# Clear old logs
find api/logs -name "*.log" -mtime +7 -delete
```

## 📈 **Scaling**

### Horizontal Scaling
```yaml
# Multiple API instances
services:
  nests-api:
    deploy:
      replicas: 3
    
  # Load balancer
  nginx:
    depends_on:
      - nests-api
```

### LiveKit Clustering
```yaml
# Multiple LiveKit nodes
livekit-1:
  image: livekit/livekit-server
  
livekit-2:
  image: livekit/livekit-server
```

## 🔒 **Security Checklist**

- [ ] Strong API keys and secrets
- [ ] SSL certificates properly configured
- [ ] Firewall rules in place
- [ ] Regular security updates
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] No sensitive data in logs
- [ ] Regular backups
- [ ] Monitoring and alerting
- [ ] Access logs reviewed

## 📞 **Support**

For issues and questions:
1. Check the troubleshooting section
2. Review Docker logs
3. Test individual components
4. Check network connectivity
5. Verify configuration files

This production setup provides a robust, scalable foundation for running Nests in production environments.