# Recording Architecture

> **DECISION (updated):** The original SFU plan below is superseded for the
> 2k-concurrent target. The production approach is now **client-blob
> streaming** — each browser records its composite locally (aggressive HW
> encode, ~400kbps) and streams WebM chunks to the server, which appends to
> disk with zero transcoding and archives to S3. See
> `apps/api/src/services/recording/ingest.service.ts`,
> `apps/api/src/routes/recording.routes.ts`, and
> `apps/web/src/services/recording/recordingUploader.ts`.
>
> Tradeoff vs the SFU plan: not tamper-proof (client controls the encoder).
> Mitigated by ordered sequence numbers, server-side gap accounting, sha256
> manifests, and idle-session sweeps — recordings with gaps are flagged
> `integrity: 'gaps'` for moderation review. The SFU design below remains the
> fallback if cryptographic tamper-proofing ever becomes a hard requirement
> (capacity at 48 cores: ~400–600 streams, not 2k).
>
> --- Original SFU design (fallback) ---

# Server-Side Recording Architecture (Tamper-Proof)

Requirement: moderation/compliance evidence. Clients cannot be trusted to
record, therefore **all media must terminate on the server**. This replaces the
current 1:1 P2P model with a lightweight SFU.

## Why mediasoup

- Runs **inside the existing Node/Express/Socket.IO process** — no extra media
  server (LiveKit/Janus/Jitsi) to deploy, monitor, or authenticate against.
  Single-box Docker goal stays a single deploy unit.
- Liberal licensing, media never leaves the box unencrypted, per-room
  PlainTransport makes ffmpeg recording straightforward.
- 48 cores → ~400–600 concurrent recorded 720p streams (1 core ≈ 8–12 inbound
  streams after dropping simulcast layers).

## Media plane changes

```
Peer A ─WebRTC─► mediasoup WebRtcTransport (router per room)
Peer B ─WebRTC─►        │
                        ├─ PlainTransport (RTP) ──► ffmpeg ──► /recordings/{roomId}.mkv
                        └─ PlainTransport ───────► ffmpeg (second peer's composite)
```

1. **Room creation** (`matchmaking.service` on successful match): create a
   mediasoup `Router` (mediaCodecs: VP8/H264 + opus). Store router on the room.
2. **Peer join**: replace the current SDP-relay flow in `signal.handler` with:
   - client `getRouterRtpCapabilities` → `createWebRtcTransport` (one for
     produce, one for consume; `listenIps` = host private IP; ports 40000–49999
     UDP, opened on the host firewall)
   - existing Socket.IO events (`signal`) become transport `connect` /
     `produce` / `consume` request/response RPCs.
3. **Client** (`apps/web` WebRTC layer): stop sending STUN-only ICE candidates;
   every peer connects to mediasoup only. This is mandatory — any direct P2P
   path is unrecorded and defeats the purpose.
4. **Recording consumers**: on room activation, attach two `PlainTransport`s
   and spawn one `ffmpeg` per room:
   `-i sdp://record.sdp -c:v libvpx -c:a libopus -f matroska /recordings/{roomId}.mkv`
   (VP8 passthrough re-mux where possible — no transcode keeps CPU ≈ 0 for
   recording itself). Composite both tracks into one file via a second pair or
   by recording per-peer files + post-merge.
5. **Room end**: kill ffmpeg (SIGTERM, wait for moov/finalize), upload to S3
   `recordings/{yyyy-mm-dd}/{roomId}.mkv` with SSE, verify, delete local file.
   A cron/sidecar re-uploads stragglers and prunes >24h-old local files.
6. **Integrity**: write `{roomId}.json` manifest (uids, IPs, start/end,
   ffmpeg version, sha256 of the file) alongside; hash makes tampering
   detectable. Optional: hash-chain manifests per day.

## Failure handling

- Peer disconnect → keep recording until room torn down (evidence of the
  remaining peer).
- ffmpeg crash → restart, record to `.part-N` files; mark manifest degraded.
- API restart → on boot, scan `/recordings` for orphans, finalize+upload them.
- Router/transport state must be rebuilt on reconnect (clients re-produce).

## Infrastructure prerequisites (already sized in deploy/README.md)

- Dockerfile: **Alpine → `node:20-bookworm-slim`** (mediasoup native worker).
- Host firewall: open UDP 40000–49999 (mediasoup) + existing TURN range.
- `rmem_max`/`wmem_max` sysctls.
- Recordings volume ≥ 500 GB or stricter prune policy.
- mediasoup workers: `numCores - 4` = 44 workers.

## Phasing

1. **Phase 1** (this deploy): single-box compose as-is (P2P, no recording).
2. **Phase 2**: mediasoup in API + client rewrite (largest change — touches
   `signal.handler`, `match.handler`, room lifecycle, and the whole web WebRTC
   layer). Ship behind a flag; keep P2P path for rollback.
3. **Phase 3**: ffmpeg recording pipeline + S3 archive/prune job.
4. **Phase 4**: admin UI: recording list/retention policy (ties into the
   moderation loop from the audit).
