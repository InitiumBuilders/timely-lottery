# 🔒 Security — Timely.Works

## Current Security Model

### Authentication
- **Sessions:** httpOnly cookies (`timely_session`), 30-day expiry, SameSite=lax, Secure in production
- **Passwords:** bcrypt (cost factor 12) — never stored in plaintext
- **Session tokens:** `nanoid(48)` — 72 bits of entropy, cryptographically random
- **Session storage:** Prisma `UserSession` table — token + userId + expiry
- **Email verification:** Required before full access; token via `nanoid(32)`

### Admin Panel
- Password-protected (`ADMIN_PASSWORD` env var)
- **⚠️ Known gap:** Admin password is compared in plaintext (no rate limiting). Before scaling, replace with hashed comparison + lockout after N failures.

### File Uploads
- Max size: 50MB
- Allowed MIME types: images + common video formats
- Served from `/api/uploads/[filename]` via VPS — no CDN caching
- **⚠️ Known gap:** No file type validation on server side (only content-type from client). A bad actor can upload arbitrary files with a spoofed content-type. Mitigation: add `file-type` package to validate magic bytes server-side.

### Wallet / Mnemonic Security
- `DASH_MNEMONIC` is only on VPS, **never** in Vercel environment variables
- Payout routes (`/api/lottery/payout`) only run on VPS (won't run on Vercel by design)
- Mnemonic stored in `/timely-lottery/.env` (chmod 600)
- **⚠️ Important:** The `.env` file is in the project directory. Ensure `.gitignore` includes `.env` — do NOT commit it.

### API Security

| Endpoint category | Auth required | Notes |
|-------------------|---------------|-------|
| `/api/auth/*` | No (public) | Register, login, verify — these set/clear cookies |
| `/api/profile` | Yes (session cookie) | Read/write user profile |
| `/api/account/stats` | Yes | Read user's stats |
| `/api/initium/*` | Yes (for mutations) | Create/edit/delete own initiums |
| `/api/entry/my` | No (returns null if unauthed) | Graceful — returns null |
| `/api/entry/submit` | No | Anyone can submit an entry (anonymous OK) |
| `/api/entry/upvote` | No (uses voterEntryId) | Validated against store, not session |
| `/api/lottery/*` | No (reads) | Pool, scan, current — public reads |
| `/api/lottery/create` | Admin password | Checked inline |
| `/api/lottery/end` | Admin password | Checked inline |
| `/api/lottery/payout` | Admin password | Checked inline |
| `/api/upload` | No | Open upload — see gap above |

### Vercel Proxy (middleware.ts)
The middleware forwards `Cookie` header to VPS and `Set-Cookie` back to browser. This is necessary for auth to work across the CDN/VPS split.

**What it protects:**
- VPS IP is never exposed to the browser (all traffic via Vercel edge)
- `sslip.io` DNS trick keeps the VPS reachable by hostname from Vercel edge

**What it does NOT protect:**
- The middleware currently forwards ALL `/api/*` regardless of origin — no CSRF protection
- No rate limiting on any endpoint (Vercel's built-in DDoS protection only)

---

## Hardening Checklist (Before Major Launch)

### High Priority
- [ ] **Rate limiting on auth endpoints** — prevent brute force on login/register  
  Recommendation: `@upstash/ratelimit` with Redis, or simple in-memory LRU cache
- [ ] **Admin password rate limiting** — add lockout after 5 failed attempts
- [ ] **File type validation** — validate magic bytes on upload, not just content-type
- [ ] **Input sanitization on initium title/description** — prevent XSS in public pages
- [ ] **CSRF protection** — add `X-Requested-With` or `Origin` check in middleware for mutations

### Medium Priority
- [ ] **Upload size quota per user** — prevent storage abuse (currently unlimited)
- [ ] **Email enumeration protection** — register/login should return same response for "user not found" vs "wrong password"
- [ ] **Session invalidation on password change** — currently old sessions stay valid
- [ ] **Admin panel HTTPS check** — warn if accessed over HTTP
- [ ] **Rotate DASH_MNEMONIC path** — currently at `m/44'/5'/2'/0/{n}`; document clearly, add comment in derive fn

### Low Priority (But Good Practice)
- [ ] **Content-Security-Policy header** — restrict script sources
- [ ] **Subresource Integrity** — for any externally loaded scripts
- [ ] **Audit log for admin actions** — write who created/ended each lottery
- [ ] **Move store.json to append-only log** — prevents data loss from concurrent writes

---

## Sensitive Data Inventory

| Data | Location | Encryption | Access |
|------|----------|------------|--------|
| User passwords | SQLite (passwordHash) | bcrypt-12 | Auth routes only |
| Session tokens | SQLite + httpOnly cookie | None (random 48-char) | Auth routes only |
| DASH mnemonic | VPS `.env` file | None (file system only) | VPS process only |
| Upload files | VPS `/timely-lottery-data/uploads/` | None | Anyone with URL |
| Email addresses | SQLite | None (plaintext) | Auth routes + admin |
| Store data | VPS `store.json` | None | VPS process + admin |

**Bottom line on the mnemonic:** The private key to all entry deposit addresses and the payout wallet lives in a single mnemonic on the VPS. If the VPS is compromised, all DASH is at risk. Mitigation options:
1. Hardware wallet for payout address (manually approve payouts)
2. Multisig payout requiring two keys
3. Reduce VPS wallet balance between lotteries (send winnings manually, keep minimum)

---

## Known Vulnerability: Concurrent Store Writes

`store.ts` uses synchronous `fs.readFileSync` / `fs.writeFileSync`. Under high concurrent load:
- Two requests could read the same state simultaneously
- Both write back — one write wins, the other is lost (last-write-wins race)

**Impact:** Could cause ticket count inconsistencies under high concurrency  
**Mitigation (current):** PM2 runs single-process — Node.js event loop serializes most ops  
**Mitigation (scaling):** Replace JSON store with SQLite or PostgreSQL (see `docs/SCALING.md`)

---

## Reporting a Security Issue

Contact: initiumbuilders@gmail.com  
Or DM @semberdotsol on X/Telegram
