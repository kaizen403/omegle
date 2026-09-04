# Omegle VITAP — Security Remediation

**4 September 2026** · apps/web, apps/admin, apps/api, infra

A pass across the user app, admin dashboard, API, and the AWS + Cloudflare infrastructure
behind them. The single largest win was not a patch: removing file attachments deleted two
critical findings outright, and the change set is net negative.

| | |
|---|---|
| Files touched | 78 |
| Lines | +1,917 / −2,226 |
| Tests passing | 360 (was 303) |
| API tests | 75 (was 18) |

Nothing is committed — all changes are in the working tree.

---

## 1. Before you deploy

Four things need doing on your side. The first is not new breakage — video is broken in
production right now, and the API will refuse to start until it is fixed rather than failing
silently as it has been.

> **⚠️ Video is currently broken for most mobile users**
>
> `push-ssm-env.py` hardcoded `TURN_AUTH_SECRET` to the literal string
> `unconfigured-cloudflare-turn`. It has no colon, so `parseCloudflareTurnSecret` returns null
> and ICE minting silently falls back to STUN-only. Anyone behind CGNAT — which on Jio and
> Airtel mobile is nearly everyone — gets no video, no error, and no log line.

**1. Set a real `TURN_AUTH_SECRET`**
Cloudflare Realtime TURN expects `{keyId}:{apiToken}`. It now comes from your local env rather
than a hardcoded placeholder, and production refuses to boot on a malformed value instead of
quietly serving STUN-only.

**2. Run `npm run db:push`**
Adds `admin_audit_log`. Admins can read live private conversations through room monitoring;
nothing recorded who read what. That table is now written on monitor, kick, bulk kick, close
room, and clear queue.

**3. Set `INTERNAL_API_KEY`**
`/metrics` and `/health/details` were guarded by `API_KEY` — which ships to browsers as
`NEXT_PUBLIC_API_KEY`. They now use a server-only key and return 404 until it is set.

**4. Set the remaining production secrets**
`TURNSTILE_SECRET_KEY` is now mandatory in production; `EDGE_SECRET` goes on both the Worker
and the origin; and `vars.AWS_DEPLOY_ROLE_ARN` is needed because the API deploy moved from
long-lived AWS keys to OIDC.

### Deploy order does not matter

The join protocol changed — the client no longer sends a `uid` — but the server always sends
`isOfferer` in the match payload, and the client prefers it over comparing ids itself. A cached
old client still negotiates the correct WebRTC role against the new server.

---

## 2. Removed rather than patched

File and image attachments are gone from all three apps, on your instruction. This was also the
cheapest way to close two critical findings.

| Finding | Detail |
|---|---|
| **Arbitrary S3 object deletion** | `file_message.filePath` was unvalidated client input, stored on the socket and passed to `DeleteObject` on disconnect. Naming any key in the bucket deleted it. |
| **Open public file host** | `/api/upload` took `roomId` and `uid` from the body with no membership check, behind a public key — and the bucket carried a `"Principal": "*"` read policy with `BlockPublicPolicy=false`. |
| **Arbitrary URL injection** | `fileUrl` was rendered into `<img>`, `<iframe>` and `<a href>` in the partner's browser and in the admin dashboard. |

Deleted: the upload route, the S3 service, the `file_message` event, the `FileUpload` and
`FileMessage` components, the admin media renderer, the public bucket in `bootstrap-aws.sh`,
and the `@aws-sdk/client-s3` and `multer` dependencies. Also removed the committed `dump.rdb`.

---

## 3. Findings fixed

Severity reflects what an attacker could actually do against this deployment, not generic
class. Everything listed is fixed and covered by the test suite where the behaviour is testable.

### Critical

| Finding | Where |
|---|---|
| **Session hijacking.** `uid` came from the client and the server did `connections.set(uid, socket)` — last writer wins. Ids were `(Date.now() % 1e6) * 1000 + rand(0..999)`: guessable, and cycling every 16.7 minutes. The server now issues a random id on connect and ignores the payload. | `connection.handler.ts` |
| **Every per-IP limit bypassable.** `trust proxy: true` plus reading `CF-Connecting-IP` unconditionally meant a fresh identity per request. Now resolved against an explicit `TRUSTED_PROXIES` allowlist, walking `X-Forwarded-For` right-to-left. | `utils/clientIp.ts` |
| **Rate limiting was decorative** — 1,000 req/s per IP, and `/api/auth/*` was mounted *before* the limiter, so sign-in was entirely unthrottled. Now 20 r/s global and 0.2 r/s on auth, applied first. | `app.ts` |
| **CORS wildcard matched sibling domains**: `*.vitap.in` accepted `evil-vitap.in`. With `credentials: true` that is a credentialed cross-origin read of every admin endpoint. | `middleware/cors.ts` |
| **Origin directly reachable**, so Cloudflare's WAF and rate limits were one curl away from irrelevant. Security group narrowed to Cloudflare ranges, plus an `X-Edge-Secret` the origin requires. | `bootstrap-aws.sh`, `edgeGuard.ts` |

### High

| Finding | Where |
|---|---|
| **Cloudflare → origin was plaintext HTTP**: session cookies, TURN credentials and chat crossed the public internet in the clear. `deploy.sh` now binds Caddy to `127.0.0.1` when a tunnel token is present, so there is no public listener at all. | `deploy.sh`, `compose.yml` |
| **TURN silently disabled** by a hardcoded placeholder secret — no video for anyone behind CGNAT. Production now validates the secret shape at boot. | `push-ssm-env.py`, config |
| **Unbounded limiter maps** keyed by IP and uid: a key flood grew the heap until the process died. Replaced with an LRU-bounded token bucket. | `utils/boundedRateLimiter.ts` |
| **Any unhandled promise rejection called `process.exit(1)`.** Several request paths fire promises without awaiting them, so one rejection was a full outage. Now logged, not fatal. | `src/index.ts` |
| **Long-lived AWS keys** in repo secrets granted production shell via SSM `AWS-RunShellScript`, with no environment gate. Moved to OIDC, and the trust policy scoped from `repo:*` to `refs/heads/main`. | `api-deploy.yml`, `gha-trust.json` |
| **Unauthenticated admin sockets** could linger and spam `auth`, amplifying load onto Neon session lookups. Now rate-limited per IP with a 10s authenticate-or-disconnect grace window. | `admin.handler.ts` |

### Medium

| Finding | Where |
|---|---|
| `/metrics` and the detailed health payload sat behind the browser-published API key, exposing heap, CPU, Redis circuit-breaker state and connection counts. Split to a server-only key; public `/health` reduced to a status word. | `middleware/apiKey.ts` |
| `errorHandler` returned `err.message` to clients in all environments, turning any unexpected failure into information disclosure. | `middleware/errorHandler.ts` |
| Request timeout responded 408 but left the socket open, and the timer leaked on aborted requests. Slowloris held connections at near-zero cost. | `middleware/timeout.ts` |
| Socket.IO accepted 1 MB frames with a 45s handshake window. Now 64 KB and 10s, with a per-IP cap on concurrent sockets. | `handlers/socketio/index.ts` |
| Client IP was interpolated unescaped into the BigDataCloud request URL, with no timeout. API-key comparison used `!==` rather than a constant-time compare. | `geolocation.service.ts`, `apiKey.ts` |
| No audit trail for admin access to private chats. Added an append-only `admin_audit_log` covering monitor, kick, bulk kick, close room and clear queue. | `services/admin/audit.service.ts` |

---

## 4. Two worth looking at

Both were silent: the code read as if it worked, and nothing in the logs said otherwise.

### The queue removal that never ran

`apps/api/src/scripts/redis/match.lua`

`currentData` is rebuilt in `findMatch` with `name: ''` and a fresh `joinedAt`, so it never
byte-matched the member `addToQueue` stored. The caller was never removed from the queue, and a
third user could match with someone already paired.

Was — a no-op:

```lua
redis.call('ZREM', queueKey, selectedUser)
redis.call('ZREM', queueKey, currentData)
```

Now — captured during the scan it already performs:

```lua
if userUID == currentUID then
    currentMember = userData
end
...
redis.call('ZREM', queueKey, selectedUser)
if currentMember then
    redis.call('ZREM', queueKey, currentMember)
end
```

### The wildcard that matched anything

`apps/api/src/middleware/cors.ts`

Stripping `*.` and testing `endsWith` without the dot boundary accepts any domain ending in
those characters — and no scheme was checked either.

Was — accepts `evil-vitap.in`:

```ts
const domain = pattern.substring(2);
if (origin.endsWith(domain) && origin !== domain) {
  allowed = true;
}
```

Now — parsed, label boundary required:

```ts
const parsed = new URL(origin);
if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;

const host = parsed.host.toLowerCase();
if (host.endsWith(`.${domain}`) && host.length > domain.length + 1) {
  return true;
}
```

---

## 5. Cost controls

Every limiter in the codebase was keyed on `uid` — which the client chose for itself, so
rotating it reset the budget. These key on things the client cannot pick.

- **Per-IP budgets** — handshakes, joins, messages and concurrent sockets, all resolved against
  the trusted client IP and LRU-bounded.
- **Hourly LLM ceiling** — bot replies map one-to-one to paid model calls. A global rolling-hour
  budget caps the bill regardless of who is asking.
- **Geolocation ceiling and cache** — BigDataCloud is metered across five keys. Added a global
  hourly cap, a six-hour cache, IP validation and a 5s timeout.
- **Neon write amplification** — a fallback branch inserted a visit row on *every* join when no
  socket id was supplied. Removed; the tracked-socket set is now bounded.
- **Redis memory ceiling** — `maxmemory 512mb` with `allkeys-lru`, so a queue flood degrades
  matchmaking instead of OOM-killing the box.

---

## 6. Correctness and latency

Fixed alongside the security work, mostly from your audit.

- **IST midnight reset fired ~5.5h late** — an IST wall-clock reading was re-parsed as local
  time, then subtracted from a UTC timestamp. Replaced with fixed-offset arithmetic; 7 tests.
- **Queue stats double-counted** — `getQueueSize` ignored its gender argument, so the dashboard
  showed male = female = total. `clearQueue` likewise emptied both queues.
- **Redis health serialised as `{}`** — `checkHealth()` is async and was never awaited in two
  places.
- **100–300 ms sleep on every match** — a sleep standing in for a lock. Removed; the real mutual
  exclusion is the in-process set plus the now-working atomic ZREM pair.
- **Sequential ICE mints** — two back-to-back Cloudflare round-trips on the match critical path,
  with no deadline. Now `Promise.all` with a 4s timeout.
- **`KEYS` in the hot path** — blocking sweeps of the whole keyspace every 5 minutes, on the
  thread everything else shares. Switched to `SCAN`.
- **Two Redis GETs per keystroke** — typing indicators resolved the room through Redis when
  `socket.roomId` was already authoritative in memory.
- **Dev hack in a production path** — `ipAddress === '127.0.0.1' ? '8.8.8.8'` billed a lookup
  and recorded Google's address as the user's location.
- **Session id overflowed `int4`** — caught by a test written for the new identity code:
  `user_visits.uid` is an `integer` column, so the id range is bounded to 2^31−1.

---

## 7. Closed in follow-up (still not multi-replica)

- **LLM keys at rest** — `providerConfig.apiKey` is AES-256-GCM sealed with a key derived from
  `BETTER_AUTH_SECRET` (`enc:v1:`). `getConfig` decrypts in-process; the admin API still
  redacts to `hasApiKey`. Plaintext rows migrate on the next save.
- **`clearAllData()` on startup/shutdown** — removed. Room and queue keys expire via TTL.
- **System Health** — `trackMatch` / `trackRequest` / `trackError` / connection counters are
  wired through `runtimeMetrics`.
- **Smaller items** — admin CRUD handlers are shared; date-range stats are one query;
  Redis write retries are opt-in; privacy policy updated; homepage no longer uses a static
  `redirect()` (that shipped a blank `__next_error__` document).

**Still single replica.** No Socket.IO Redis adapter. `k8s/hpa.yaml` is coturn-only. Do not
scale the API process until the in-memory `connections` map is addressed.

---

## 8. Verification

All three apps typecheck and lint clean; the API also builds for production. New tests cover IP
spoofing, the CORS bypass, identity assignment, limiter bounds and IST scheduling.

| App | Tests | Suites |
|---|---|---|
| API | 75 (was 18) | 8 |
| Web | 159 | 11 |
| Admin | 126 | 7 |
| **Total** | **360** | **26** |
