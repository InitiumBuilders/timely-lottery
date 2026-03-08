# Timely.Works × Dash Evolution Integration Roadmap

*Authored by AVARI — 2026-03-05*  
*Philosophy: Build the trustless container. Let the system be the proof.*

---

## Why Dash Evolution Changes Everything

Right now, Timely.Works runs on trust in us:
- Trust that the lottery is fair
- Trust that the payout is real
- Trust that the winner was chosen randomly
- Trust that the DASH split happened correctly

**With Dash Evolution, the platform itself becomes the proof.**

No one has to trust us. The chain is the witness.

---

## What Dash Evolution Gives Us

| Feature | What It Is | How We Use It |
|---------|-----------|---------------|
| **Identities** | Blockchain-based user IDs | Replace email/password login |
| **DPNS** | Dash Platform Name Service | `august.dash` usernames — permanent, portable |
| **Data Contracts** | On-chain schemas (like a DB schema on the blockchain) | Define lottery, ticket, and winner structures |
| **Documents** | Data stored in Drive under a contract | Each lottery, entry, and payout as a verifiable document |
| **Drive** | Decentralized storage layer | Replace SQLite — data lives on the network |
| **DAPI** | Decentralized API | Query the network directly — no central API needed |

---

## Phase 1: Dash Identity Login (Replace Email/Password)

**The Vision:** Users log in with their Dash identity. No email. No password. Cryptographically proven.

### How It Works:
```
1. User clicks "Login with Dash"
2. They sign a challenge message with their Dash private key
3. Platform verifies the signature against their identity on Platform
4. Session created — no password ever stored or sent
```

### Code Pattern:
```typescript
import Dash from 'dash';

// Challenge-response auth
const client = new Dash.Client({ network: 'mainnet' });

// Generate challenge
const challenge = crypto.randomBytes(32).toString('hex');

// User signs challenge with their wallet (in browser via DashPay or web wallet)
// We verify:
const identity = await client.platform.identities.get(identityId);
const isValid = identity.publicKeys[0].verify(challenge, signature);

if (isValid) {
  // Create session — user is authenticated by cryptographic proof
  const session = await createSession(identity.getId().toJSON());
}
```

### User Experience:
- Connect wallet → sign → logged in
- DPNS name (`august.dash`) becomes their display name
- No email required, no password to forget or steal

---

## Phase 2: On-Chain Lottery State (Replace SQLite)

**The Vision:** Every lottery is a Dash Platform Document. Transparent. Immutable. Auditable by anyone.

### Data Contract Design:
```json
{
  "lottery": {
    "type": "object",
    "properties": {
      "title":       { "type": "string", "maxLength": 100 },
      "createdAt":   { "type": "integer" },
      "endsAt":      { "type": "integer" },
      "dashAddress": { "type": "string" },
      "status":      { "type": "string", "enum": ["active", "ended", "paid"] },
      "winnerIdentityId": { "type": "string" },
      "winnerTxId":  { "type": "string" }
    }
  },
  "entry": {
    "type": "object",
    "properties": {
      "lotteryId":   { "type": "string" },
      "identityId":  { "type": "string" },
      "dpnsName":    { "type": "string" },
      "initium":     { "type": "string", "maxLength": 500 },
      "dashAddress": { "type": "string" },
      "tickets":     { "type": "integer" },
      "txIds":       { "type": "array", "items": { "type": "string" } }
    }
  }
}
```

### Why This Matters:
- Anyone can query the Dash Platform and verify the lottery data
- Winner selection can be based on block hash (provably random)
- No one — not even us — can alter the results after the fact

---

## Phase 3: Verifiable Random Winner Selection

**The Problem Now:** We pick the winner with `Math.random()`. Anyone has to trust us.

**The Solution:** Use the Dash block hash at lottery end time as the random seed.

```typescript
// At lottery end time, fetch the latest block hash
const blockHash = await client.getDAPIClient().getBlockHash(blockHeight);

// Use it as entropy for winner selection
const seed = parseInt(blockHash.slice(0, 8), 16);
const winnerIndex = seed % totalTickets;

// This is now: publicly verifiable, not manipulable, provably fair
```

**Anyone can verify:** Take the block hash → apply the same algorithm → get the same winner.

---

## Phase 4: Trustless Payout via Dash Platform

Store payout records as Platform Documents:

```typescript
// After payout, create an immutable record on Drive
await client.platform.documents.broadcast({
  payout: client.platform.documents.create(
    'timely.payout',
    identity,
    {
      lotteryId: lottery.id,
      winnerIdentityId: winner.identityId,
      dashAmount: payoutAmount,
      txId: payoutTxId,
      timestamp: Date.now(),
    }
  )
}, identity);
```

Now every payout is permanently on-chain. Public. Unalterable.

---

## Phase 5: Eliminate the VPS (Long-term)

The current architecture:
```
Browser → Vercel (edge) → VPS (SQLite + API) → Dash network
```

The Dash Evolution architecture:
```
Browser → Vercel (edge/static) → Dash Platform (DAPI + Drive)
```

No VPS. No SQLite. No single point of failure. No server to hack.

The platform becomes unstoppable infrastructure.

---

## Implementation Sequence

### Sprint 1 (Now — Security Hardening) ✅
- [x] Rate limiting on auth endpoints
- [x] Security headers (CSP, HSTS, X-Frame-Options)
- [x] Input validation and sanitization
- [ ] Strong JWT secret rotation
- [ ] VPS HTTPS (SSL cert via Let's Encrypt)
- [ ] Mnemonic moved to hardware/encrypted vault

### Sprint 2 (Dash Identity Login)
- [ ] Install/update `dash` SDK to latest Platform version
- [ ] Build Dash identity challenge-response auth flow
- [ ] DPNS name resolution for display names
- [ ] Keep email/password as fallback during transition

### Sprint 3 (On-Chain Lottery Data)
- [ ] Design and deploy Data Contract to mainnet
- [ ] Migrate lottery creation → Platform documents
- [ ] Migrate entry creation → Platform documents
- [ ] Keep SQLite as cache/fallback

### Sprint 4 (Verifiable Randomness)
- [ ] Integrate block hash into winner selection
- [ ] Build public verification page (anyone can verify)
- [ ] Document the algorithm clearly for community trust

### Sprint 5 (Full Decentralization)
- [ ] Move all state to Drive
- [ ] Remove VPS dependency
- [ ] Static Vercel frontend + DAPI directly

---

## Security Wins from Dash Evolution

| Current Risk | Dash Evolution Solution |
|-------------|------------------------|
| DASH mnemonic on server | Identity-based auth — no wallet on server needed for auth |
| SQLite can be deleted/corrupted | Drive is replicated across masternodes — always available |
| Winner selection is trusted | Block hash = public, verifiable, tamper-proof randomness |
| Payout can be disputed | On-chain payout documents — permanent, public proof |
| Single VPS = single point of failure | DAPI = distributed across hundreds of masternodes |
| Password breach = all accounts compromised | Private key compromise = only that user affected |

---

## The Philosophy

> *"If you don't create the container, you become the content."*

Right now, Timely.Works IS the container. The platform is the trust.

With Dash Evolution, **the blockchain is the container**. We step back. The protocol holds. The community can verify everything without depending on us.

That's not just security. That's sovereignty.

---

*This document is a living roadmap. Updated as we build.*
