# Documentation Index

Welcome to the Omegle VITAP backend documentation! This guide will help you understand, deploy, and maintain the video chat platform.

## 📚 Documentation Structure

### 1. [Architecture Overview](./ARCHITECTURE.md) 🏗️

**Start here** for a comprehensive understanding of the system.

- System architecture and component interaction
- Technology stack details
- Data flow diagrams
- Redis data structures
- Security architecture
- Monitoring and observability
- Performance optimization strategies
- Scalability considerations
- Cost optimization

**Best for**: New developers, system designers, architects

### 2. [WebSocket API Reference](./WEBSOCKET_API.md) 🔌

Complete API documentation for Socket.IO integration.

- User API (matchmaking, chat, signaling)
- Admin API (monitoring, management)
- Connection handling
- Error codes and handling
- Rate limiting details
- Best practices and examples

**Best for**: Frontend developers, API integrators

### 3. [GCP Deployment Guide](./GCP_DEPLOYMENT.md) ☁️

Step-by-step guide for deploying to Google Cloud Platform.

- Setting up GCP services (Cloud Run, Memorystore, GKE)
- Secret Manager configuration
- Frontend hosting
- Cloud Armor (WAF) setup
- Monitoring and alerting
- CI/CD with Cloud Build
- Backup and recovery procedures
- Troubleshooting guide

**Best for**: DevOps engineers, deployment managers

## 🚀 Quick Start Guides

### For Frontend Developers

1. Read [WebSocket API](./WEBSOCKET_API.md) - User API section
2. Check connection examples
3. Implement matchmaking flow
4. Add error handling

### For Backend Developers

1. Read [Architecture](./ARCHITECTURE.md) - Component Architecture
2. Understand Redis data structures
3. Review matchmaking service code
4. Study WebSocket handlers

### For DevOps/SRE

1. Read [GCP Deployment](./GCP_DEPLOYMENT.md)
2. Setup monitoring and alerts
3. Configure backups
4. Test disaster recovery

### For Admin Panel Developers

1. Read [WebSocket API](./WEBSOCKET_API.md) - Admin API section
2. Study real-time update patterns
3. Implement monitoring features
4. Add user management controls

## 📖 Additional Resources

### Backend Codebase

```
src/
├── app.ts                    # Express app setup
├── index.ts                  # Entry point
├── config/                   # Environment configuration
├── handlers/
│   └── socketio/            # WebSocket handlers
│       ├── match.handler.ts # Matchmaking logic
│       ├── room.handler.ts  # Room management
│       └── admin.handler.ts # Admin operations
├── services/
│   ├── core/
│   │   └── redis.ts         # Redis client with pooling
│   ├── chat/
│   │   ├── matchmaking.service.ts
│   │   └── room.service.ts
│   └── turn/
│       └── turn.service.ts  # Coturn REST-auth ICE credentials
├── lib/
│   ├── circuitBreaker.ts    # Circuit breaker pattern
│   └── retryHandler.ts      # Retry with backoff
├── middleware/              # Express middleware
└── utils/
    └── logger.ts            # Winston logger
```

### Key Files to Review

**Matchmaking**

- `src/handlers/socketio/match.handler.ts` - Core matchmaking logic
- `src/services/chat/matchmaking.service.ts` - Queue management
- `src/scripts/redis/match.lua` - Atomic matching algorithm

**Room Management**

- `src/handlers/socketio/room.handler.ts` - Room lifecycle
- `src/services/chat/room.service.ts` - Redis operations

**Admin Features**

- `src/handlers/socketio/admin.handler.ts` - Admin operations
- `src/routes/admin/` - HTTP admin endpoints

**Infrastructure**

- `src/services/core/redis.ts` - Connection pooling, circuit breaker
- `src/lib/circuitBreaker.ts` - Fault tolerance
- `ecosystem.config.js` - PM2 configuration (legacy)

## 🔧 Development Setup

### Prerequisites

```bash
- Node.js 20.x LTS
- Redis 7.x
- Neon Postgres
- coturn (optional for local video; STUN-only works without it)
```

### Quick Setup

```bash
# Clone repository
git clone https://github.com/rudra-sah00/omegle-vitap.git
cd omeagle-vitap-backend

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your credentials

# Start Redis (Docker)
docker run -d -p 6379:6379 redis:7

# Start development server
npm run dev

# Server runs on http://localhost:8080
```

### Testing

```bash
# Type check
npm run type-check

# Linting
npm run lint

# Tests (when available)
npm run test
```

## 🎯 Common Tasks

### Adding a New WebSocket Event

1. **Define event in handler**

   ```typescript
   // src/handlers/socketio/match.handler.ts
   socket.on('new_event', (data) => {
     // Handle event
   });
   ```

2. **Update API documentation**
   - Add to `docs/WEBSOCKET_API.md`

3. **Update frontend**
   - Implement client-side handler

### Modifying Matchmaking Logic

1. **Update Lua script** (if needed)

   ```lua
   // src/scripts/redis/match.lua
   ```

2. **Modify service method**

   ```typescript
   // src/services/chat/matchmaking.service.ts
   ```

3. **Update tests**

4. **Document changes**

### Adding Admin Feature

1. **Add handler method**

   ```typescript
   // src/handlers/socketio/admin.handler.ts
   ```

2. **Update admin API docs**

   ```markdown
   // docs/WEBSOCKET_API.md - Admin API section
   ```

3. **Test with admin panel**

### Deploying Changes

1. **Test locally**

   ```bash
   npm run validate
   npm run build
   ```

2. **Commit and push**

   ```bash
   git add .
   git commit -m "Description"
   git push origin main
   ```

3. **Cloud Build auto-deploys** (if configured)
   - Or manually: See [GCP Deployment](./GCP_DEPLOYMENT.md)

## 📊 Monitoring

### Metrics Endpoint

```
GET /metrics
Header: X-API-Key: YOUR_API_KEY

Returns Prometheus metrics
```

### Health Check

```
GET /health

Returns:
- System status
- Redis health
- Memory usage
- Active connections
- Queue statistics
```

### Logs

```bash
# Production logs
logs/prod/application-YYYY-MM-DD.log
logs/prod/matchmaking-YYYY-MM-DD.log
logs/prod/websocket-YYYY-MM-DD.log

# GCP Cloud Logging
gcloud run logs read omegle-vitap-backend --region=asia-south1
```

## 🐛 Debugging

### Common Issues

**Redis Connection Failed**

- Check VPC connector configuration
- Verify Redis host/port in secrets
- Test connection with redis-cli

**WebSocket Not Connecting**

- Verify API key in query params
- Check CORS configuration
- Review WebSocket transport settings

**High Memory Usage**

- Check for memory leaks in handlers
- Review Redis key TTLs
- Monitor connection count

**Slow Matchmaking**

- Check queue size
- Review Lua script performance
- Monitor Redis latency

### Debug Mode

```bash
# Enable debug logging
NODE_ENV=development npm run dev

# Increase log verbosity
LOG_LEVEL=debug npm run dev
```

## 🔐 Security Best Practices

1. **Never commit secrets**
   - Use Secret Manager
   - Add sensitive files to `.gitignore`

2. **Validate all inputs**
   - Socket.IO messages
   - HTTP requests
   - Redis data

3. **Rate limiting**
   - Per-IP limits
   - Per-user limits
   - WebSocket message throttling

4. **Authentication**
   - Verify Better Auth sessions
   - Check admin roles
   - Expire sessions appropriately

5. **Network security**
   - VPC for internal services
   - Cloud Armor WAF
   - SSL/TLS everywhere

## 📝 Contributing

### Code Style

- TypeScript strict mode
- ESLint + Prettier
- Descriptive variable names
- Add JSDoc comments

### Git Workflow

1. Create feature branch
2. Make changes
3. Run tests and linting
4. Commit with descriptive message
5. Create pull request

### Documentation

- Update relevant docs
- Add inline comments
- Update API docs for changes
- Include examples

## 🆘 Getting Help

### Documentation Issues

- Check docs/ARCHITECTURE.md first
- Review error logs
- Search closed GitHub issues

### Bug Reports

Include:

- Steps to reproduce
- Expected vs actual behavior
- Environment details
- Relevant logs

### Feature Requests

Describe:

- Use case
- Proposed solution
- Alternatives considered
- Impact on existing features

## 📅 Changelog

See [CHANGELOG.md](../CHANGELOG.md) for version history and changes.

## 📄 License

MIT License - See [LICENSE](../LICENSE) for details.

---

**Documentation Version**: 1.0  
**Last Updated**: December 2025  
**Maintained by**: Development Team

For questions or clarifications, contact the development team.
