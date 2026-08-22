# CHIRPY

**Meeting Interaction & Engagement Platform**

CHIRPY helps organizations understand meeting participation and engagement — without AI, without video uploads, without unnecessary cloud cost.

---

## Core Philosophy

> Observe interaction. Measure engagement. Encourage improvement.

---

## Architecture

This is a **pnpm monorepo** with Turborepo task orchestration.

```
chirpy/
├── apps/
│   ├── web/          # React 18 + Vite frontend
│   ├── extension/    # Chrome Extension (Manifest V3)
│   └── backend/      # Node.js + Express REST API
├── packages/
│   └── shared/       # Shared types, Zod schemas, constants
└── docs/             # Architecture & development documentation
```

---

## Tech Stack

| Layer | Choice |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Web | React 18 + Vite + TypeScript |
| Extension | Vite + CRXJS + TypeScript (MV3) |
| Backend | Express + TypeScript + MongoDB |
| Auth | JWT (httpOnly cookie) + Argon2 |
| Validation | Zod (shared across all apps) |
| Extension storage | Dexie.js (IndexedDB) |
| Testing | Vitest + Testing Library |

---

## Prerequisites

- Node.js >= 20
- pnpm >= 9

```bash
npm install -g pnpm
```

---

## Getting Started

```bash
# Install all dependencies
pnpm install

# Copy environment files
cp apps/backend/.env.example apps/backend/.env
cp apps/web/.env.example apps/web/.env

# Start all apps in development mode
pnpm dev
```

---

## Documentation

See the [`docs/`](./docs/) directory for:

- [Architecture](./docs/architecture.md)
- [Development Guide](./docs/development.md)
- [Security](./docs/security.md)
- [Recording](./docs/recording.md)
- [Google Meet Integration](./docs/google-meet-integration.md)
- [Deployment](./docs/deployment.md)

---

## Design Principles

- **No AI** — all analytics are deterministic, rule-based, and explainable
- **Privacy-first** — recordings stay on the user's device
- **Local-first** — interactions are aggregated locally before syncing
- **Low-cost** — designed for MongoDB Atlas M0 free tier
- **Modular** — Google Meet adapter is isolated; future platforms can be added
