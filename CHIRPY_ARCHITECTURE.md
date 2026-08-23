# CHIRPY — Architecture & Usage Guide

## What CHIRPY Does

CHIRPY is a Google Meet analytics platform. While you're in a meeting, the Chrome extension:

- **Records** the meeting (video + audio) as WebM
- **Tracks** every participant: chat messages, hand raises, speaking time, attendance duration
- **Syncs** data to the backend at session end
- Lets you **download** the recording (WebM or converted MP4) and view a **participation dashboard**

---

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│  Google Meet Tab (meet.google.com)                  │
│                                                     │
│  content.ts ──── GoogleMeetAdapter                  │
│     │  Tracks: joins, leaves, chat,                 │
│     │          speaking, hand raises                │
│     │                                               │
│     └──STORE_INTERACTION──► background.ts           │
│                              │                      │
│  RecordingOverlay.ts         │  InteractionRepository│
│  (draggable overlay UI)      │  (IndexedDB - extension│
│     │                        │   scope)             │
│     └──DOWNLOAD_RECORDING──► │                      │
│          ◄── dataUrl ────────┘                      │
│                                                     │
└─────────────────────────────────────────────────────┘
         │  FINISH_MEETING_SESSION
         ▼
┌─────────────────────────────────────────────────────┐
│  background.ts (Service Worker)                     │
│                                                     │
│  SessionSyncOrchestrator                            │
│    • aggregates per-participant stats               │
│    • POST /api/sessions/sync  ──────────────────────┼──► Backend API :3001
│                                                     │
│  RecordingManager ◄──────────────────               │
│    • starts/stops offscreen doc                     │
│                                                     │
└─────────────────────────────────────────────────────┘
         │  webBridge (window.postMessage)
         ▼
┌─────────────────────────────────────────────────────┐
│  Web App (localhost:5173)                           │
│                                                     │
│  MeetingDetailPage                                  │
│    • fetches recording via extension bridge         │
│    • shows participant table                        │
│    • Download WebM / Convert MP4 (ffmpeg.wasm)      │
└─────────────────────────────────────────────────────┘
```

### Recording pipeline (offscreen doc)

```
background.ts ──OFFSCREEN_RECORDING_START──►
  offscreen.ts
    RecordingService
      StreamCapture.captureDisplayMedia()
        → getDisplayMedia (video: {frameRate:30}) + getUserMedia (mic)
        → AudioContext mixer (tab audio + mic)
      MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' })
      → chunks[] accumulated
    RecordingService.stop() → Blob → RecordingRepository (IndexedDB)
◄──recordingKey──background.ts
```

---

## Data Captured Per Participant

| Field | How captured | Where stored |
|-------|-------------|-------------|
| **Name** | DOM: `[data-self-name]`, `[data-participant-id]` tiles | `LocalInteraction.participantName` |
| **Join time** | Participant appears in DOM → `join` event | `LocalInteraction` |
| **Leave time** | Participant disappears from DOM → `leave` event | `LocalInteraction` |
| **Attendance (s)** | `leave.metadata.durationSeconds` = now − joinTimestamp | Aggregated in `InteractionRepository` |
| **Chat count** | `Enter` keydown on chat input + DOM mutation of `.Ss4fHf` | `LocalInteraction` type `chat_message` |
| **Hand raises** | DOM addition of `front_hand` icon / `aria-label*="raised hand"` | `LocalInteraction` type `hand_raise` |
| **Speaking start/stop** | MutationObserver on `.YEI2ub` + `aria-label="Name is speaking"` | `LocalInteraction` type `speaking_start`/`speaking_end` |
| **Speaking (s)** | `speaking_end.metadata.durationSeconds` | Aggregated in `InteractionRepository` |

---

## Key Files

### Extension (`apps/extension/src/`)

| File | Purpose |
|------|---------|
| `content/content.ts` | Main content script — detects meeting, wires all events |
| `content/adapters/GoogleMeetAdapter.ts` | All Meet-specific DOM logic (chat, speaking, hand raise, participants) |
| `content/RecordingOverlay.ts` | Draggable floating UI (Record / Stop / Download) |
| `content/webBridge.ts` | Relay recording data from extension IndexedDB to web app via postMessage |
| `background/background.ts` | Service worker — routes messages, handles recording lifecycle |
| `background/RecordingManager.ts` | Start/stop offscreen recording, manage state |
| `background/SessionSyncOrchestrator.ts` | Build sync payload, send to backend |
| `db/InteractionRepository.ts` | Aggregate participant stats from raw events |
| `db/RecordingRepository.ts` | Store/retrieve recording blobs (IndexedDB) |
| `offscreen/offscreen.ts` | Offscreen document — actual MediaRecorder capture |
| `recording/StreamCapture.ts` | getDisplayMedia + mic capture + AudioContext mixer |
| `utils/blob.utils.ts` | blobToDataUrl, dataUrlToBlob, downloadBlobInPage |

### Backend (`apps/backend/src/`)

| File | Purpose |
|------|---------|
| `api/routes/session.routes.ts` | `POST /api/sessions/sync` |
| `api/controllers/session.controller.ts` | Idempotency dedup, upsert meeting/session/interactions |
| `services/ReportService.ts` | Aggregate interactions → MeetingReport |
| `api/routes/report.routes.ts` | `GET /api/reports/meeting/:id` |
| `models/Interaction.model.ts` | Per-participant stats document |

### Web (`apps/web/src/`)

| File | Purpose |
|------|---------|
| `pages/Meeting/MeetingDetailPage.tsx` | Participant table + recording download UI |
| `utils/recording.utils.ts` | Fetch recording from extension via postMessage bridge |
| `utils/mp4.utils.ts` | ffmpeg.wasm WebM→MP4 conversion |

---

## Running the Project

```bash
# Start everything
pnpm dev

# Ports:
#   Backend  → http://localhost:3001
#   Web app  → http://localhost:5173

# Build extension
pnpm --filter @chirpy/extension build
# Then load dist/ folder at chrome://extensions (Developer mode → Load unpacked)
```

### After any extension code change
1. Run `pnpm --filter @chirpy/extension build`
2. Go to `chrome://extensions`
3. Click **Reload** on CHIRPY

---

## Testing

### Unit tests (extension)
```bash
pnpm --filter @chirpy/extension test
```
Covers:
- `blob.utils` — dataUrl encoding, round-trip, download trigger
- `idempotency.utils` — key generation determinism
- `InteractionRepository` — chat count, hand raise, speaking duration, attendance aggregation
- `RecordingStateMachine` — state transitions

### Integration tests (backend API)
```bash
# With backend running on :3001
node scripts/test-integration.mjs
# Optional env vars:
# TEST_EMAIL=your@email.com TEST_PASSWORD=yourPass
```
Verifies:
1. Login → JWT token
2. Session sync with full participant payload
3. Meeting lookup
4. Participation report (checks Alice/Bob stats)
5. Idempotency (same key → same meetingId, no duplicate)

---

## Recording Download — Formats

| Format | How | Compatibility |
|--------|-----|--------------|
| **WebM** | Direct IndexedDB → dataUrl → `<a download>` | Chrome, Edge, Firefox, VLC. **Not** Windows Media Player. |
| **MP4** | ffmpeg.wasm converts WebM in-browser | All players including Windows Media Player |

> **Note**: The web app's video preview (`<video>` element) plays WebM natively in Chrome/Edge. The MP4 button requires the **COOP/COEP** headers set in `vite.config.ts` for ffmpeg.wasm's SharedArrayBuffer requirement.

---

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Recording is 0 bytes / empty | Extension not reloaded after build | Reload at `chrome://extensions` |
| "Recording not found" on download | Service worker restarted (idle timeout) | Re-record; extension SW wakes on first message |
| Chat count = 0 on dashboard | Chat panel never opened during meeting | Open the chat panel; messages are captured via DOM |
| Speaking always 0 | Meet version uses different CSS classes | Check console for `[CHIRPY] speaking start` logs; update `YEI2ub` selector in `GoogleMeetAdapter.ts` |
| MP4 conversion fails | ffmpeg.wasm needs COOP/COEP headers | Restart `pnpm dev` (headers added to `vite.config.ts`) |
| Duplicate participants in report | Old session with stale idempotency key | Record a new meeting session |

---

## Participant Tracking — Implementation Notes

### Speaking detection
Google Meet does not expose a public API for speaking state. CHIRPY uses a multi-strategy DOM observer:

1. **aria-label mutation** — `"Name is speaking"` (works on most current Meet versions)
2. **CSS class `.YEI2ub`** — animated waveform element added/removed on tiles
3. **1-second poll** — safety net for any mutation that was missed

If Meet ships a DOM change that breaks detection, update the selectors in `GoogleMeetAdapter.onSpeakingChange`.

### Hand raise detection
Watches for `front_hand` Material icon text content and `aria-label*="raised hand"` attribute additions anywhere in the document.

### Attendance
- `join` event fired when a participant **first appears** in the tile DOM
- `leave` event fired when they **disappear**, with `metadata.durationSeconds` pre-computed
- `InteractionRepository.aggregateByParticipant` sums precomputed leave durations; falls back to `(lastLeave − firstJoin)` if metadata is absent

---

## Scoring Formula (backend)

`participationScore` (0–100) is computed in `@chirpy/shared/scoring.utils.ts`:

```
score = weighted sum of:
  chatMessages      × 20 points each  (capped at 60)
  handRaises        × 30 points each  (capped at 60)
  speakingSeconds   × 0.1 pts/sec     (capped at 40)
  attendancePct     × 20 pts (attendance/duration)
```

Engagement levels: `high ≥ 70`, `medium ≥ 40`, `low < 40`.
