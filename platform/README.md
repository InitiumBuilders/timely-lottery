# platform/ — Dash Evolution Integration

This directory contains everything needed to put Timely.Works lottery data on-chain via Dash Platform (Dash Evolution).

---

## Why?

Right now, lottery data lives in a SQLite database on our VPS. That's fine for uptime, but it's centralized — you have to trust us that the data is accurate.

Dash Platform changes that. By storing lottery rounds, results, and entries as **Platform Documents**, we make the lottery verifiable by anyone, forever, without trusting our server.

---

## Directory Structure

```
platform/
├── contracts/
│   ├── lottery-contract.json     ← The data contract schema (document types)
│   └── register.mjs              ← Script to register the contract on mainnet
└── README.md                     ← This file
```

---

## The Data Contract

`contracts/lottery-contract.json` defines three document types:

| Document Type | Purpose |
|---|---|
| `lottery` | One document per lottery round — metadata, status, dates, DASH address |
| `result` | One document when a lottery ends — winner, payout txid, DASH split |
| `entry` | One document per participant — DPNS name, DASH contributed, ticket count |

Once registered on mainnet, these documents are:
- Publicly readable by anyone via DAPI
- Tamper-proof (secured by EvoNode consensus)
- Permanently stored (tied to the Platform chain)
- Queryable via the `dash` SDK or gRPC-web

---

## One-Time Setup: Register the Contract

### Prerequisites
1. A funded Dash Platform identity (registered via Dash mobile wallet or SDK)
2. At least ~0.25 DASH in Credits on that identity
3. Your wallet mnemonic and identity ID

### Run the registration script

```bash
cd /path/to/timely-lottery

# Set your environment variables
export DASH_MNEMONIC="your twelve word bip39 mnemonic"
export IDENTITY_ID="your-identity-id-in-base58"

# Run the registration
node platform/contracts/register.mjs
```

The script outputs a **Contract ID** — a permanent base58 identifier for your contract. Save it!

```bash
# Add to .env.local after successful registration
TIMELY_CONTRACT_ID="the_contract_id_from_the_script"
```

### What it costs
- One-time: ~0.1–0.5 DASH equivalent in Credits for contract registration
- Per state transition: ~0.00001–0.001 DASH per document create/update

---

## Using the Contract in Your App

After registration, query lottery documents via DAPI:

```js
const Dash = require('dash');
const client = new Dash.Client({
  network: 'mainnet',
  apps: {
    timelyLottery: {
      contractId: process.env.TIMELY_CONTRACT_ID,
    },
  },
});

// Get all active lotteries
const lotteries = await client.platform.documents.get('timelyLottery.lottery', {
  where: [['status', '==', 'active']],
  orderBy: [['startTime', 'desc']],
  limit: 10,
});

// Get results for a specific lottery
const results = await client.platform.documents.get('timelyLottery.result', {
  where: [['lotteryId', '==', 'LOTTERY_ID_HERE']],
});
```

---

## Current Status

| Feature | Status |
|---|---|
| Contract schema designed | ✅ Done |
| Registration script | ✅ Done |
| Mainnet contract registration | 🔜 Pending funded identity |
| Lottery sync on create | 🔜 Roadmap |
| Result sync on lottery end | 🔜 Roadmap |
| Entry sync on contribution | 🔜 Roadmap |
| Read from Platform in UI | 🔜 Roadmap |

See [DASH-EVOLUTION.md](../DASH-EVOLUTION.md) for the full roadmap and technical details.

---

## Querying Without the SDK (gRPC-web)

For server-side Next.js where the full `dash` SDK is too heavy, you can query Platform documents directly via gRPC-web. See `lib/dpns-resolver.cjs` for a working example of this pattern — the same approach works for any data contract query.

---

## Platform Explorer

Once contracts are registered, you can verify them publicly:
- Mainnet: https://platform-explorer.pshenmic.dev/
- Testnet: https://testnet-platform-explorer.pshenmic.dev/

---

## Questions?

See [DASH-EVOLUTION.md](../DASH-EVOLUTION.md) for full technical documentation, or reach out at InitiumBuilders@gmail.com.
