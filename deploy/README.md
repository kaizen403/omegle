# Single-Box Deployment Guide

One host, Docker only, no Kubernetes/Cloud Run. Topology:

```
Caddy (TLS, static web+admin, WS proxy)
  └─ api  (Express + Socket.IO; mediasoup SFU + ffmpeg recording in Phase 2)
coturn (host network — TURN relay, full UDP range)
postgres / redis (internal only, never published)
```

## Prerequisites

- Docker Engine 24+ with the compose plugin
- Ports open: 80/tcp, 443/tcp+udp (Caddy), 3478/tcp+udp and 49160–59259/udp (coturn)
- DNS: `WEB_DOMAIN` and `ADMIN_DOMAIN` A/AAAA records → this machine's public IP

## Steps

```bash
# 1. Build the static frontends (outputs to apps/web/out and apps/admin/out)
cd apps/web   && pnpm install && pnpm build
cd apps/admin && pnpm install && pnpm build

# 2. Configure
cd deploy
cp .env.example .env   # fill in every value; secrets must be long + random

# 3. Init the database schema + first admin (one-time)
docker compose up -d postgres
docker compose run --rm --entrypoint "" api \
  node dist/src/scripts/seed-admin.js you@example.com 'password' 'Name' super-admin
# (run drizzle push the same way if migrations aren't shipped in the image)

# 4. Bring everything up
docker compose up -d --build

# 5. Verify
curl -f https://$WEB_DOMAIN/health
docker compose logs -f api   # config validation exits hard on missing env
```

## Sizing (48 vCPU / 188 GB)

| Component | Budget |
|---|---|
| mediasoup workers | `numCores - 4` workers (44) — configured when the SFU lands |
| Concurrent recorded streams | ~400–600 @ 720p30 VP8/H264 (recording ≈ 1 core per 8–12 inbound streams after simulcast layer selection) |
| RAM | mediasoup ~40–80 MB/stream peak → well within 188 GB; cap API container at ~32 GB anyway |
| Disk (recordings) | ~360 MB/room/hour at 720p. 100 rooms × 2 h ≈ 72 GB/day — provision a ≥500 GB volume and enforce the S3-upload + prune job |
| coturn relay | Worst case ~2× total media bandwidth if both peers are behind symmetric NAT; typical campus networks see <10% relayed |

Set `nofile` ≥ 65536 (already in compose) and `sysctl net.core.rmem_max=4194304`,
`wmem_max=4194304` on the host — mediasoup warns otherwise.

## Operational notes

- **Single API instance is intentional.** All state (in-process socket maps +
  in-memory rate limiter) assumes one process. Do NOT scale `api` with
  `--scale api=2`; matchmaking will silently break. See audit item #2.
- Redis runs `noeviction` + AOF: matchmaking/room state must not be evicted.
- Recordings volume (`recordings`) is the raw landing zone; S3 is the durable
  store. Loss of the volume before upload = loss of recordings (Phase 2
  includes the upload-and-prune job).
- Logs are json-file with rotation caps; winston file logs additionally go to
  the `api_logs` volume.

## What still needs code work before this is production-real

This compose file deploys the current code, which today is P2P-only (no
recording) and has the audit findings. Before real users:

1. `/api/upload` has no auth (critical)
2. mediasoup integration + forced-relay client changes (Phase 2, see
   `docs/RECORDING_ARCHITECTURE.md`)
3. moderation/reporting loop
4. `trust proxy` + HTTPS-redirect hardening (Caddy now fronts TLS, so the API's
   own HTTPS redirect is redundant — it should be removed when proxying)
