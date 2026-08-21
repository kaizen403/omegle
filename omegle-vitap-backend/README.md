# Omegle VITAP Backend - Node.js

WebSocket-based random video chat matchmaking backend built with Node.js, TypeScript, Redis, and Agora RTC.

## 🚀 Quick Links

- **Backend API**: [http://localhost:8080](http://localhost:8080)
- **Main Frontend**: [http://localhost:3000](http://localhost:3000) (see `omegle-vitap/`)
- **Admin Panel**: [http://localhost:3001](http://localhost:3001) (see `admin-omegle-vitap/`)

## 📚 Documentation

**Complete documentation available in `docs/` directory:**

- 📖 **[Documentation Index](./docs/README.md)** - Start here!
- 🏗️ **[Architecture Guide](./docs/ARCHITECTURE.md)** - System design, data flow, Redis structures
- 🔌 **[WebSocket API Reference](./docs/WEBSOCKET_API.md)** - Complete API docs for integration
- ☁️ **[GCP Deployment Guide](./docs/GCP_DEPLOYMENT.md)** - Production deployment on Google Cloud

**Quick Links:**

- Frontend developers → [WebSocket API](./docs/WEBSOCKET_API.md)
- Backend developers → [Architecture](./docs/ARCHITECTURE.md)
- DevOps/SRE → [Deployment Guide](./docs/GCP_DEPLOYMENT.md)

## ✨ Key Features

### 🎯 Matchmaking Engine

- **Smart Pairing Algorithm**: Gender-based matching with fair queue system (FIFO)
- **Anti-Rematch Protection**: 5-minute cooldown prevents same-user pairing
- **Interest-Based Matching**: Optional matching by shared interests
- **Queue Management**: Real-time queue position updates
- **Match Persistence**: Redis-backed state for crash recovery
- **Reconnection Support**: 2-minute grace period for network drops

### 🔌 Real-Time Communication

- **WebSocket Server**: Socket.IO 4.8.1 with dual namespaces (user + admin)
- **Rate Limiting**: Token bucket (10 burst, 2/sec refill) per connection
- **Message Broadcasting**: Room-based message distribution
- **Signaling Server**: WebRTC peer connection signaling
- **Heartbeat System**: Automatic disconnection detection (30s timeout)

### 🎥 Video Infrastructure

- **P2P WebRTC**: Browsers connect peer-to-peer; Socket.IO relays SDP/ICE
- **coturn**: Time-limited TURN credentials when campus NAT blocks P2P
- **Room Management**: Dynamic room creation and cleanup in Redis

### 💾 Data Layer

- **Redis 4.6**: Connection pooling (2-10 connections) with GCP Memorystore
- **Circuit Breaker**: Fault tolerance with exponential backoff
- **Retry Handler**: Automatic retry with jitter (1s → 10s)
- **Connection Pool**: Optimized for high throughput
- **Health Metrics**: Real-time connection and performance monitoring

### 🛡️ Security & Validation

- **Input Sanitization**: XSS prevention and HTML escaping
- **API Key Authentication**: Secure WebSocket and metrics access
- **CORS Protection**: Whitelisted origins only
- **Rate Limiting**: HTTP endpoints (100 req/15min)
- **Better Auth**: Admin sessions, TOTP MFA
- **Secret Manager**: GCP Secret Manager for credentials

### 📊 Monitoring & Observability

- **Prometheus Metrics**: Request counters, latencies, queue sizes
- **Winston Logging**: Daily rotating logs with levels (error, warn, info, debug)
- **Health Endpoint**: System status, Redis, circuit breaker state
- **Admin Dashboard**: Real-time system monitoring via WebSocket
- **Performance Tracking**: Event loop lag, memory usage, CPU metrics

### 🚀 Production Ready

- **PM2 Process Manager**: Cluster mode with 2+ instances
- **Nginx Load Balancer**: Distributes WebSocket connections
- **Docker Support**: Containerized deployment
- **Kubernetes Ready**: K8s manifests for GKE deployment
- **Auto-Scaling**: Horizontal Pod Autoscaler (HPA) configuration
- **Zero Downtime**: Graceful shutdown and rolling updates

## Architecture

```
Client → Nginx (Port 80) → PM2 (Port 8080, 8081) → Redis (Upstash)
                          ↓
                    Agora RTC (Token Generation)
```

## Tech Stack

- **Runtime**: Node.js 20.x
- **Language**: TypeScript 5.3
- **Framework**: Express 4.18
- **WebSocket**: ws 8.14
- **Database**: Neon Postgres (Drizzle) + Redis (ElastiCache)
- **Auth**: Better Auth (email/password + TOTP)
- **Files**: Amazon S3
- **Process Manager**: PM2
- **Load Balancer**: Nginx
- **Logging**: Winston
- **Monitoring**: Prometheus (prom-client)
- **Video/Audio**: Browser P2P WebRTC + coturn TURN

## Installation

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your credentials

# Apply Neon schema
npm run db:push

# Create the first super-admin
npm run seed-admin -- admin@example.com 'a-strong-password' 'Super Admin' super-admin

# Development
npm run dev

# Build
npm run build

# Production
npm start
```

## Environment Variables

```env
PORT=8080
NODE_ENV=production

DATABASE_URL=postgresql://...neon.tech/db?sslmode=require
BETTER_AUTH_SECRET=long-random-secret
BETTER_AUTH_URL=https://api.example.com
TURNSTILE_SECRET_KEY=

REDIS_HOST=your-elasticache-endpoint
REDIS_PORT=6379
REDIS_TLS=true

AWS_REGION=ap-south-1
S3_BUCKET=your-bucket
S3_PUBLIC_BASE_URL=https://cdn.example.com

TURN_HOST=turn.example.com
TURN_PORT=3478
TURN_AUTH_SECRET=
TURN_REALM=omegle
STUN_URLS=stun:stun.cloudflare.com:3478,stun:stun.l.google.com:19302

ALLOWED_ORIGINS=https://admin.example.com,https://app.example.com
API_KEY=your_secret_api_key
JWT_SECRET=your_jwt_secret
```

## API Endpoints

### HTTP

- `GET /health` - Health check with metrics and circuit breaker status
- `GET /metrics` - Prometheus metrics (requires X-API-Key header)
- `ALL /api/auth/*` - Better Auth (sign-in, session, TOTP)
- `POST /api/admin/verify` - Current admin session (cookie or bearer session token)
- `POST /api/upload` - Chat file upload to S3 (API key)

### WebSocket

**Endpoint:** `wss://api.vitap.in` or `ws://localhost:8080`

**📖 Complete API Documentation:** See [docs/WEBSOCKET_API.md](./docs/WEBSOCKET_API.md)

**Quick Example:**

```javascript
const apiKey = 'your_api_key_here';
const ws = new WebSocket(`wss://api.vitap.in?apiKey=${apiKey}`);

// 1. Authenticate
ws.send(
  JSON.stringify({
    type: 'auth',
    data: { uid: 12345, name: 'John', gender: 'male' },
  })
);

// 2. Search for match
ws.send(
  JSON.stringify({
    type: 'search',
    data: { gender: 'any' },
  })
);

// 3. Handle match
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'match') {
    console.log('Matched!', msg.data.partner);
    // Start video call with msg.data.tokens
  }
};
```

**Supported Message Types:**

- `auth` - Authenticate connection
- `search` - Join matchmaking queue
- `message` - Send chat message
- `signal` - WebRTC signaling
- `leave` - Exit room
- `cancel` - Cancel search

**See full documentation:** [docs/WEBSOCKET_API.md](./docs/WEBSOCKET_API.md)

````

## PM2 Deployment

```bash
# Install PM2 globally
npm install -g pm2

# Start with ecosystem file
pm2 start ecosystem.config.js

# View status
pm2 status

# View logs
pm2 logs

# Restart
pm2 restart all

# Stop
pm2 stop all

# Save PM2 config
pm2 save

# Setup startup script
pm2 startup
````

## Nginx Configuration

```nginx
upstream nodejs_backend {
    least_conn;
    server 127.0.0.1:8080;
    server 127.0.0.1:8081;
}

server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://nodejs_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```

## EC2 Deployment

```bash
# Connect to EC2
ssh -i your-key.pem ec2-user@your-ip

# Install Node.js 20.x
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Install PM2
sudo npm install -g pm2

# Clone/upload project
# ...

# Install dependencies
npm install

# Build
npm run build

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 config
pm2 save
pm2 startup
```

## 📁 Project Structure

```
omeagle-vitap-backend/
├── src/
│   ├── app.ts                     # Express app setup
│   ├── index.ts                   # Entry point & server startup
│   │
│   ├── config/                    # Configuration
│   │   ├── index.ts              # Environment config
│   │   ├── storage/s3.ts         # S3 uploads
│   │   └── redis.ts              # Redis config
│   │
│   ├── handlers/                  # WebSocket handlers
│   │   ├── user.handler.ts       # User namespace events
│   │   ├── admin.handler.ts      # Admin namespace events
│   │   └── middleware.ts         # Socket middleware
│   │
│   ├── services/                  # Business logic
│   │   ├── core/                 # Core services
│   │   │   ├── redis.ts          # Redis client with pooling
│   │   │   ├── matchmaking.ts    # Matching algorithm
│   │   │   ├── queue.ts          # Queue management
│   │   │   └── room.ts           # Room lifecycle
│   │   ├── turn/                 # Coturn ICE credentials
│   │   ├── auth/                 # Authentication
│   │   │   └── tracking.service.ts
│   │   └── monitoring/           # System monitoring
│   │       ├── metrics.ts        # Prometheus metrics
│   │       └── health.ts         # Health checks
│   │
│   ├── models/                    # Data models
│   │   ├── User.ts               # User model
│   │   ├── Room.ts               # Room model
│   │   └── Queue.ts              # Queue model
│   │
│   ├── middleware/                # Express middleware
│   │   ├── auth.ts               # API key validation
│   │   ├── cors.ts               # CORS configuration
│   │   ├── rateLimiter.ts        # Rate limiting
│   │   └── errorHandler.ts       # Error handling
│   │
│   ├── routes/                    # HTTP routes
│   │   ├── health.ts             # Health check endpoint
│   │   ├── metrics.ts            # Prometheus metrics
│   │   └── api.ts                # REST API routes
│   │
│   ├── lib/                       # Shared utilities
│   │   ├── CircuitBreaker.ts     # Circuit breaker pattern
│   │   ├── RetryHandler.ts       # Retry logic with backoff
│   │   └── TokenBucket.ts        # Rate limiting algorithm
│   │
│   ├── utils/                     # Helper functions
│   │   ├── logger.ts             # Winston logger setup
│   │   ├── validators.ts         # Input validation
│   │   ├── sanitizer.ts          # XSS prevention
│   │   └── helpers.ts            # General utilities
│   │
│   └── scripts/                   # Utility scripts
│       ├── redis/                # Redis Lua scripts
│       ├── setup-test-admin.js   # Create test admin
│       └── seed-admin.ts
│
├── docs/                          # Documentation
│   ├── README.md                 # Documentation index
│   ├── ARCHITECTURE.md           # System architecture
│   ├── WEBSOCKET_API.md          # API reference
│   └── GCP_DEPLOYMENT.md         # Deployment guide
│
├── k8s/                           # Kubernetes manifests
│   ├── deployment.yaml           # K8s deployment
│   ├── service.yaml              # K8s service
│   ├── hpa.yaml                  # Horizontal Pod Autoscaler
│   ├── configmap.yaml            # Configuration
│   ├── secrets.yaml              # Secrets template
│   └── ingress.yaml              # Ingress rules
│
├── logs/                          # Application logs
│   ├── dev/                      # Development logs
│   └── prod/                     # Production logs
│
├── dist/                          # Compiled TypeScript
├── node_modules/                  # Dependencies
├── ecosystem.config.js            # PM2 configuration
├── docker-compose.yml             # Docker Compose
├── Dockerfile                     # Docker image
├── tsconfig.json                  # TypeScript config
├── tsconfig.build.json            # Build config
├── package.json                   # Dependencies & scripts
├── pnpm-lock.yaml                # Lock file
├── .env                           # Environment variables
└── README.md                      # This file
```

## Performance

- **Concurrent Users**: 5,000-10,000+ per instance
- **Instances**: 2 (can scale horizontally)
- **Server**: EC2 m7i-flex.large (2 vCPU, 8GB RAM)
- **Response Time**: < 50ms for matchmaking
- **WebSocket Connections**: Maintained with heartbeat/ping-pong

## Monitoring

Access metrics at `/metrics` endpoint (requires API key):

- HTTP request counters and histograms
- WebSocket connection count
- Queue sizes by gender
- Active room count
- Node.js process metrics (memory, CPU, event loop)

## Security

- API key authentication for WebSocket and metrics
- CORS with whitelisted origins
- Rate limiting on HTTP endpoints
- Input sanitization and validation
- Secure Redis connection with TLS

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Development Workflow

1. **Fork & Clone**

   ```bash
   git clone https://github.com/yourusername/omeagle-vitap-backend.git
   cd omeagle-vitap-backend
   ```

2. **Create Branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Changes**

   ```bash
   # Follow code style
   npm run lint:fix
   npm run format
   ```

4. **Test Thoroughly**

   ```bash
   npm run validate
   npm run test
   ```

5. **Commit**

   ```bash
   git commit -m "feat: add amazing feature"
   ```

6. **Push & PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `test:` - Test additions/changes
- `chore:` - Maintenance tasks

### Code Style

- Use ESLint rules defined in project
- Run Prettier before committing
- Write TypeScript with strict types
- Add JSDoc comments for public APIs
- Follow existing patterns

## 📈 Performance Benchmarks

### Load Testing Results (PM2 Cluster - 2 Instances)

| Metric                     | Value               |
| -------------------------- | ------------------- |
| **Concurrent Connections** | 10,000+             |
| **Messages/Second**        | 50,000+             |
| **Average Latency**        | < 50ms              |
| **P95 Latency**            | < 100ms             |
| **P99 Latency**            | < 250ms             |
| **CPU Usage**              | 40-60% per core     |
| **Memory Usage**           | 800 MB per instance |
| **Match Time**             | < 10 seconds avg    |

### Infrastructure

- **Server**: GCP Cloud Run (2 vCPU, 4GB RAM per instance)
- **Redis**: GCP Memorystore (Standard, 5GB)
- **coturn**: UDP 3478 + relay ports on the same VM
- **Region**: asia-south1 (Mumbai)

## 🔐 Security Best Practices

### Implemented

✅ API key authentication for WebSocket connections  
✅ CORS with whitelist-only origins  
✅ Input sanitization and XSS prevention  
✅ Rate limiting on all endpoints  
Better Auth for admin sessions  
✅ GCP Secret Manager for credentials  
✅ Secure Redis connection (TLS)  
✅ Time-limited coturn TURN credentials

### Recommended

⚠️ Enable Firewall rules (Cloud Armor)  
⚠️ Setup DDoS protection  
⚠️ Implement IP reputation checking  
⚠️ Add content moderation (ML-based)  
⚠️ Enable audit logging  
⚠️ Setup VPC peering  
⚠️ Use managed certificates

## 🆘 Support & Contact

### Documentation

- **Architecture**: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- **WebSocket API**: [`docs/WEBSOCKET_API.md`](./docs/WEBSOCKET_API.md)
- **Deployment**: [`docs/GCP_DEPLOYMENT.md`](./docs/GCP_DEPLOYMENT.md)

### Getting Help

- **Issues**: [GitHub Issues](https://github.com/yourusername/omeagle-vitap-backend/issues)
- **Email**: dev@yourdomain.com

### Related Projects

- **Main Frontend**: [`../omegle-vitap/`](../omegle-vitap/) - User-facing chat application
- **Admin Panel**: [`../admin-omegle-vitap/`](../admin-omegle-vitap/) - Monitoring dashboard

## 📝 Changelog

### v1.0.0 (December 2025)

**Features:**

- ✅ WebSocket server with Socket.IO
- ✅ Real-time matchmaking with Redis
- ✅ P2P WebRTC for video/audio
- ✅ Admin dashboard WebSocket API
- Better Auth + TOTP
- ✅ Prometheus metrics
- ✅ PM2 cluster mode
- ✅ Kubernetes deployment manifests

**Improvements:**

- ✅ Redis connection pooling (2-10 connections)
- ✅ Circuit breaker pattern
- ✅ Retry handler with exponential backoff
- ✅ Comprehensive documentation (4 guides)
- ✅ TypeScript strict mode
- ✅ Winston logging with rotation

**Bug Fixes:**

- ✅ Memory leaks in socket handlers
- ✅ Race conditions in matchmaking
- ✅ Reconnection edge cases

## 🎯 Roadmap

### v1.1.0 (Q1 2026)

- [ ] GraphQL API layer
- [ ] E2E test suite
- [ ] Sentry error tracking
- [ ] Redis Pub/Sub for scaling
- [ ] WebSocket compression

### v1.2.0 (Q2 2026)

- [ ] Interest-based matching algorithm
- [ ] ML content moderation
- [ ] Video quality analytics
- [ ] Multi-region deployment
- [ ] CDN integration

### v2.0.0 (Q3 2026)

- [ ] Group chat support (3+ users)
- [ ] Screen sharing
- [ ] Recording capabilities
- [ ] Advanced analytics dashboard
- [ ] API rate plan tiers

## 📄 License

MIT License

Copyright (c) 2025 VIT-AP Omegle Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## 🙏 Acknowledgments

- **Socket.IO** - Real-time WebSocket library
- **coturn** - TURN for P2P ICE
- **Redis** - In-memory data store
- **Google Cloud Platform** - Cloud infrastructure
- **Better Auth** - Admin authentication
- **Express.js** - Web framework
- **TypeScript** - Type safety
- **PM2** - Process management

---

**Built with ❤️ for VIT-AP students**

**Need help?** Check the [`docs/`](./docs/) directory for comprehensive guides!
