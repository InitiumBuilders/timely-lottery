# ⏱ Timely.Works

```
╔════════════════════════════════════════════════╗
║       T I M E L Y . W O R K S                 ║
║  The Autonomous DASH Community Lottery         ║
║  Built on Dash Evolution · V1.02              ║
╚════════════════════════════════════════════════╝
```

**Live:** [timely.works](https://timely.works) · **GitHub:** [InitiumBuilders/timely-lottery](https://github.com/InitiumBuilders/timely-lottery)

> *The first fully autonomous lottery built on Dash Evolution. AI names each round. 85% goes to the winner. The chain doesn't lie.*

---

## Built on Dash Platform 🔵

Timely.Works doesn't just *use* Dash for payments. It publishes lottery data — results, entries, outcomes — to **Dash Drive**, a decentralized data layer built into the Dash blockchain.

Every lottery is a document on-chain. Signed. Permanent. Verifiable by anyone, without trusting Timely.Works.

```
GET /api/platform/verify?lotteryId=YOUR_LOTTERY_ID
→ { "onChain": true, "docs": { "lottery": {...}, "result": {...}, "entries": [...] } }
```

- **Data Contract** defines the schema (`platform/contracts/lottery-contract.json`)
- **Dual-write** — SQLite for speed, Dash Drive for truth
- **Graceful degradation** — app works without `TIMELY_CONTRACT_ID` set
- **No PII on-chain** — only public DPNS names, ticket counts, initium titles

→ [Full Platform Integration Guide](./docs/DASH-PLATFORM-INTEGRATION.md)

---

## Your Initium, On-Chain 🌐

When you register an Initium on Timely.Works, it doesn't just live in our database — it's published to **Dash Drive** the moment you create it. Your idea gets a permanent address on the Dash blockchain. No server can delete it. No company can lose it.

### What's stored on-chain

Every Initium document contains:
```json
{
  "initiumId":       "uuid",
  "slug":            "your-initium-slug",
  "title":           "Your Initium Title",
  "description":     "What it's about (up to 5000 chars)",
  "url":             "https://your-site.com",
  "ownerDpns":       "august.dash",
  "timesUsed":       0,
  "totalDashEarned": 0,
  "createdAt":       1709900000
}
```

### Query from anywhere — no server needed

```bash
# All Initiums (latest 20)
GET https://timely.works/api/platform/initiums

# Single Initium by slug
GET https://timely.works/api/platform/initiums?slug=my-initium

# Response
{
  "onChain": true,
  "contractId": "YOUR_CONTRACT_ID",
  "initiums": [...],
  "count": 42
}
```

Or query Dash Drive directly with the SDK:
```javascript
const docs = await client.platform.documents.get('timelyLottery.initium', {
  orderBy: [{ createdAt: 'desc' }],
  limit: 20,
});
```

### Data Contract Schema

The full schema lives at [`platform/contracts/lottery-contract.json`](./platform/contracts/lottery-contract.json).
It includes 5 document types: `lottery`, `result`, `entry`, `word`, and `initium`.

→ Register on testnet: `node platform/contracts/register-testnet.mjs`
→ Register on mainnet: `node platform/contracts/register.mjs`

---

## What Is This?

Timely.Works is a **DASH-powered community lottery** where:

- 🎟 **Anyone** can buy tickets by sending $DASH
- 💡 **Anyone** can submit an Initium (an idea worth funding)
- 🤖 **AI auto-starts** each new lottery with a poetic, culture-connected name
- 🏆 **One winner** takes 85% — transparent, on-chain, verifiable
- 🏦 **10%** goes to the Reserve fund · **5%** seeds the next lottery
- 🔑 **Login with your `.dash` username** via Dash Platform (DPNS)

No middlemen. No admin required. The platform runs itself.

---

## Built on Dash Evolution

| Technology | Purpose |
|---|---|
| **DPNS** | Username login — `august.dash` signs in without a password |
| **DAPI** | Decentralized API — no centralized RPC node needed |
| **dashcore-lib** | HD wallet derivation — unique address per lottery |
| **Data Contracts** | On-chain lottery + result storage (Phase 2 roadmap) |
| **Dash Core** | Fast payments — every split broadcast on-chain |

→ [Full Dash Evolution Integration Guide](./DASH-EVOLUTION.md)

---

## Stack

```
Next.js 14    — Frontend + API routes
Tailwind CSS  — Styling
SQLite        — User accounts (via Prisma)
store.json    — Lottery state (JSON flat file — fast, simple)
PM2           — Process management (app + worker)
Dash SDK      — DPNS resolution, DAPI connection
dashcore-lib  — HD wallet, address derivation, transaction signing
OpenAI        — AI lottery name generation
Vercel        — Edge middleware + CDN (proxies to VPS)
```

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/InitiumBuilders/timely-lottery
cd timely-lottery

# 2. Configure
cp .env.example .env.local
# Edit .env.local — add your DASH mnemonic, admin password, etc.

# 3. Install
npm install

# 4. Database setup
npx prisma migrate deploy

# 5. Run
npm run dev        # development
npm run build      # production build
npm start          # production server
```

Full deployment guide: [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```env
# REQUIRED
DASH_MNEMONIC=your twelve word mnemonic phrase here
ADMIN_PASSWORD=your-secret-admin-password
DATABASE_URL=file:../timely-lottery-data/timely.db

# RECOMMENDED
OPENAI_API_KEY=sk-...        # AI lottery name generation
RESEND_API_KEY=re_...        # Email notifications
TG_BOT_TOKEN=...             # Telegram notifications
TG_CHAT_ID=...
TG_TOPIC_ID=...

# AUTO-CONFIGURED
WORKER_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=https://timely.works
```

**Never commit `.env.local`** — it's gitignored. See [SECURITY.md](./SECURITY.md).

---

## Project Structure

```
timely-lottery/
├── app/                    # Next.js pages + API routes
│   ├── api/
│   │   ├── admin/          # Admin endpoints (auth-gated)
│   │   ├── auth/           # Login, DPNS challenge/verify
│   │   ├── lottery/        # Create, end, payout, scan
│   │   └── entry/          # Submit, upvote, ticket calc
│   ├── lottery/            # Main lottery page
│   ├── contribute/         # Reserve + word drop + open source
│   ├── admin/              # Admin panel (password-gated)
│   └── winners/            # Hall of fame
├── lib/
│   ├── dash.ts             # HD wallet, address derivation, payouts
│   ├── dpns.ts             # Dash Platform name resolution
│   ├── dash-auth.ts        # DPNS login challenge/verify
│   ├── store.ts            # JSON flat file state management
│   └── auth.ts             # Session management
├── scripts/
│   └── worker.mjs          # Background worker (PM2)
├── platform/
│   └── contracts/          # Dash Platform data contract schemas
├── docs/                   # Deep documentation
└── ecosystem.config.js     # PM2 process config
```

---

## How Auto Admin Works

The background worker (`scripts/worker.mjs`) runs every 5 seconds and:

1. **Scans** all entry deposit addresses for new DASH
2. **Detects** expired lotteries → auto-ends + pays out winner
3. **Checks** for lottery gap → if none active + Auto Admin enabled → starts new one
4. **Calls** OpenAI to generate a timely, creative name for the new round
5. **Derives** a fresh deposit address from the HD wallet
6. **Seeds** the new lottery with any reserve next-lottery funds

All of this happens **autonomously**. No human needed.

---

## The Payout System

```
Total DASH collected
       │
       ├── 85% ──→ Winner's DASH address  (on-chain TX)
       ├── 10% ──→ Reserve fund address   (community treasury)
       └──  5% ──→ Next lottery address   (seeds next round)
```

Every split is a real blockchain transaction. Every TX ID is shown publicly. Every payout is verifiable on [insight.dash.org](https://insight.dash.org).

→ Deep dive: [docs/PAYOUT-SYSTEM.md](./docs/PAYOUT-SYSTEM.md)

---

## Dash Evolution — Next Steps

### ✅ Phase 1 (Current — V1.02)
- DPNS username login working in production
- HD wallet address derivation via dashcore-lib
- On-chain DASH payments (Core chain)
- Data contract schemas designed
- Auto Admin + AI naming live

### 🔲 Phase 2 (Coming)
- Register data contracts on Dash Platform mainnet
- Sync all lotteries + results to Platform Documents
- Contract IDs published — anyone can verify via DAPI

### 🔲 Phase 3 (Full Decentralization)
- DPNS-only login (remove email)
- Identity-based ticket ownership
- Verifiable Random Function (VRF) for provably fair draws
- Multi-sig payout using Platform identity keys

### 🔲 Phase 4 (Expansion)
- Native mobile app (DashPay integration)
- Cross-lottery reputation on Platform
- Dash DAO proposal for treasury support
- `@timely/lottery-sdk` — deploy your own instance

→ [Full roadmap in DASH-EVOLUTION.md](./DASH-EVOLUTION.md)

---

## Deploying to VPS

```bash
# Build
npm run build

# Start with PM2 (ecosystem config handles env vars)
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save
pm2 startup

# Check status
pm2 status
pm2 logs timely-worker --lines 50
```

The Vercel project proxies API calls to your VPS. Set `WORKER_URL` to your VPS address in both `.env.local` and Vercel environment variables.

---

## Contributing

We welcome contributors! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

Quick contribution flow:
```bash
git fork https://github.com/InitiumBuilders/timely-lottery
git checkout -b feature/my-improvement
# make changes
git commit -m "feat: your improvement"
git push && open a PR
```

Report security issues privately: InitiumBuilders@gmail.com  
See [SECURITY.md](./SECURITY.md) for full disclosure policy.

---

## License

MIT — Use it, fork it, build on it. Just give it a good home.

---

## Built By

**August James** — Emergent strategist, systems thinker, Dash builder.  
[InitiumBuilders.com](https://initium.builders) · [@BuiltByAugust](https://x.com/BuiltByAugust) · Chicago, IL

> *"Small is good, small is all. The large is a reflection of the small."*  
> — adrienne maree brown, Emergent Strategy

---

*Timely.Works is built on Dash Evolution. The first autonomous lottery on a decentralized platform.*  
*The future of community funding is transparent, on-chain, and beautiful.* 🔵

<!-- fun fact: the worker checks for a new lottery every 60 seconds. it never sleeps. -->
