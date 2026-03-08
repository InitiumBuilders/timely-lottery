# Đ DASH EVOLUTION — Timely.Works Integration Guide

> *"We didn't just build on Dash. We built the first autonomous lottery the protocol has ever seen."*
> — August James, Founder, Timely.Works

---

## What Is Dash Evolution?

Dash Evolution (also called **Dash Platform**) is a decentralized application layer built on top of the Dash blockchain. While regular Dash (Core) handles fast, cheap payments, Dash Evolution handles **user identity, decentralized data storage, and application logic** — all without a centralized server.

Think of it as Web3 infrastructure that actually works for Web2 developers.

| Layer | What it does |
|---|---|
| **Dash Core** | Fast, cheap payments. P2P. PoW consensus. |
| **Dash Platform** | Decentralized data. Identities. App layer. |
| **DAPI** | API gateway to both layers — no node required. |
| **Drive** | Decentralized storage (GroveDB → RocksDB). |
| **DPNS** | `.dash` usernames — human-readable identities. |
| **DashPay** | Contact list + payment app built on Platform. |

**EvoNodes** are special masternodes that run both Core and Platform simultaneously. They are the muscle behind Dash Evolution.

---

## How Timely.Works Uses Dash Evolution

### 1. DPNS Username Login

Every lottery participant can sign in with their `.dash` username instead of email. No password. No centralized auth server.

**The Flow:**
```
1. User types their DPNS username (e.g. "august.dash")
2. Timely.Works calls DAPI → resolves username to an Identity
3. Server generates a random challenge string
4. User signs the challenge with their Dash private key (in-browser)
5. Server verifies the signature against the on-chain public key
6. ✅ Authenticated — no password ever leaves the user's device
```

**Code:** `lib/dpns.ts` · `app/api/auth/dash-challenge/route.ts` · `app/api/auth/dash-verify/route.ts`

---

### 2. HD Wallet Address Derivation

Every lottery gets a unique DASH deposit address, derived from a master mnemonic via `dashcore-lib`:

```
m/44'/5'/1'/0/{index}
```

- Lottery addresses: index `100+`
- Entry deposit addresses: index `200+`  
- Reserve fund: permanent dedicated address
- Next-lottery seed: address pool

**Why this matters:** Every deposit is verifiable on-chain. No trust required.

**Code:** `lib/dash.ts` → `deriveLotteryAddress()` · `deriveEntryAddress()`

---

### 3. Data Contracts — Lotteries On-Chain

Timely.Works has designed three Dash Platform **Data Contracts** that will move all lottery data on-chain:

**`platform/contracts/lottery-contract.json`**

```json
{
  "lottery": {
    "→ lotteryId, title, description, status",
    "→ startTime, endTime, durationMinutes",
    "→ totalDash, totalTickets, participantCount",
    "→ dashAddress, autoStarted"
  },
  "result": {
    "→ lotteryId, winnerId, winnerName",
    "→ winnerDash, winnerTxId, totalDash, endTime"
  },
  "entry": {
    "→ lotteryId, entryId, dpnsName",
    "→ dashContributed, totalTickets, timestamp"
  }
}
```

Once registered on mainnet, every lottery round and winner becomes **permanently verifiable** on the Dash Platform chain. No database. No trust. Just math.

---

### 4. The 85/10/5 Split (On-Chain)

When a lottery ends:
- **85%** → winner's DASH address (broadcast to Core chain)
- **10%** → Reserve fund address (community treasury)
- **5%** → Seeds the next lottery (automatic)

Every split is a real on-chain transaction. Explorer links provided for every payout. Transparent by default.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     USER (Browser)                          │
│   Signs challenges with Dash private key via DashPay SDK    │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTPS
┌───────────────────────▼─────────────────────────────────────┐
│              Timely.Works (Next.js / VPS)                   │
│  • API Routes — auth, lottery, entries, payouts             │
│  • Worker (PM2) — scans, auto-end, auto-start, AI naming   │
│  • SQLite — fast local cache of on-chain state             │
│  • store.json — lottery state, admin settings              │
└────────────┬──────────────────────────┬─────────────────────┘
             │ dashcore-lib              │ DAPI calls
             │ (sign/broadcast TXs)      │ (resolve DPNS, verify)
             ▼                           ▼
┌────────────────────┐     ┌─────────────────────────────────┐
│  Dash Core Chain   │     │      Dash Platform Chain        │
│  (payments, UTXO)  │     │  (identities, DPNS, documents)  │
│  insight.dash.org  │     │  DAPI → EvoNodes → Drive        │
└────────────────────┘     └─────────────────────────────────┘
```

---

## Security Model

| What | How it's protected |
|---|---|
| Admin password | Server-side only. Never in JS bundle. Env var. |
| DASH mnemonic | `.env.local` only. Gitignored. Never committed. |
| Private keys | Never leave the user's device (challenge/sign pattern) |
| API secrets | Environment variables. Zero fallback hardcoded values. |
| Rate limiting | `/lib/ratelimit.ts` — per-IP, per-route |
| CORS | Configured in `next.config.mjs` |

---

## Why Build on Dash Evolution?

### For Developers

- **JavaScript SDK** — `npm install dash`. No Solidity. No EVM complexity.
- **DAPI removes infrastructure** — No RPC node. No indexer. DAPI handles it.
- **Same-block execution** — Platform confirms in the same block as Core. Fast.
- **User-owned data** — Documents belong to the identity that created them. App closes? Data stays.
- **DPNS = Universal login** — One username works across every Dash app.
- **Credits system** — Pay per state transition. No monthly fees.

### vs. Other Platforms

| Feature | Ethereum/Solana | Dash Platform |
|---|---|---|
| Login | Wallet connect (complex UX) | DPNS username (simple) |
| Storage | Expensive on-chain / IPFS | Drive (built-in, fast) |
| Dev language | Solidity / Rust | JavaScript / TypeScript |
| UX | Gas fees, signing every TX | Credits pre-funded, seamless |
| Speed | Blocks vary wildly | Same-block execution |

---

## 🗺️ Next Steps — Dash Evolution Roadmap

These are the milestones that will make Timely.Works **fully decentralized** on Dash Platform:

### Phase 1 — Foundation (Current V1.02)
- ✅ DPNS username login (challenge/sign/verify)
- ✅ HD wallet address derivation via dashcore-lib
- ✅ On-chain DASH payments (Core chain)
- ✅ Data contract schemas designed (`platform/contracts/`)
- ✅ DAPI connection via `lib/dpns-resolver.cjs`
- ✅ Auto Admin — AI-named autonomous lottery rounds

### Phase 2 — On-Chain Data (Next)
- 🔲 **Register data contracts on Dash Platform mainnet** (contract IDs needed)
- 🔲 Fund a Platform identity for contract registration
- 🔲 Sync all lottery documents to Platform on creation
- 🔲 Sync result documents on lottery end
- 🔲 Public contract ID published — anyone can verify any result via DAPI

### Phase 3 — Full Decentralization
- 🔲 **Full DPNS-only login** — remove email auth entirely
- 🔲 Identity-based ticket ownership (documents per identity)
- 🔲 **Verifiable Random Function (VRF)** — provably fair winner selection on-chain
- 🔲 Multi-sig payout using Platform identity keys
- 🔲 DAO vote integration — community governs split percentages

### Phase 4 — Expansion
- 🔲 **Native mobile app** — DashPay + Timely.Works deep integration
- 🔲 Cross-lottery reputation system (Initium history on Platform)
- 🔲 Dash DAO proposal for treasury funding
- 🔲 SDK: `@timely/lottery-sdk` — let anyone deploy their own instance
- 🔲 Multi-chain support (other DASH-based assets)

---

## For the Dash DAO

Timely.Works demonstrates that **real applications** can be built on Dash Evolution today.

What we've proven:
- DPNS usernames work as authentication in production
- dashcore-lib is reliable for HD wallet address derivation at scale
- DAPI connections are stable enough for live applications
- The developer experience is genuinely good (Next.js + Dash SDK)

**What we're asking:** Help us register the data contracts on mainnet and support the Phase 2 roadmap. The code is open source. The lottery is live. The community is growing.

> *"The Dash community built the rails. We built the first train. Now let's fill it with passengers."*

---

## Contributing

```bash
git clone https://github.com/InitiumBuilders/timely-lottery
cd timely-lottery
cp .env.example .env.local   # fill in your values
npm install
npm run dev                   # http://localhost:3000
```

See `CONTRIBUTING.md` for full guide.  
See `SECURITY.md` for responsible disclosure.  
See `docs/ARCHITECTURE.md` for deep system design.

---

## Resources

| Resource | Link |
|---|---|
| Dash Platform Docs | https://docs.dash.org/projects/platform/en/latest/ |
| Dash Evolution Intro | https://www.dash.org/blog/introducing-dash-evolution-platform/ |
| GitHub (dashevo) | https://github.com/dashevo |
| DashCentral (DAO) | https://dashcentral.org |
| Timely.Works | https://timely.works |
| Initium Builders | https://initium.builders |

---

*Built with love, divergent strategy, and a deep belief that decentralized systems can be beautiful.*  
*— August James, Chicago, 2026*

<!-- 🥚 Easter Egg #1: If you're reading this in the source, you're already one of us. Welcome. -->
<!-- 🥚 Easter Egg #2: The reserve address starts with Xp. Find it. Watch it grow. -->
<!-- 🥚 Easter Egg #3: 0x44415348 = "DASH" in hex. The protocol was always speaking to us. -->
