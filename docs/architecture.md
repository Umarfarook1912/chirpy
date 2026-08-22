# CHIRPY — Architecture

## Overview

CHIRPY is a pnpm monorepo containing three runtimes:

1. **`apps/web`** — React 18 frontend. Hosts the dashboard, meeting history, reports, and organization management.
2. **`apps/extension`** — Chrome Extension (MV3). Runs inside Google Meet, tracks interactions locally, syncs aggregated data to the backend.
3. **`apps/backend`** — Express + TypeScript REST API. Manages users, organizations, meetings, sessions, and participation data.
4. **`packages/shared`** — TypeScript types, Zod schemas, and constants shared across all three apps.

---

## Data Flow

```
Google Meet (browser tab)
        ↓
Chrome Extension (content script)
  - Detects meeting events
  - Tracks local interactions
  - Stores in IndexedDB (Dexie)
        ↓
Service Worker (background.ts)
  - Aggregates session data
  - Syncs batch to backend (idempotent)
  - Handles offline queue
        ↓
Backend API (Express)
  - Validates and stores session summaries
  - Computes participation scores (deterministic)
        ↓
MongoDB Atlas (M0)
  - Stores users, orgs, meetings, sessions, interactions
        ↓
Frontend (React web app)
  - Displays dashboards, reports, meeting history
```

---

## Key Design Decisions

### Local-first interaction tracking

Interactions are tracked locally in IndexedDB and synced as a single aggregated batch per session. This avoids N API calls per event and works offline.

### No AI

All participation scoring uses deterministic formulas and configurable thresholds defined in `packages/shared/src/constants/scoring.constants.ts`.

### Adapter pattern for meeting platforms

All Google Meet-specific code is isolated in `apps/extension/src/content/adapters/GoogleMeetAdapter.ts`. The `MeetingPlatformAdapter` interface allows future adapters (Teams, Zoom) without touching core logic.

### No recording upload

Meeting recordings are captured client-side via `getDisplayMedia` and downloaded directly to the user's device. The backend never receives video data.

---

## Module Boundaries

| Module | Responsibility |
|---|---|
| `Auth` | Registration, login, JWT refresh, logout |
| `Organization` | Org CRUD, member management, role assignment |
| `Meeting` | Meeting lifecycle, session tracking |
| `Participant` | Participant records linked to meetings |
| `Recording` | Client-side capture, state machine, download |
| `Reports` | Aggregated participation metrics and trends |
| `Dashboard` | Overview stats and recent activity |
| `Settings` | User profile and organization settings |
