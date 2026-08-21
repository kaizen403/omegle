# Omegle VITAP - Architecture Documentation

## System Overview

Omegle VITAP is a real-time random video chat platform built for VIT-AP University, deployed on Google Cloud Platform with Better Auth, Neon, and Redis.

### Technology Stack

#### Frontend Applications

- **Main App** (omegle-vitap): User-facing video chat application
  - Next.js 16, React 19, TypeScript 5
  - LiveKit for WebRTC video/audio
  - Socket.IO client for matchmaking
  - Tailwind CSS 4 for styling
  - Better Auth

- **Admin Panel** (admin-omegle-vitap): Monitoring and management dashboard
  - Next.js 16, React 19, TypeScript 5
  - TOTP MFA
  - Real-time WebSocket monitoring
  - Radix UI components

#### Backend

- **Node.js Backend** (omeagle-vitap-backend)
  - Express.js + Socket.IO
  - Redis (GCP Memorystore) for state management
  - LiveKit Server SDK for token generation
  - Better Auth
  - Winston logging with daily rotation

### Infrastructure

```
┌─────────────────────────────────────────────────────────────────┐
│                        Google Cloud Platform                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │   Auth   │      │  Cloud Run   │      │ Memorystore  │  │
│  │   Hosting    │      │  (Backend)   │      │   (Redis)    │  │
│  │              │      │              │      │              │  │
│  │ • Main App   │◄────►│ • Express    │◄────►│ • State      │  │
│  │ • Admin Panel│      │ • Socket.IO  │      │ • Queue      │  │
│  └──────────────┘      └──────────────┘      │ • Sessions   │  │
│                                               └──────────────┘  │
│  ┌──────────────┐      ┌──────────────┐                         │
│  │  Neon   │      │   LiveKit    │                         │
│  │              │      │   GKE Pod    │                         │
│  │ • Users      │      │              │                         │
│  │ • Admins     │      │ • WebRTC     │                         │
│  │ • History    │      │ • Media      │                         │
│  └──────────────┘      └──────────────┘                         │
│                                                                   │
│  ┌──────────────────────────────────────────────────────┐       │
│  │            Secret Manager (Credentials)              │       │
│  │  • Neon + S3 credentials  • LiveKit Keys  • API Keys           │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. Main Application Flow

```
User Browser
    │
    ├─► Next.js App (Client)
    │       ├─► Authentication (Better Auth)
    │       ├─► User State Management (React Context)
    │       └─► LiveKit Room (WebRTC)
    │
    ├─► Socket.IO Connection (Matchmaking)
    │       ├─► auth (user credentials)
    │       ├─► search (find match)
    │       ├─► message (chat)
    │       └─► signal (WebRTC signaling)
    │
    └─► Backend Server (Express + Socket.IO)
            ├─► Matchmaking Service (Redis)
            ├─► Room Management
            ├─► Token Generation (LiveKit)
            └─► User Tracking (Neon)
```

### 2. Admin Panel Flow

```
Admin Browser
    │
    ├─► Next.js Admin App
    │       ├─► Auth MFA Auth
    │       ├─► Admin Socket Context
    │       └─► Real-time Dashboard
    │
    ├─► Socket.IO /admin namespace
    │       ├─► get_users
    │       ├─► get_rooms
    │       ├─► kick_user
    │       ├─► monitor_room
    │       └─► toggle_system_status
    │
    └─► Backend Admin Handler
            ├─► User Management
            ├─► Room Monitoring
            ├─► Audio Monitoring (LiveKit)
            └─► System Control
```

## Deployment Architecture

### GCP Cloud Run (Backend)

```yaml
Service: omegle-vitap-backend
Region: asia-south1 (Mumbai)
Configuration:
  - CPU: 2 vCPU
  - Memory: 4 GiB
  - Concurrency: 80
  - Min Instances: 1
  - Max Instances: 10
  - Timeout: 300s

Environment:
  - PORT: 8080
  - NODE_ENV: production
  - Secrets from Secret Manager:
    * TURN_HOST
    * TURN_AUTH_SECRET
    * BETTER_AUTH_SECRET
    * REDIS_HOST, REDIS_PORT
    * API_KEY
```

### GCP Memorystore Redis

```yaml
Configuration:
  - Version: Redis 7.x
  - Tier: Standard (HA)
  - Memory: 5 GB
  - Region: asia-south1
  - Network: VPC peering with Cloud Run

Connection:
  - Host: Internal IP (VPC)
  - Port: 6379
  - Connection pooling: 2-10 connections
  - Auto pipelining: Enabled
  - Circuit breaker protection
```

### CDN hosting

```yaml
Main App (omegle-vitap):
  - Site: vitap.in
  - CDN: Global
  - SSL: Auto-managed

Admin Panel (admin-omegle-vitap):
  - Site: admin.vitap.in
  - Access: Restricted (Better Auth)
  - SSL: Auto-managed

Features:
  - Cache-Control headers
  - Compression (gzip/brotli)
  - Rewrite rules to index.html
  - Security headers
```

### LiveKit Deployment (GKE)

```yaml
Cluster:
  - Name: livekit-cluster
  - Region: asia-south1
  - Nodes: 3 (auto-scaling)
  - Machine type: e2-standard-4

Service:
  - Type: LoadBalancer
  - Protocol: HTTPS/WSS
  - Endpoint: wss://livekit.endpoints.omgle-vitap-prod.cloud.goog

Features:
  - Auto-scaling based on CPU
  - Health checks
  - Connection draining
  - ICE/TURN servers configured
```

## Data Flow Diagrams

### User Matchmaking Flow

```
1. User Authentication
   User → Better Auth → Backend validates → Socket connected

2. Join Queue
   User clicks "Start" → Backend adds to Redis queue → Periodic matching

3. Matching Algorithm
   ┌─────────────────────────────────────┐
   │   Matchmaking Service (Lua Script)  │
   ├─────────────────────────────────────┤
   │ 1. Get oldest user from queue       │
   │ 2. Find partner with preferences:   │
   │    - Gender match                   │
   │    - Not recent partner (5 min)     │
   │    - Different user ID              │
   │ 3. Create room atomically           │
   │ 4. Remove both from queue           │
   └─────────────────────────────────────┘
                  │
                  ▼
   ┌─────────────────────────────────────┐
   │        Room Creation                │
   ├─────────────────────────────────────┤
   │ 1. Generate LiveKit tokens          │
   │ 2. Store room in Redis (2h TTL)     │
   │ 3. Emit "match" to both users       │
   │ 4. Users join LiveKit room          │
   └─────────────────────────────────────┘

4. Video Call
   User A ←─────→ LiveKit Server ←─────→ User B
   (WebRTC)      (Media Relay)       (WebRTC)

5. Chat Messages
   User A → Socket.IO → Redis pub/sub → User B

6. End Call
   Either user clicks "Next" → Room deleted → Back to queue
```

### Admin Monitoring Flow

```
Admin Dashboard
    │
    ├─► Real-time Metrics (WebSocket)
    │   ├─► Active users count
    │   ├─► Active rooms count
    │   ├─► Queue statistics
    │   └─► System health (Redis, LiveKit)
    │
    ├─► User Management
    │   ├─► View all connected users
    │   ├─► Filter by state (idle/queue/room)
    │   ├─► Kick user (disconnect)
    │   └─► Track user history (Neon)
    │
    ├─── Room Monitoring
    │   ├─► View active rooms
    │   ├─► Monitor chat messages
    │   ├─► Listen to audio (LiveKit)
    │   └─► Close room
    │
    └─► System Control
        ├─► Toggle system on/off
        ├─► Clear matchmaking queue
        ├─► Reset circuit breaker
        └─► View logs and events
```

## Redis Data Structures

### Queue System

```redis
# Sorted Set (score = timestamp)
queue:all
  - user:{uid}:{gender} => timestamp

# User session data
session:{uid}
  - {uid, name, gender, state, roomId, socketId}
  - TTL: 2 hours

# Room data
room:{roomId}
  - {roomId, user1, user2, channelName, startTime}
  - TTL: 2 hours

# User to room mapping
user:room:{uid} => roomId
  - TTL: 2 hours

# Last partner tracking (anti-rematch)
last_partner:{uid} => partnerUid
  - TTL: 5 minutes

# Room message history
room:messages:{roomId}
  - List of {sender, content, timestamp}
  - TTL: 2 hours
  - Max 100 messages per room

# System counters
room:count => integer
```

### Pub/Sub Channels

```redis
# Matchmaking events
matchmaking:events
  - match_found: {roomId, user1, user2}
  - match_failed: {uid, reason}

# Room events
room:{roomId}:messages
  - Chat messages broadcast

# Admin notifications
admin:events
  - user_kicked, room_closed, system_status_changed
```

## Security Architecture

### Authentication Layers

```
Layer 1: Better Auth
├─► User App: Email/Phone authentication
└─► Admin Panel: Email + MFA (Phone OTP)

Layer 2: API Key Validation
├─► WebSocket connections require API key in query params
└─► HTTP endpoints require X-API-Key header

Layer 3: Session Management
├─► JWT tokens for HTTP requests
└─► Socket.IO session with uid validation

Layer 4: Admin Authorization
├─► admin role fields (admin role)
├─► Token verification via Better Auth
└─► Session management with expiry tracking
```

### Network Security

```
┌─────────────────────────────────────────┐
│         Cloud Load Balancer             │
│  - SSL Termination                      │
│  - DDoS Protection                      │
│  - Rate Limiting                        │
└─────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         Cloud Armor (WAF)               │
│  - IP Allowlist/Blocklist               │
│  - OWASP Top 10 Protection              │
│  - Bot detection                        │
└─────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         Backend Service                 │
│  - CORS validation                      │
│  - Input sanitization                   │
│  - Rate limiting (token bucket)         │
│  - Request timeout (30s)                │
└─────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         VPC Network                     │
│  - Private Redis (Memorystore)          │
│  - Private LiveKit (GKE)                │
│  - No public IPs for internal services  │
└─────────────────────────────────────────┘
```

## Monitoring & Observability

### Metrics Collection

```
Prometheus Metrics (via prom-client):
├─► HTTP Metrics
│   ├─► http_requests_total
│   ├─► http_request_duration_seconds
│   └─► http_response_size_bytes
│
├─► WebSocket Metrics
│   ├─► websocket_connections_active
│   ├─► websocket_messages_total
│   └─► websocket_errors_total
│
├─► Matchmaking Metrics
│   ├─► matchmaking_queue_size
│   ├─► matchmaking_success_rate
│   └─── matchmaking_duration_seconds
│
├─► Room Metrics
│   ├─► active_rooms_total
│   ├─► room_duration_seconds
│   └─── room_creation_errors
│
└─► Redis Metrics
    ├─► redis_commands_total
    ├─► redis_circuit_breaker_state
    └─► redis_connection_errors
```

### Logging Strategy

```
Winston Logger:
├─► Application Logs (daily rotation)
│   ├─► logs/prod/application-YYYY-MM-DD.log
│   └─► Levels: error, warn, info, debug
│
├─► Matchmaking Logs
│   ├─► logs/prod/matchmaking-YYYY-MM-DD.log
│   └─► Events: queue_add, match_found, match_failed
│
├─── WebSocket Logs
│   ├─► logs/prod/websocket-YYYY-MM-DD.log
│   └─► Events: connect, disconnect, message
│
└─► Export to Cloud Logging
    └─► GCP Log Explorer for querying
```

### Health Checks

```
Endpoint: GET /health
Response:
{
  "status": "ok",
  "uptime": 3600,
  "timestamp": 1701453600,
  "redis": {
    "connected": true,
    "ping": "PONG",
    "circuitBreaker": "closed"
  },
  "connections": {
    "current": 150,
    "maximum": 1000
  },
  "queue": {
    "size": 25,
    "activeRooms": 12
  },
  "memory": {
    "rss": 104857600,
    "heapUsed": 52428800
  }
}
```

## Performance Optimization

### Backend Optimizations

- **Redis Connection Pooling**: 2-10 connections with auto-pipelining
- **Circuit Breaker**: Prevents cascade failures (5 failures → open)
- **Retry Handler**: Exponential backoff with jitter
- **Request Timeout**: 30s limit prevents hanging requests
- **Rate Limiting**: Token bucket algorithm (1000 req/s, 2000 burst)

### Frontend Optimizations

- **Code Splitting**: Dynamic imports for heavy components
- **Image Optimization**: Next.js Image component with CDN
- **Lazy Loading**: Routes and components loaded on demand
- **Caching**: Service worker for offline support
- **Compression**: Gzip/Brotli at CDN hosting level

### Database Optimizations

- **Redis TTL**: Automatic cleanup of stale data
- **Postgres indexes**: Composite indexes for queries
- **Batch Operations**: Bulk user tracking writes
- **Connection Reuse**: Single Redis client instance

## Scalability Considerations

### Horizontal Scaling

- **Cloud Run**: Auto-scales 1-10 instances based on CPU
- **Redis**: Standard tier with HA failover
- **LiveKit**: Kubernetes HPA (2-20 pods)
- **CDN hosting**: Global CDN with auto-scaling

### Vertical Scaling Limits

- **Backend**: 2 vCPU, 4 GiB RAM (can scale to 8 vCPU, 32 GiB)
- **Redis**: 5 GB memory (can scale to 300 GB)
- **LiveKit**: e2-standard-4 nodes (can scale to n2-standard-16)

### Performance Targets

- **Concurrent Users**: 5,000-10,000 per region
- **Response Time**: < 100ms for matchmaking
- **WebSocket Latency**: < 50ms
- **Video Quality**: 720p @ 30fps (adaptive)

## Disaster Recovery

### Backup Strategy

```
Neon Postgres:
├─► Automated daily backups
├─► 7-day retention
└─── Point-in-time recovery

Redis (Memorystore):
├─► Daily snapshots
├─► Cross-region replication (Standard tier)
└─── Manual export before major changes

Application Logs:
├─► 30-day retention in Cloud Logging
└─── Archive to Cloud Storage after 30 days
```

### Failover Procedures

```
Redis Failure:
1. Circuit breaker opens (fail fast)
2. New connections attempt reconnection
3. Standard tier auto-failover (< 2 min)
4. Manual intervention if persistent

Cloud Run Failure:
1. Health check fails → instance recycled
2. Traffic routed to healthy instances
3. Auto-scaling adds new instances
4. Alerts sent to ops team

LiveKit Failure:
1. Kubernetes health check fails
2. Pod restarted automatically
3. Users reconnect with new tokens
4. Minimal disruption (< 30s)
```

## Development Workflow

### Local Development

```bash
# Start Redis (Docker)
docker run -d -p 6379:6379 redis:7

# Start backend
cd omeagle-vitap-backend
npm run dev

# Start main app
cd omegle-vitap
npm run dev

# Start admin panel
cd admin-omegle-vitap
pnpm run dev
```

### Testing Strategy

```
Unit Tests:
├─► Backend services (Jest)
├─► Frontend utilities (Vitest)
└─► Coverage target: 70%

E2E Tests:
├─► Admin panel (Playwright)
├─► Critical user flows
└─► Run before deployment

Integration Tests:
├─► Redis operations
├─► Neon operations
└─── WebSocket connections
```

### CI/CD Pipeline

```
GitHub Actions:
├─► On Push to Main
│   ├─► Lint & Type Check
│   ├─► Run tests
│   ├─► Build application
│   └─► Deploy to production
│
└─► On Pull Request
    ├─► Lint & Type Check
    ├─► Run tests
    └─── Deploy to preview channel
```

## Cost Optimization

### Current Monthly Costs (Estimated)

```
CDN hosting: $0-5 (within free tier)
Cloud Run: $30-100 (based on requests)
Memorystore Redis: $50-80 (5GB Standard)
LiveKit GKE: $100-200 (3 nodes)
Neon Postgres: $10-30 (reads/writes)
Cloud Logging: $5-15 (log ingestion)
Cloud Storage: $1-5 (backups)

Total: $200-450/month
```

### Cost Saving Strategies

- Use Neon free tier for hosting
- Minimize Cloud Run idle time (min instances = 1)
- Optimize Redis key expiration (TTL)
- Compress logs before storage
- Schedule non-critical tasks during off-peak hours

---

**Last Updated**: December 2025  
**Version**: 1.0  
**Maintained by**: Development Team
