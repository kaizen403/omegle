# Omegle VITAP — Architecture Overview

## Repositories

| Directory | Role | Framework | Port |
|-----------|------|-----------|------|
| `omegle-vitap/` | User-facing frontend | Next.js 16 + React 19 | 3000 |
| `admin-omegle-vitap/` | Admin dashboard frontend | Next.js 16 + React 19 | 3001 |
| `omegle-vitap-backend/` | Backend server | Express.js + Socket.IO | 8080 |

Realtime chat never went through Firebase. Users talk Socket.IO, rooms and queues sit in Redis, video is **browser P2P WebRTC** with coturn for TURN. Firebase was only admin identity, admin/app data, chat file blobs, and user-app product analytics. Those are gone.

---

## User Frontend (`omegle-vitap/`)

### Stack
- **Next.js 16**, **React 19**, **Tailwind CSS 4**
- **HeroUI**
- **XState 5**
- **PostHog** (funnel, match, error, engagement — same `analytics.track*()` facade)
- **Native WebRTC** (`RTCPeerConnection` — 1:1 P2P)
- **Socket.io Client** (signaling, matchmaking, chat)
- **Framer Motion**
- Vitest + Playwright

### Analytics
- PostHog only. Env: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`
- Visit logs for the admin “users by date” page are **not** PostHog; those are written by the backend to Neon

### Key Pages
- `/` — landing
- `/welcome` — onboarding (name, gender, interests)
- `/omegle` — video chat
- `/community-guidelines`, `/faq`, `/terms`, `/privacy`

---

## Admin Frontend (`admin-omegle-vitap/`)

### Stack
- **Next.js 16**, **React 19**, **Tailwind CSS 4**
- **Radix UI**
- **Better Auth client** (email/password + TOTP)
- **Cloudflare Turnstile** on login
- **Socket.io Client**
- **Framer Motion**
- Vitest + Playwright

### Auth contract
- Sign-in: `POST {NEXT_PUBLIC_BACKEND_URL}/api/auth/sign-in/email` with Turnstile header `x-captcha-response`
- Session: httpOnly cookie, `credentials: "include"` on every `/api/admin/*` call
- Socket.IO `/admin`: `withCredentials: true` and `auth: { token }` = Better Auth **session token** (not a Firebase JWT)
- Env: `NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`

### Key Pages
- `/` — login (Turnstile → password → TOTP enroll on first login, then TOTP verify)
- `/home` — dashboard
- `/home/rooms`, `/home/users`, `/home/bots`, `/home/logs`, `/home/health`, `/home/admins`

---

## Backend (`omegle-vitap-backend/`)

### Stack
- **Node.js**, **TypeScript**, **Express.js**
- **Socket.IO** (`/` users, `/admin` admins)
- **Redis** (ElastiCache; `REDIS_TLS=true` for in-transit encryption) — queues, rooms, presence, pub/sub
- **Neon Postgres + Drizzle** — Better Auth tables, `bot_config`, `user_visits`
- **Better Auth 1.4** — email/password, TOTP, bearer plugin (socket), Turnstile captcha on sign-in
- **JWT** — user (non-admin) socket tokens
- **coturn** — TURN REST-auth credentials (HMAC-SHA1); media stays P2P
- **S3** — chat file uploads (`POST /api/upload`)
- **Prometheus**, **Winston**

### Flow

```
User FE  ──WebSocket──► Socket.IO /
                         │
                         ├─► join (uid, name, gender, interests)
                         ├─► matchmaking queue (Redis)
                         ├─► room (Redis) + ICE servers (TURN creds)
                         ├─► chat / files (S3 URL) / leave / next
                         └─► bots (dev/testing)

Admin FE ──Better Auth──► /api/auth/*  (cookie session)
         ──REST─────────► /api/admin/* (cookie)
         ──WebSocket────► Socket.IO /admin (session token + cookie)
                         │
                         ├─► stats, rooms, queue, Redis health
                         ├─► system on/off
                         └─► bots, users-by-date (Neon user_visits)

HTTP ──► Express
          GET  /health
          GET  /status
          POST /status          (admin session cookie)
          GET  /metrics         (API key)
          *    /api/auth/*      (Better Auth)
          *    /api/admin/*     (session cookie)
          POST /api/upload      (API key → S3)
```

### Backend services

| Service | Purpose |
|---------|---------|
| `core/redis.ts` | Redis client, TLS, circuit breaker, health |
| `chat/` | Matchmaking queues, pairing, room lifecycle |
| `turn/` | Coturn REST-auth ICE credentials |
| `lib/auth.ts` | Better Auth (Neon adapter) |
| `storage/s3.ts` | Chat file upload/delete |
| `bots/` | Bot users + `bot_config` in Neon |
| `tracking/` | `user_visits` in Neon (IST calendar date) |
| `scheduler/` | Auto-off 11 PM–3 AM IST |

### Env (backend)

`DATABASE_URL` (Neon pooled), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `TURNSTILE_SECRET_KEY`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_TLS`, `AWS_REGION`, `S3_BUCKET`, `S3_PUBLIC_BASE_URL`, `TURN_HOST`, `TURN_AUTH_SECRET`, `TURN_PORT`, `TURN_TLS_PORT`, `STUN_URLS`, `TURN_REALM`, `ALLOWED_ORIGINS` (explicit origins only — no `*`)

---

## Target shape

```
User FE  ──Socket.IO──►  Express
Admin FE ──Better Auth──►     │
         Turnstile            ├─ Neon (sessions, admins, bots, visits)
                              ├─ ElastiCache Redis (queue, rooms, pub/sub)
                              ├─ S3
                              ├─ PostHog (browser events)
                              └─ coturn (TURN only; media is P2P)
```
