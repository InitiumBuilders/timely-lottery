# 🛠 Development Guide — Timely.Works

## Prerequisites
- Node.js 18+ (production uses v22)
- npm 9+
- Git

## Local Setup

```bash
# Clone / navigate to project
cd timely-lottery

# Install all dependencies
npm install

# Generate Prisma client (MUST do before first run)
npx prisma generate

# Create and migrate the SQLite database
DATABASE_URL="file:./dev-data/timely.db" npx prisma migrate deploy

# Copy env template
cp .env.example .env.local
# Edit .env.local with your values (see Environment Variables below)

# Start dev server
npm run dev
# → http://localhost:3000
```

## Environment Variables

Create `.env.local` for local development:

```bash
# Database (SQLite for local dev)
DATABASE_URL="file:./dev-data/timely.db"

# Where lottery/entry data is stored (JSON + uploads)
LOTTERY_DATA_DIR="./dev-data"

# DASH wallet mnemonic — use a TESTNET wallet for local dev!
DASH_MNEMONIC="your twelve word mnemonic phrase here for dev"

# Admin panel password
ADMIN_PASSWORD="localdev"

# Email (optional for local dev — verification URLs logged to console if not set)
RESEND_API_KEY=""
FROM_EMAIL="Timely.Works <noreply@unitium.one>"

# App URL
NEXT_PUBLIC_SITE_URL="http://localhost:3000"

# VPS_URL is only needed when running ON Vercel
# VERCEL=1 is set automatically by Vercel
```

**⚠️ NEVER use the production mnemonic locally.** Generate a fresh dev wallet:
```bash
node -e "
const { mnemonicToSeedSync } = require('bip39');
const Mnemonic = require('@dashevo/dashcore-lib').crypto.BN;
// Or just use: npx ts-node scripts/gen-wallet.ts
"
```

## Project Scripts

```bash
npm run dev          # Start dev server with hot reload
npm run build        # Production build
npm run start        # Start production server (after build)

npx prisma studio    # Visual DB editor (great for debugging)
npx prisma migrate dev --name "my_change"  # Create migration after schema edit
npx prisma generate  # Regenerate client after schema edit
```

## Adding a New Feature

### 1. New API endpoint
Create `app/api/your-feature/route.ts`:
```ts
export const dynamic = 'force-dynamic';  // ← required for all API routes
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  // Always handle errors
  try {
    return NextResponse.json({ ok: true, data: 'hello' });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
```

### 2. New page
Create `app/your-page/page.tsx`:
```tsx
'use client';
import { useState, useEffect } from 'react';

export default function YourPage() {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    fetch('/api/your-feature')
      .then(r => r.json())
      .then(d => setData(d));
  }, []);
  
  return <div>{/* UI */}</div>;
}
```

### 3. New Prisma model
Edit `prisma/schema.prisma`, add your model, then:
```bash
DATABASE_URL="file:./dev-data/timely.db" npx prisma migrate dev --name "add_your_model"
```

### 4. New store.json field
Add the field to the interface in `lib/store.ts` and ensure it's included in read/write functions. **No migration needed** — JSON store is schema-less.

## Deployment

### VPS Deploy
```bash
cd /root/.openclaw/workspace/timely-lottery

# Build
npm run build

# Restart app (PM2 will pick up new build from .next/)
pm2 restart timely-lottery

# Restart worker if worker files changed
pm2 restart timely-worker
```

### Vercel Deploy
```bash
cd /root/.openclaw/workspace/timely-lottery
npx vercel --prod --yes
```

Vercel deploys the Next.js frontend. The `/api/*` routes on Vercel are **proxied to VPS** via `middleware.ts` — they don't run on Vercel (except for the middleware itself). This means:
- Page components → Vercel
- API handlers → VPS
- Session cookies → must flow through proxy (see `middleware.ts`)

### PM2 Process Management
```bash
pm2 status                          # Check both processes
pm2 logs timely-lottery --lines 50  # Recent app logs
pm2 logs timely-worker --lines 50   # Recent worker logs
pm2 restart timely-lottery          # Restart after code changes
pm2 restart timely-worker           # Restart worker
pm2 monit                           # Live CPU/memory dashboard
```

## Common Issues & Fixes

### "Prisma Client not found" on Vercel build
Cause: Prisma client not generated before build.  
Fix: `package.json` should have `"postinstall": "prisma generate"`.

### "Cannot find module 'prisma/config'"
Cause: `prisma.config.ts` file from Prisma 7 (breaking change).  
Fix: Delete `prisma.config.ts`. Prisma 5 (our version) doesn't use it.

### `/api/auth/me` returns 401 even after login (on Vercel)
Cause: `middleware.ts` not forwarding `Cookie` header to VPS.  
Fix: Ensure this line is in the `fetch()` call in `middleware.ts`:
```ts
'cookie': request.headers.get('cookie') || '',
```

### Login redirects back to auth page immediately
Cause: `Set-Cookie` not forwarded from VPS response.  
Fix: Ensure this is in `middleware.ts` response handling:
```ts
const setCookie = upstream.headers.get('set-cookie');
if (setCookie) res.headers.set('set-cookie', setCookie);
```

### "0.3 DASH shows as 2 tickets instead of 3"
Cause: Floating point: `Math.floor(0.3 / 0.1) = 2`.  
Fix: Use `ticketsForDash()` from `lib/ticket-utils.ts`:
```ts
import { ticketsForDash } from '@/lib/ticket-utils';
const tickets = ticketsForDash(0.3); // = 3 ✓
```

### Insight API returns 404 for `/addr/{address}/txs`
Cause: That endpoint doesn't work on Dash Insight.  
Fix: Use `/addr/{address}` to get txids array, then `/tx/{txid}` for each. See `lib/dash.ts`.

### Build fails: "useSearchParams must be wrapped in Suspense"
Cause: Next.js 14 requires `useSearchParams()` to be inside a `<Suspense>` boundary.  
Fix: Wrap the component that uses `useSearchParams` in `<Suspense>`. See `app/auth/page.tsx` for reference.

## Code Style Guide

- **All API routes:** start with `export const dynamic = 'force-dynamic';`
- **Ticket math:** always use `ticketsForDash()`, never `Math.floor(x / 0.1)`
- **Error handling:** every API route must have try/catch returning `{ error: string }`
- **Auth in API routes:** check cookie → `getSessionUser(token)` → 401 if null
- **Store updates:** use `upsertEntry()` / `upsertLottery()` — never write to `store.ts` data directly
- **React polling:** use `useRef` guards (`loadingRef`, `lastScanRef`) to prevent overlapping fetches

## Glossary

| Term | Meaning |
|------|---------|
| Initium | A vision/idea submitted to the lottery |
| Votus | Credits earned from DASH, spent to boost ideas |
| Entry | One participant's record in a lottery |
| entryAddress | The unique private DASH address for one entry's deposits |
| lotteryAddress | The main pool address for anonymous direct sends |
| baseTickets | Tickets from DASH (1 per 0.1 DASH) |
| upvoteTickets | Tickets from Votus boosts received |
| totalTickets | baseTickets + upvoteTickets |
| store.json | The file-based persistence layer for lottery/entry data |
