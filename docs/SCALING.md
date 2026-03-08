# 📈 Scaling Guide — Timely.Works

## Current Capacity

The current architecture is built for **fast iteration and low cost**, not maximum scale.  
Here's an honest assessment of where limits are:

| Component | Current Setup | Practical Limit |
|-----------|---------------|-----------------|
| Next.js app | Single VPS process (PM2) | ~500 concurrent users |
| store.json | Single JSON file, sync read/write | ~50 concurrent writes safely |
| SQLite | Single file on VPS | ~1000 concurrent reads |
| Blockchain scan | Insight API (external) | ~10 req/s before rate-limit |
| File uploads | VPS disk, no CDN | Limited by VPS disk + bandwidth |
| Vercel frontend | CDN, unlimited | Effectively unlimited |

---

## Phase 1: Current (0–500 users)
*No changes needed. Works as-is.*

- Single VPS, PM2 app + worker
- store.json for lottery data
- SQLite for user accounts
- Vercel CDN for pages

**Bottleneck to watch:** Blockchain scanning — Insight API may rate-limit if many entries all need scanning simultaneously. Current mitigation: 15s scan interval, deduped by verified TX IDs.

---

## Phase 2: Growth (500–5,000 users)

### Replace JSON Store with SQLite
The biggest risk at scale is concurrent writes to `store.json`. Replace it with SQLite (same file, but with proper transactions):

```ts
// Current: synchronous read-modify-write (race condition risk)
const data = loadStore();
data.entries[id] = entry;
saveStore(data);

// Target: SQLite with WAL mode (concurrent-safe)
await db.run('INSERT OR REPLACE INTO entries VALUES (?)', [JSON.stringify(entry)]);
```

**Migration path:**
1. Add `entries`, `lotteries`, `winners` tables to `prisma/schema.prisma`
2. Write migration script to import `store.json` into SQLite
3. Update `lib/store.ts` to use Prisma instead of file I/O
4. Keep `store.json` as backup for one lottery cycle

### Add Upload CDN
Move uploads from VPS disk to object storage:
- **Option A:** Cloudflare R2 (free tier, S3-compatible)
- **Option B:** AWS S3 + CloudFront
- Change `lib/upload.ts` to use `@aws-sdk/client-s3` or Cloudflare Workers

### Rate Limiting
Add rate limits to prevent abuse:
```ts
// Recommended: @upstash/ratelimit + Redis
// Free tier on Upstash (10k requests/day)
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1m"), // 10 req/min per IP
});
```

Apply to: `/api/auth/login`, `/api/auth/register`, `/api/entry/submit`, `/api/upload`

---

## Phase 3: Scale (5,000–50,000+ users)

### PostgreSQL Migration
SQLite doesn't support multiple concurrent writers across processes. Move to PostgreSQL:

```
# Current
DATABASE_URL="file:/data/timely.db"

# Scaled
DATABASE_URL="postgresql://user:pass@host:5432/timely"
```

Prisma supports this with zero schema changes — just update the provider:
```prisma
datasource db {
  provider = "postgresql"  // was "sqlite"
  url      = env("DATABASE_URL")
}
```

Good managed options:
- **Supabase** (free tier generous)
- **Railway** (simple, affordable)
- **Neon** (serverless PostgreSQL, great for Vercel deployments)

### Multiple VPS / Load Balancer
If running multiple VPS instances, the main challenge is shared state:
- `store.json` must move to PostgreSQL (see above)
- PM2 `cluster` mode for multi-core on single VPS
- Nginx load balancer across multiple VPS nodes

### Blockchain Scanning at Scale
Current: one worker scans all entry addresses sequentially every 15s.  
At 1,000+ entries, this becomes slow. Solutions:

**Option A — Webhooks (Preferred)**
Use Dash blockchain webhooks (when available) to push TX notifications instead of polling.

**Option B — Queue-Based Scanning**
Use a job queue (Bull/BullMQ with Redis):
- Each new entry address gets added to scan queue
- Workers consume queue, scan addresses in parallel
- Deduplicate via Redis set of confirmed TXIDs

**Option C — Batch Insight API**
```ts
// Instead of one request per address, batch using Promise.allSettled
const results = await Promise.allSettled(
  addresses.map(addr => getContributions(addr))
);
```
This is already partially done — extend with retry logic and exponential backoff.

---

## Session & Cookie Scaling

Current sessions are stored in SQLite. Under high load:
- Session validation on every authenticated request hits the DB
- Add Redis caching for session lookups:

```ts
// Pseudocode: cache session token → userId for 5 minutes
const cached = await redis.get(`session:${token}`);
if (cached) return JSON.parse(cached);
const session = await prisma.userSession.findUnique({ where: { token } });
if (session) await redis.setex(`session:${token}`, 300, JSON.stringify(session.user));
return session?.user;
```

---

## Cost Estimates

| Scale | Users | Est. Monthly Cost |
|-------|-------|-------------------|
| Current | 0–500 | ~$15/mo (VPS) + $0 Vercel free |
| Growth | 500–5k | ~$30/mo VPS + $0–20 Vercel + $0 Redis free tier |
| Scaled | 5k–50k | ~$50–150/mo (Postgres + Redis + CDN) |
| Enterprise | 50k+ | Custom pricing, dedicated infra |

---

## Deployment Checklist for Scale

- [ ] Replace store.json writes with SQLite transactions (WAL mode)
- [ ] Add `PRAGMA journal_mode=WAL` to SQLite connection
- [ ] Add rate limiting (Upstash Redis)
- [ ] Move uploads to R2/S3
- [ ] Add `Cache-Control` headers to upload serving endpoint
- [ ] Enable PM2 cluster mode: `pm2 start app.js -i max`
- [ ] Add health check endpoint (`/api/health`) for load balancer
- [ ] Set up proper logging (PM2 logs → centralized e.g. Logtail/Datadog)
- [ ] Database backups (daily SQLite dumps + offsite storage)
- [ ] Monitor Insight API rate limits — consider self-hosted Dash Insight node

---

## Self-Hosting a Dash Insight Node

For true independence at scale, run your own Dash Core + Insight:

```bash
# Dash Core (full node)
dashd -server -rpcuser=user -rpcpassword=pass -txindex=1

# Insight API (connects to dashd)
git clone https://github.com/dashpay/insight-api
npm install && npm start
```

Change `INSIGHT_BASE` in `app/api/lottery/scan/route.ts` from `https://insight.dash.org/insight-api` to your local node.

**VPS requirements for full node:** 4 CPU, 8GB RAM, ~100GB SSD
