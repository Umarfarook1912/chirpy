# CHIRPY — Deployment

## Overview

CHIRPY is designed for minimal operating cost:

| Component | Recommended hosting | Cost |
|---|---|---|
| Backend API | Railway / Render / Fly.io (free tier) | Free–$5/mo |
| Frontend | Vercel / Netlify (free tier) | Free |
| Database | MongoDB Atlas M0 | Free |
| Extension | Chrome Web Store | $5 one-time developer fee |

---

## Backend Deployment (Railway / Render)

1. Set environment variables from `apps/backend/.env.example`
2. Set `NODE_ENV=production`
3. Build: `pnpm --filter @chirpy/backend build`
4. Start: `node dist/server.js`

Required environment variables:

```
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb+srv://...
JWT_SECRET=<strong-random-secret>
REFRESH_SECRET=<strong-random-secret>
ALLOWED_ORIGINS=https://your-frontend-domain.com
```

---

## Frontend Deployment (Vercel)

1. Connect the GitHub repository
2. Set root directory to `apps/web`
3. Build command: `pnpm build`
4. Output: `dist/`
5. Set `VITE_API_URL` to your backend URL

---

## Extension Deployment (Chrome Web Store)

1. Build: `pnpm --filter @chirpy/extension build`
2. Zip: `apps/extension/dist/`
3. Upload to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
4. Complete store listing and privacy policy

---

## MongoDB Atlas Setup

1. Create a free M0 cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a database user
3. Add IP allowlist (or allow all for initial setup)
4. Copy the connection string to `MONGODB_URI`

---

## Security Checklist Before Deployment

- [ ] All environment variables set (no defaults in production)
- [ ] `JWT_SECRET` and `REFRESH_SECRET` are strong random strings (32+ chars)
- [ ] `ALLOWED_ORIGINS` is restricted to actual frontend domain
- [ ] MongoDB Atlas IP allowlist configured
- [ ] `NODE_ENV=production`
- [ ] HTTPS enforced (handled by hosting platform)
