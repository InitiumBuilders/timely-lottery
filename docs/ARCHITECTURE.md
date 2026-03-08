# Timely.Works — Architecture

> Last updated: 2026-02-24  
> Status: Production

---

## System Overview

```
Browser / Mobile
      │
      ▼
  Vercel Edge (CDN + middleware proxy)
      │  [proxies API + auth cookies to VPS]
      ▼
  VPS — Next.js App (PM2: timely-lottery)
      │
      ├── /app/api/*         Next.js API routes
      ├── lib/store.ts        JSON flat-file store
      ├── lib/dash.ts         DASH blockchain layer
      ├── prisma/             SQLite (users, sessions, initiums)
      │
  PM2: timely-worker (worker.mjs)
      │
      ├── scan loop (5s)     → /api/lottery/scan
      ├── end loop (60s)     → /api/lottery/end
      └── repayout loop (60s) → /api/lottery/repayout
```

---

## Data Flow: Ticket Purchase

```
1. User opens /lottery
2. Calls GET /api/entry → creates Entry in store.json
   - Derives unique deposit address (HD path m/44'/5'/2'/0/{n})
   - Returns: entryAddress, QR code data
3. User sends 0.1 DASH to entryAddress
4. Worker (5s scan) detects TX via Insight API
5. /api/lottery/scan runs immediatelySplit():
   - 10% → Reserve address (m/44'/5'/5'/0/0)
   - 5%  → Next lottery fund address (m/44'/5'/6'/0/{n})
   - ~85% stays in entryAddress (winner prize)
6. Entry updated: dashContributed++, baseTickets++, splitTxIds[]
7. UI polls /api/entry/status → shows confirmed tickets
```

---

## Data Flow: Lottery End + Payout

```
1. Worker detects lottery.endTime < now
2. Calls POST /api/lottery/end { forcePayout: true }
3. pickWeightedWinner() selects winner by ticket weight
4. Winner address resolved (priority):
   a. entry.dashReceiveAddress (set from TX sender on first scan)
   b. entry.dashAddress
   c. Fallback: getTxSenderAddress(verifiedTxId) → Insight API
5. Payout strategy selected:
   - HAS splitTxIds → directSweepAllToWinner() [fees already taken]
   - NO splitTxIds  → splitPayout() [85/10/5 split at end]
6. Payout TX broadcast → lottery.winnerTxId set
7. Winner recorded in store.json winners[]
8. Worker stops retrying (winnerTxId set)
```

---

## Data Flow: Stuck Payout Recovery

```
Every 60s: worker checks for lotteries where:
  status === 'ended' && winnerId && !winnerTxId

If found: POST /api/lottery/repayout
  → Same address resolution + payout strategy
  → Retries until success or no UTXOs
```

---

## Dual Data Store

### 1. store.json (flat JSON)
**Path:** `$LOTTERY_DATA_DIR/store.json`  
**Used for:** Lotteries, entries, winners, splits, word submissions, allocations

**Pros:** Zero dependencies, instant reads, works great at current scale  
**Limit:** ~500 concurrent lotteries, ~5000 entries before read/write becomes slow  
**Scale path:** See [SCALING.md](./SCALING.md)

Key collections:
```
lotteries{}       → all lottery rounds
entries{}         → all participant entries  
winners[]         → hall of winners
splitHistory[]    → immediate on-deposit splits (capped at 500)
allocationHistory[] → end-of-lottery fund allocations
wordSubmissions[] → community one-word drops (capped at 5000)
```

### 2. SQLite via Prisma
**Path:** `$LOTTERY_DATA_DIR/timely.db`  
**Used for:** User accounts, sessions, initiums, profile data

**Tables:** `User`, `Session`, `Initium`, `InitiumVote`

---

## HD Wallet Derivation

All addresses from single `WALLET_MNEMONIC`:

```
m / 44' / 5' / purpose' / 0 / index

Purpose indices:
  1' = Lottery main addresses
  2' = Entry deposit addresses  
  3' = (reserved)
  4' = (reserved)
  5' = The Timely Reserve (fixed: index 0)
  6' = Next Lottery Fund (increments per lottery)
```

**Security:** Private keys never stored — always re-derived on demand from mnemonic.

---

## Immediate Split Design

The 10/5/85 split happens **the moment a deposit confirms** (≥1 confirmation):

```typescript
// lib/dash.ts
immediatelySplit(
  entryAddress,     // from → entry deposit addr
  reserveAddress,   // 10% to The Timely Reserve
  nextLotteryAddr,  // 5% to next lottery fund
  winnerChangeAddr  // ~85% back to entry addr (for winner)
)
```

**Why immediate?** Trust. Users see their contribution split happen on-chain in real-time. No end-of-lottery custody risk.

**Edge case handling:** `splitTxIds` tracks which TXs have been split — prevents double-counting the change output as a new deposit.

---

## Payout Strategies

### Strategy A: `directSweepAllToWinner()` (default)
Used when `entry.splitTxIds.length > 0` (immediate split ran on deposit)

- Collects all UTXOs from all entry deposit addresses + lottery main address
- Sweeps 100% of remaining funds to winner in one TX
- No further fee deduction — 15% was already taken on deposit

### Strategy B: `splitPayout()` (legacy fallback)
Used when no immediate splits ran (e.g. admin ended lottery before first scan)

- Collects all UTXOs
- Splits: 85% → winner, 10% → reserve, 5% → next lottery

---

## Votus / Ticket System

```
0.1 DASH = 1 Ticket + 1 Votus Credit

Ticket types:
  baseTickets    = floor(dashContributed / 0.1)
  upvoteTickets  = Votus votes received from other founders
  totalTickets   = baseTickets + upvoteTickets

Winner selection:
  Weighted random — probability = entry.totalTickets / sum(all totalTickets)
```

**Float safety:** `lib/ticket-utils.ts → ticketsForDash()` uses integer arithmetic to avoid `Math.floor(0.3/0.1) = 2` JavaScript trap.

---

## Admin Security

The admin panel (`/admin`) is protected by:
1. **Server-side:** API routes check `ADMIN_PASSWORD` env var for all mutations
2. **Client-side:** Nav link only rendered for accounts matching admin email/username
3. **Middleware:** Vercel proxy forwards cookies — all auth checks run on VPS

Admin accounts (hardcoded in `layout.tsx`):
- Email: `InitiumBuilders@gmail.com`
- Username: `August` / `semberdotsol`

---

## Worker Architecture

`scripts/worker.mjs` is a standalone Node.js process (not Next.js) that:
- Calls localhost:3000 API endpoints
- Runs PM2 process ID 1 (`timely-worker`)
- Logs to `$LOTTERY_DATA_DIR/worker.log`

**Timings:**
- Scan: every 5 seconds
- End check: every 60 seconds  
- Repayout check: every 60 seconds
- USDC guard alert: once per day (if applicable)

---

## Vercel / VPS Proxy

Vercel serves the CDN/edge layer. `middleware.ts` proxies all requests to the VPS:

```
User → Vercel Edge → VPS:3000
```

**Critical:** `middleware.ts` MUST forward `Cookie` header (request) and `set-cookie` header (response). Without this, all auth breaks silently. See [SECURITY.md](./SECURITY.md).

---

## One Word Feature

Community pulse feature — each signed-in user submits one word per lottery cycle.

```
POST /api/words { word: "hope", target: "current"|"next" }
  → Validates: single word, alphanumeric, max 32 chars
  → Enforces: 1 word per user per target per lottery
  → Updates in-place if re-submitted
  
GET /api/words?target=current|next|all
  → Returns: wordEntries[], frequencyRanking[]
```

Displayed as word cloud on `/contribute`, frequency table in admin panel.

---

## Environment Variables

```bash
# Required
WALLET_MNEMONIC="word1 word2 ... word12"    # HD wallet seed
ADMIN_PASSWORD="your-secure-password"        # Admin panel auth
DATABASE_URL="file:/path/to/timely.db"       # Prisma SQLite
LOTTERY_DATA_DIR="/path/to/data"             # store.json directory
NEXT_PUBLIC_BASE_URL="https://timely.works"  # Public URL

# Optional
PORT=3000                                    # Server port (default 3000)
```

---

## Key Files Reference

| File | Purpose |
|---|---|
| `lib/dash.ts` | All DASH blockchain ops: address derivation, TX building, broadcast |
| `lib/store.ts` | Read/write store.json, all store interfaces |
| `lib/lottery.ts` | Weighted winner selection algorithm |
| `lib/auth.ts` | Password hashing, session tokens, cookie config |
| `lib/ticket-utils.ts` | Float-safe DASH→ticket conversion |
| `app/api/lottery/scan/route.ts` | Core deposit detection + immediate split |
| `app/api/lottery/end/route.ts` | Lottery end + winner payout |
| `app/api/lottery/repayout/route.ts` | Stuck payout retry with TX sender fallback |
| `scripts/worker.mjs` | Background scan/end/repayout loops |
| `middleware.ts` | Vercel→VPS cookie-aware proxy |
| `docs/PAYOUT-SYSTEM.md` | Full payout documentation |
