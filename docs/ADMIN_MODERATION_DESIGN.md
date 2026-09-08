# Admin Moderation — Tabbed UI, Fingerprinting, Incidents & Takeover

This doc describes the **admin-only** changes shipped in the current branch. No user-facing
chat flow is altered. The backend wiring is proposed; the admin UI already handles the missing
fields gracefully so the new tabs render even before the API is deployed.

## 1) Tabbed IA — easier moderation

**Before:** Rooms and Users were separate sidebar pages. Monitoring a room required navigating
to `/home/rooms?monitor=…`, with no incident context and no way to speak as moderation.

**Now:**
- `src/components/rooms/RoomMonitor.tsx` is tabbed: **Listen · Incidents · Takeover · Fingerprints**
  - Listen — stealth read (admin invisible). Messages are shown with PII/harassment highlights.
  - Incidents — client-side + server incidents for this room, with filters and actions.
  - Takeover — enter takeover (visible to users as “Moderator”), send warnings / moderator messages, force-end.
  - Fingerprints — per-participant fingerprint cards + DB explanation.
- New hub: `/home/moderation` (`src/app/home/moderation/page.tsx`)
  - Tabs: **Live Rooms · Incidents · Fingerprints · Flagged Users**
  - Live reuses the existing `RoomTable`; Incidents aggregates `monitoredRooms` + future `incident:new` events; Fingerprints groups live users by `fingerprintHash`; Flagged shows users with open incidents.
- Sidebar: `Moderation` (ShieldAlert) added after Rooms — `src/components/app-sidebar.tsx`.

The tabs use `@radix-ui/react-tabs` already present (`Tabs` primitive).

## 2) Fingerprinting — stored in DB, surfaced in admin UI

### Collection (web app, not in this PR)
- On first join, the web app computes a stable hash from canvas, WebGL, UA, timezone, screen, deviceMemory, etc., and emits `fingerprint:report { hash, canvasHash, webglHash, screen, timezone, language, platform, vendor, ... }` over the user socket.

### Storage (API, proposed)
```sql
create table user_fingerprints (
  id uuid primary key,
  hash text not null unique,
  canvas_hash text,
  webgl_hash text,
  audio_hash text,
  screen text,
  timezone text,
  language text,
  platform text,
  vendor text,
  device_memory int,
  hardware_concurrency int,
  plugins jsonb,
  fonts jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  seen_count int not null default 1,
  linked_uids jsonb not null default '[]'::jsonb,
  risk_score int, -- 0..100
  ip_address text,
  user_agent text
);
create index on user_fingerprints (last_seen_at desc);
create index on user_fingerprints using gin (linked_uids);
```
- Handler `connection.handler.ts` / new `fingerprint.handler.ts` upserts on `hash`: `seen_count++`, `last_seen_at=now()`, merge `linked_uids`.

### Admin surfacing (shipped)
- Types: `UserFingerprint`, `User.fingerprint`, `User.fingerprintHash`, `User.incidentCount` — `src/types/socket.ts`.
- Helpers: `src/lib/fingerprint.ts` (`shortHash`, `riskBadge`, `fingerprintSummary`, `timeAgo`).
- Users table: new **Fingerprint** column + pill in the user cell + `FP` button → `UserFingerprintSheet` dialog (`src/components/users/UserFingerprintSheet.tsx`).
- Rooms → Fingerprints tab + Moderation → Fingerprints tab group live users by hash and flag `linkedUids.length > 1` as possible alt / ban evasion.
- All components tolerate missing fingerprints: they show “— no fp” / “No fingerprint yet”.

## 3) Incident system — Instagram, phone, harassment (admin UI only)

### Detection (admin UI, instant)
- `src/lib/incidentDetector.ts`
  - Instagram: `/(?:instagram\.com\/|ig\s*:\s*|insta\s*:\s*|@)([a-zA-Z0-9._]{1,30})/gi`
  - Phone: `/(?:\+?91[\s-]?)?(?:\d[\s-]?){10,12}|\b\d{10}\b/g` with digit-length filtering
  - Email: standard RFC-ish
  - Harassment heuristic: keyword list (`kill yourself`, `kys`, `i will find you`, `send nudes`, …)
  - Exposes `detectIncidents(text)`, `incidentsFromMessage`, `highlightIncidents(text)`, `severityColor`, `typeLabel`.

The same patterns should run server-side before persisting.

### Storage (API, proposed)
```sql
create table chat_incidents (
  id uuid primary key,
  room_id text not null,
  message_id text,
  uid int not null,
  user_name text not null,
  type text not null, -- instagram_handle | phone_number | email | harassment | threat | spam | pii_leak
  severity text not null, -- low | medium | high | critical
  matched_value text not null,
  snippet text not null,
  status text not null default 'open', -- open | reviewed | dismissed | actioned
  reviewed_by text,
  created_at timestamptz not null default now()
);
create index on chat_incidents (room_id, created_at desc);
create index on chat_incidents (status, severity);
create index on chat_incidents (uid);
```
- Chat handler calls `incidentService.scan(roomId, uid, text)` after `roomService.addChatMessage`; matching rows are inserted and broadcast as `incident:new` on the admin namespace. Moderation history persists after rooms expire.

### Admin UI (shipped)
- `ListenPanel` — highlights matched substrings with `<mark>` and shows per-message badges.
- `IncidentStrip` — room-scoped list with type/severity/status filters + per-incident actions (reviewed/dismissed/actioned).
- `IncidentDashboard` — global view under Moderation → Incidents (derived from `monitoredRooms` today; merges `incident:new` when wired).
- Flagged Users tab — users who have open incidents.

## 4) Chat takeover & listen — admin UI

### Modes
- **Listen** (default): admin subscribes via `monitor_room`, receives `room_message` and `monitor_started` history, but does not join the room. Users cannot see the admin. This is the existing flow.
- **Takeover**: admin opts in (button in Takeover tab). Server should: `socket.join(roomId)` as a privileged participant, broadcast a system notice (“Moderator has joined”), and allow `admin:message` (sent as `Moderator`) and `admin:warning` (system). All events are `adminAuditLog`-tracked (`action: takeover_enter | admin_message | admin_warning`).

Proposed socket events (admin namespace):
```
admin:takeover:enter { roomId }
admin:takeover:leave { roomId }
admin:message { roomId, text }   -> room `message` from Moderator + `admin_message` to other admins
admin:warning { roomId, text }   -> room `system` message + admin broadcast
incident:action { incidentId, action }  -- reviewed | dismissed | actioned
incident:new                    -- server push
fingerprint:sync                -- optional, when a fingerprint is linked
```

### What the UI does today (without backend changes)
- `TakeoverPanel` (`src/components/rooms/monitor/TakeoverPanel.tsx`) lets the admin toggle between listen/takeover, draft a warning, draft a moderator message, and force-end the room. Drafts are validated (800 char cap). Sends call the optional `onSendAsModerator` / `onSendWarning` props; the Rooms page currently logs them and force-end delegates to `closeRoom`. Swapping the log for `socket.emit("admin:message", …)` is the only wiring step.
- Audit: existing `adminAuditService.track` already covers `monitor_room`, `kick`, `close_room`. Add `takeover_enter`, `admin_message`, `admin_warning` when the handlers land.

## 5) File map

```
apps/admin/src/types/socket.ts                     -- UserFingerprint, Incident, Takeover types
apps/admin/src/lib/incidentDetector.ts            -- regex + highlight
apps/admin/src/lib/fingerprint.ts                 -- shortHash, riskBadge, timeAgo
apps/admin/src/components/rooms/monitor/ListenPanel.tsx
apps/admin/src/components/rooms/monitor/TakeoverPanel.tsx
apps/admin/src/components/rooms/monitor/IncidentStrip.tsx
apps/admin/src/components/rooms/monitor/FingerprintCard.tsx
apps/admin/src/components/rooms/monitor/index.ts -- re-exports
apps/admin/src/components/rooms/RoomMonitor.tsx   -- tabbed (4 tabs)
apps/admin/src/components/users/UserFingerprintSheet.tsx
apps/admin/src/components/users/UserTable.tsx     -- fingerprint column + sheet
apps/admin/src/components/incidents/IncidentDashboard.tsx
apps/admin/src/app/home/moderation/page.tsx       -- hub: Live/ Incidents/ Fingerprints/ Flagged
apps/admin/src/components/app-sidebar.tsx         -- + Moderation item
apps/admin/src/app/home/rooms/page.tsx            -- wire takeover callbacks
```

## 6) Verification

- `pnpm --filter admin-omegle-vitap type-check` should pass (new types are optional/nullable so old payloads still validate).
- Manual: connect two users, create a room, send “my insta is @bad_handle and call 9876543210” — Listen tab should highlight both and Incidents tab should list 2 incidents; Users table should show fingerprint pills once `fingerprintHash` is present.
