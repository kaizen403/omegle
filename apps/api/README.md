# API

Express + Socket.IO on port 8080. Matchmaking and rooms in Redis. Better Auth, visits, and bot config in Neon. Chat files in S3. TURN credentials for P2P video.

```bash
cp .env.example .env.development
npm install
npm run db:push
npm run seed-admin -- you@example.com 'password' 'Name' super-admin
npm run dev
```

Coturn (optional locally):

```bash
docker compose up coturn
```

See `.env.example` for required names. Socket events: [docs/WEBSOCKET_API.md](docs/WEBSOCKET_API.md). Cloud Run: [docs/GCP_DEPLOYMENT.md](docs/GCP_DEPLOYMENT.md).
