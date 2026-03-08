# Dash Platform Integration

*A note from August, on why this matters.*

---

## Why Dash Platform — and not just Layer 1 payments

Most blockchain lottery projects stop at payments. DASH goes in. DASH comes out. The chain confirms the transfer. Done.

That's not enough.

Payments prove money moved. They don't prove what the rules were. They don't prove who participated. They don't prove the winner was chosen fairly from the people who actually played.

Dash Platform changes that. It's a decentralized data layer — built into the Dash blockchain — that lets us store structured data on-chain, permanently, without a centralized server in the way.

With Dash Platform, every lottery isn't just *paid* on-chain. It's *documented* on-chain. Open. Auditable. Forever.

---

## What a Data Contract Is — Explained Plainly

Think of a Data Contract like a template.

You define the shape of your data — what fields are required, what types they are, how long strings can be. You register that template on the Dash blockchain. From that moment on, anyone submitting data to your app has to match the template. The network enforces it.

For Timely.Works, the contract defines three document types:

- **`lottery`** — the lottery metadata (title, timing, address, status)
- **`result`** — the outcome (winner ID, amount sent, transaction hash)
- **`entry`** — each participant's public record (DPNS name, DASH contributed, tickets earned)
- **`word`** — One Word submissions for the lottery theme

The contract lives at an address on the Dash blockchain. Anyone can look it up. Anyone can verify that the documents match the rules. No trust required.

---

## How Dual-Write Works

Timely.Works uses two data layers simultaneously.

**SQLite** is fast. It powers the live UI — the countdown, the pool size, the entry list. When you submit an entry or end a lottery, the SQLite write happens first. The UI responds instantly.

**Dash Drive** is truth. Right after the SQLite write, we fire a background task to publish the same data to Dash Platform. If the network is slow, if the write fails, if TIMELY_CONTRACT_ID isn't configured — none of that blocks the app. The lottery keeps running.

This is the dual-write pattern:

```
User action
    │
    ├─▶ SQLite write (instant — UI responds here)
    │
    └─▶ Dash Drive publish (async, fire-and-forget)
             │
             └─ Success: lottery is now verifiable on-chain
             └─ Failure: logged, swallowed — app still works
```

Speed and truth. Not competing. Both.

---

## How to Register the Contract

You only do this once. Then the contract lives on-chain forever.

### Step 1: Set up testnet first

```bash
# Clone and install
git clone https://github.com/InitiumBuilders/timely-lottery
cd timely-lottery
npm install

# Configure testnet
cp .env.example .env.local
```

In `.env.local`, set:
```
DASH_NETWORK=testnet
DASH_MNEMONIC="your twelve word testnet mnemonic"
DASH_IDENTITY_ID="your testnet identity id"
TIMELY_CONTRACT_ID=""
```

### Step 2: Get testnet DASH

Visit the [Dash testnet faucet](https://testnet-faucet.dash.org/) and send a few tDASH to your wallet address.

### Step 3: Register the contract

```bash
node platform/contracts/register.mjs
```

This script:
1. Connects to Dash Platform (testnet or mainnet based on `DASH_NETWORK`)
2. Reads `platform/contracts/lottery-contract.json`
3. Registers the data contract on-chain
4. Prints your `TIMELY_CONTRACT_ID`

Copy that ID into your `.env.local`:
```
TIMELY_CONTRACT_ID="your-contract-id-here"
NEXT_PUBLIC_ON_CHAIN="1"
```

### Step 4: Test it

Start the app and create a lottery. Check the verification endpoint:
```
GET /api/platform/verify?lotteryId=YOUR_LOTTERY_ID
```

You should see `{ "onChain": true, ... }`.

### Step 5: Go mainnet

When you're confident, repeat with `DASH_NETWORK=mainnet` and your mainnet identity. Register once. The contract lives forever.

---

## How Anyone Can Independently Verify a Lottery Result

This is the point of all of it.

Anyone — not just Timely.Works, not just the winner, not just the admin — can look up any lottery result on Dash Platform.

**Via the API:**
```
GET https://timely.works/api/platform/verify?lotteryId=LOTTERY_ID
```

Returns:
```json
{
  "onChain": true,
  "contractId": "your-contract-id",
  "docs": {
    "lottery": { "title": "...", "status": "ended", ... },
    "result":  { "winnerId": "...", "winnerDash": 0.8500, "winnerTxId": "...", ... },
    "entries": [...]
  },
  "verifiedAt": 1234567890000
}
```

**Via the Dash SDK directly:**
```javascript
const Dash = require('dash');
const client = new Dash.Client({ network: 'mainnet' });

const results = await client.platform.documents.get('timelyLottery.result', {
  where: [['lotteryId', '==', 'YOUR_LOTTERY_ID']],
});

console.log(results[0].toJSON());
```

No intermediary. No trust. Just data, signed and stored on a decentralized network.

The winner's transaction hash is in the result document. That hash is verifiable on any Dash block explorer. The amount matches. The timing matches. The record is permanent.

---

## The Vision: Fully Decentralized Timely.Works

Right now, Timely.Works runs on a VPS. That's honest about where we are. Fast. Practical. Working.

But the vision is bigger.

Every lottery published to Dash Drive is a step toward a lottery that runs without a server at all. Where the rules are on-chain. Where the randomness is verifiable. Where the payout is automatic. Where no admin is required — not because we removed the admin button, but because the chain enforces the contract.

Decentralization isn't a feature. It's democratic infrastructure. It's the difference between "trust us" and "verify yourself." It's the difference between a company running a lottery and a community owning one.

We're building toward that. Dual-write today. Full on-chain tomorrow.

---

## Join the Build

Timely.Works is open source.

If you believe in community-owned tools, verifiable fairness, and Dash as democratic infrastructure — come build with us.

```
GitHub: https://github.com/InitiumBuilders/timely-lottery
Discord: dash.org/community
```

The chain is open. So are we.

— August James
