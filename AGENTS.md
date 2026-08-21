# Agent notes — Omegle VITAP

Three apps, one product. This folder is **not** a git root; each app may have its own repo.

| Directory | Role | Port |
|-----------|------|------|
| `omegle-vitap/` | User Next.js | 3000 |
| `admin-omegle-vitap/` | Admin Next.js | 3001 |
| `omegle-vitap-backend/` | Express + Socket.IO | 8080 |

Read [ARCHITECTURE.md](ARCHITECTURE.md) when changing a **service boundary**, adding a store, or explaining the HTTP/socket map.

## Stores

| Store | Owns | Client |
|-------|------|--------|
| **Neon** | Better Auth tables, `bot_config`, `user_visits` | Drizzle |
| **Redis / ElastiCache** | Queues, rooms, presence, Socket.IO pub/sub | `redis` (`createClient`) |
| **S3** | Chat file blobs | `@aws-sdk/client-s3` |
| **coturn** | TURN for P2P ICE when NAT fails | Backend mints time-limited REST-auth creds. Browsers: `RTCPeerConnection` |
| **PostHog** | User-app product events | `analytics.track*()` facade |

Firebase is gone. Identity, files, analytics, and admin data do not go back to Google.

**Video is 1:1 P2P.** Express relays SDP/ICE on Socket.IO and mints TURN credentials. Media does not go through Node or Redis. Do not embed an SFU in the Node process. Silent admin audio tap is not available.

## Frozen contracts

**Admin identity** is a Better Auth `user` with `role` (`admin` \| `super-admin`) and `isActive`. Public signup is disabled; first admin is `npm run seed-admin` in the backend.

**Admin HTTP:** session cookie, `credentials: "include"`. Sign-in is `POST /api/auth/sign-in/email` with Turnstile header `x-captcha-response`. Admin REST is `/api/admin/*`. Mount Better Auth **before** `express.json()`, matching every path under `/api/auth/` (Express 4 `*` is one segment).

**Admin socket** `/admin`: `withCredentials: true` and `auth.token` = Better Auth **session token**.

**Login sequence:** Turnstile → password → TOTP **enroll** on first login (QR + verify) → later logins TOTP verify only. Password minimum is **8**.

**Logout:** revoke on the backend (`POST /api/admin/logout`) while the cookie still exists, then `authClient.signOut()`.

**User sockets** use the product JWT, not Better Auth.

**Uploads:** `POST /api/upload` (API key) returns `{ success, fileUrl, fileName, fileSize, mimeType, filePath }`. Only the blob store is S3.

**Analytics:** keep `import { analytics } from '@/services/analytics'` and `track*()` names. Call-site event names stay. Visit logs for admin “users by date” are Neon `user_visits` (IST `visit_date`), not PostHog.

**CORS:** `ALLOWED_ORIGINS` is an explicit list. Strip `*`. Production cookies use `SameSite=None; Secure`.

**POST `/status`:** toggle requires an **admin session**. `GET /status` stays public (user app checks if the service is open).

## Env names

Do not invent aliases.

- User FE: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_API_KEY`
- Admin FE: `NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (API key unused for `/api/admin/*`)
- Backend: `DATABASE_URL` (Neon pooled), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `TURNSTILE_SECRET_KEY`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_TLS`, `AWS_REGION`, `S3_BUCKET`, `S3_PUBLIC_BASE_URL`, `TURN_HOST`, `TURN_AUTH_SECRET`, `TURN_PORT`, `TURN_TLS_PORT`, `STUN_URLS`, `TURN_REALM`, `ALLOWED_ORIGINS`, `API_KEY`, `JWT_SECRET`

S3 credentials use the AWS SDK default chain. Redis TLS: `REDIS_TLS=true` for ElastiCache.

## Edit scope

Auth or cookie changes need **admin FE + backend together**. User-app analytics stay in `omegle-vitap/`. Durable schema stays in `omegle-vitap-backend/src/db/`. Keep matchmaking/rooms in Redis (no Postgres `LISTEN/NOTIFY`, no rooms in Neon).

## Local boot (backend)

1. Fill `omegle-vitap-backend/.env.development` (`DATABASE_URL` required).
2. `npm run db:push` then `npm run seed-admin -- <email> <password> [name] [role]`
3. Redis on `localhost:6379`. Coturn for video (`TURN_HOST` + `TURN_AUTH_SECRET`; Docker in `omegle-vitap-backend/docker-compose.yml`). STUN-only works in local if TURN is unset.
4. S3 required in production; local uploads throw if `S3_BUCKET` / `AWS_REGION` are empty.

## Git

Do not `git commit` or `git push` unless the human asked in this conversation. No Cursor co-author trailers.
