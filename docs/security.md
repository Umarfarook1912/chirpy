# CHIRPY — Security

## Authentication

- Passwords are hashed with **Argon2** (argon2id variant)
- JWTs are stored in **httpOnly, Secure, SameSite=Strict cookies** — not localStorage
- Access tokens have short expiry (15 minutes)
- Refresh tokens have longer expiry (7 days) and are rotated on use
- Token revocation is tracked server-side (refresh token blocklist in MongoDB)

## Authorization

- Every protected endpoint passes through the `authenticate` middleware
- Role-based access uses the `authorize` middleware with `ROLES` constants
- Never trust `userId` or `orgId` from request body — always use the authenticated token payload

## Input Validation

- All request bodies, query params, and route params are validated with Zod schemas
- Validation middleware runs before controllers — controllers never receive unvalidated input
- Extension sync payloads are validated with the same shared Zod schemas

## API Security

- `helmet` sets secure HTTP headers on all responses
- `express-rate-limit` limits auth endpoints to prevent brute force
- CORS is restricted to allowed origins via environment configuration
- All error responses use the standard envelope — stack traces are never exposed

## Extension Security

- Extension popup never stores sensitive auth tokens — uses chrome.storage.session
- IndexedDB stores only interaction data (counts, durations) — no PII beyond display names
- Meeting recordings stay on the user's device — no backend upload in MVP

## Secrets

- All secrets are in environment variables (never in source code)
- Only `.env.example` is committed
- JWT_SECRET, MONGODB_URI, and REFRESH_SECRET must be set before running

## Passwords

Never store plaintext passwords. Never implement custom hashing. Use:

```ts
import argon2 from 'argon2';
const hash = await argon2.hash(password);
const valid = await argon2.verify(hash, password);
```

## Recording Privacy

- `getDisplayMedia` requires explicit user gesture — never called automatically
- Recording state is always visible in the extension popup
- Users can delete the recording before downloading
- No silent capture of microphone, camera, or tab audio
