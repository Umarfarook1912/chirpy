# CHIRPY — Development Guide

## Setup

```bash
# Install Node.js >= 20 and pnpm >= 9
npm install -g pnpm

# Clone and install
git clone https://github.com/Umarfarook1912/chirpy.git
cd chirpy
pnpm install

# Set up environment variables
cp apps/backend/.env.example apps/backend/.env
cp apps/web/.env.example apps/web/.env
# Edit both .env files with your values
```

## Running in Development

```bash
# All apps (parallel)
pnpm dev

# Individual apps
pnpm --filter @chirpy/backend dev
pnpm --filter @chirpy/web dev
pnpm --filter @chirpy/extension dev
```

## Building

```bash
pnpm build
```

## Linting

```bash
pnpm lint
```

## Type Checking

```bash
pnpm typecheck
```

## Testing

```bash
pnpm test
```

## Installing the Extension

1. Run `pnpm --filter @chirpy/extension build`
2. Open Chrome → `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked** → select `apps/extension/dist/`

## Code Conventions

- Files: PascalCase for components/classes, camelCase for utils/hooks/services
- Max 200 lines per file — extract if approaching limit
- No `any` — use `unknown` and type narrowing
- All constants in `constants/` files, never hardcoded inline
- All colors via `COLORS` constant or CSS custom properties
- Business logic in services/utils, not in React components
- Zod schemas in `packages/shared/src/schemas/` for shared validation

## Commit Messages

Follow Conventional Commits:

```
feat: add meeting recording controls
fix: prevent duplicate session sync
refactor: extract participation scoring service
test: add scoring utils unit tests
docs: update google meet integration guide
```
