# Omegle VITAP

Anonymous video chat for VIT-AP. Three apps, one repo.

```
apps/
  web/     user app        http://localhost:3000
  admin/   dashboard       http://localhost:3001
  api/     Express + IO    http://localhost:8080
```

Video is 1:1 P2P WebRTC. The API relays SDP/ICE and mints TURN credentials; media does not go through Node.

Text chat only — file and image attachments were removed. The user app has no login: the
server assigns an anonymous session id on connect, and the client never chooses its own.

## Run locally

You need Node 20, Redis on `localhost:6379`, and (for video behind NAT) coturn. Copy each app’s `.env.example` before starting.

```bash
# API
cd apps/api
cp .env.example .env.development   # then set DATABASE_URL
npm install
npm run db:push          # includes the admin_audit_log table
npm run seed-admin -- you@example.com 'password' 'Name' super-admin
npm run dev

# TURN (optional locally; STUN-only works on the same machine)
docker compose up coturn

# User app
cd apps/web
pnpm install
pnpm dev

# Admin app
cd apps/admin
pnpm install
pnpm dev
```

Admin login: Turnstile → password → TOTP enroll on first login. Public signup is off.
